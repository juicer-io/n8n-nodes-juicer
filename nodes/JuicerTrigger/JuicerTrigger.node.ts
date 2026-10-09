import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IHookFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';
import { juicerApiRequest } from '../Juicer/shared/transport';

type JuicerWebhook = {
	id: number;
	url: string;
	status: 'active' | 'paused' | 'disabled';
};

type NodeStaticData = {
	webhookId?: number;
	webhookSecret?: string;
};

type DeliveryBody = {
	id: number;
	event: string;
	occurred_at: string;
	data: IDataObject;
};

async function listWebhooks(this: IHookFunctions): Promise<JuicerWebhook[]> {
	const webhooks: JuicerWebhook[] = [];
	let page = 1;
	let totalPages = 1;

	do {
		const response = await juicerApiRequest.call(this, 'GET', '/webhooks', undefined, {
			page,
			per_page: 100,
		});
		webhooks.push(...((response.data ?? []) as JuicerWebhook[]));
		totalPages =
			((response.meta as IDataObject | undefined)?.total_pages as number | undefined) ?? 1;
		page += 1;
	} while (page <= totalPages);

	return webhooks;
}

async function deleteWebhook(this: IHookFunctions, webhookId: number): Promise<void> {
	try {
		await juicerApiRequest.call(this, 'DELETE', `/webhooks/${webhookId}`);
	} catch (error) {
		const apiError = error as NodeApiError;
		// Already gone on Juicer's side (deleted in the dashboard, or by an earlier run).
		if (apiError.httpCode === '404') return;
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: apiError.message,
			description: apiError.description ?? undefined,
			httpCode: apiError.httpCode ?? undefined,
		});
	}
}

function signatureMatches(
	rawBody: Buffer,
	signatureHeader: string | undefined,
	secret: string,
): boolean {
	if (!signatureHeader) return false;

	const expected = Buffer.from(
		`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`,
	);
	const received = Buffer.from(signatureHeader);

	return expected.length === received.length && timingSafeEqual(expected, received);
}

export class JuicerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Juicer Trigger',
		name: 'juicerTrigger',
		icon: { light: 'file:../../icons/juicer.svg', dark: 'file:../../icons/juicer.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ $parameter["events"].join(", ") }}',
		description:
			'Starts the workflow when Juicer finds new posts or a connected account needs attention',
		defaults: {
			name: 'Juicer Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'juicerApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Juicer only delivers to HTTPS URLs. n8n Cloud works as is; a self-hosted n8n needs a public HTTPS address (set WEBHOOK_URL).',
				name: 'httpsNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: [
					{
						name: 'New Posts',
						value: 'post.created',
						description: 'A sync found new posts in one of your feeds',
					},
					{
						name: 'Social Account Expired',
						value: 'social_account.expired',
						description: 'A connected social account stopped working and must be reconnected',
					},
					{
						name: 'Social Account Expiring',
						value: 'social_account.expiring',
						description: 'A connected social account expires within five days',
					},
				],
				default: ['post.created'],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Feed IDs',
						name: 'feedIds',
						type: 'string',
						default: '',
						placeholder: 'e.g. 12345,67890',
						description:
							'Comma-separated feed IDs. Only new posts from these feeds start the workflow. Leave empty for all feeds.',
					},
					{
						displayName: 'Split Posts',
						name: 'splitPosts',
						type: 'boolean',
						default: true,
						description:
							'Whether each new post becomes its own item. Turn off to get one item per sync with all posts in a list.',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as NodeStaticData;
				if (!staticData.webhookId || !staticData.webhookSecret) return false;

				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhooks = await listWebhooks.call(this);
				const existing = webhooks.find((webhook) => webhook.id === staticData.webhookId);

				if (existing && existing.url === webhookUrl && existing.status !== 'disabled') return true;

				// Juicer disables a webhook after 10 failed deliveries; replace it rather than reuse it.
				if (existing) await deleteWebhook.call(this, existing.id);
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl?.startsWith('https://')) {
					throw new NodeOperationError(
						this.getNode(),
						`Juicer only delivers webhooks to HTTPS URLs, but this n8n's webhook URL is ${webhookUrl ?? 'unknown'}`,
						{
							description:
								'Use n8n Cloud, or give your self-hosted n8n a public HTTPS address with the WEBHOOK_URL setting.',
						},
					);
				}

				const events = this.getNodeParameter('events') as string[];

				// A webhook already pointing at this URL was made by an earlier activation whose
				// secret is lost, so its deliveries can't be verified. Remove it first.
				const webhooks = await listWebhooks.call(this);
				for (const orphan of webhooks.filter((webhook) => webhook.url === webhookUrl)) {
					await deleteWebhook.call(this, orphan.id);
				}

				const response = await juicerApiRequest.call(this, 'POST', '/webhooks', {
					url: webhookUrl,
					subscribed_events: events,
				});
				const created = (response.data ?? {}) as { id?: number; secret?: string };
				if (!created.id || !created.secret) {
					throw new NodeApiError(this.getNode(), response as JsonObject, {
						message: 'Juicer did not return a webhook ID and secret',
					});
				}

				const staticData = this.getWorkflowStaticData('node') as NodeStaticData;
				staticData.webhookId = created.id;
				staticData.webhookSecret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as NodeStaticData;
				if (staticData.webhookId) await deleteWebhook.call(this, staticData.webhookId);

				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const staticData = this.getWorkflowStaticData('node') as NodeStaticData;

		if (!request.rawBody) await request.readRawBody();
		const signature = this.getHeaderData()['x-juicer-signature'] as string | undefined;

		if (
			!staticData.webhookSecret ||
			!signatureMatches(request.rawBody, signature, staticData.webhookSecret)
		) {
			const response = this.getResponseObject();
			response.status(401).send('Invalid Juicer signature');
			return { noWebhookResponse: true };
		}

		const body = this.getBodyData() as unknown as DeliveryBody;
		const events = this.getNodeParameter('events') as string[];
		const options = this.getNodeParameter('options', {}) as {
			feedIds?: string;
			splitPosts?: boolean;
		};
		const isTest = body.data?.test === true;

		if (!isTest && !events.includes(body.event)) return { webhookResponse: 'ignored' };

		if (!isTest && body.event === 'post.created' && options.feedIds) {
			const feedIds = options.feedIds.split(',').map((id) => id.trim());
			const feedId = String((body.data.feed as IDataObject | undefined)?.id ?? '');
			if (!feedIds.includes(feedId)) return { webhookResponse: 'ignored' };
		}

		const splitPosts = options.splitPosts ?? true;
		const posts = body.data?.posts;

		if (!isTest && body.event === 'post.created' && splitPosts && Array.isArray(posts)) {
			const items: INodeExecutionData[] = (posts as IDataObject[]).map((post) => ({
				json: {
					...post,
					feed: body.data.feed,
					source: body.data.source,
					juicer_event_id: body.id,
					juicer_event: body.event,
					occurred_at: body.occurred_at,
				},
			}));
			if (items.length === 0) return { webhookResponse: 'ignored' };
			return { workflowData: [items] };
		}

		return { workflowData: [[{ json: body as unknown as IDataObject }]] };
	}
}
