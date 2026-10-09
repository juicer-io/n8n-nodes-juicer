import {
	NodeApiError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type INodeProperties,
	type JsonObject,
} from 'n8n-workflow';
import {
	dataPostPlatformOptions,
	dataProfilePlatformOptions,
	termTypeOptions,
} from '../shared/descriptions';
import { throwOnJuicerError } from '../shared/transport';

type PlatformStatus = {
	platform: string;
	success: boolean;
	count?: number;
	next_cursor?: string | null;
	error_code?: string;
	message?: string;
};

const showForSearchPosts = { resource: ['socialData'], operation: ['searchPosts'] };
const showForLookUpProfiles = { resource: ['socialData'], operation: ['lookUpProfiles'] };

// The Data API answers 200 even when individual platforms fail, listing each
// platform's outcome in `meta.platforms`. Fail loudly only when nothing worked,
// so a partial result still reaches the workflow.
function failWhenEveryPlatformFailed(this: IExecuteSingleFunctions, body: IDataObject): void {
	const platforms = ((body.meta as IDataObject | undefined)?.platforms ?? []) as PlatformStatus[];
	if (platforms.length === 0 || platforms.some((status) => status.success)) return;

	const reasons = platforms
		.map((status) => `${status.platform}: ${status.message ?? status.error_code ?? 'failed'}`)
		.join('; ');

	throw new NodeApiError(this.getNode(), body as JsonObject, {
		message: 'No platform returned results',
		description: reasons,
	});
}

async function splitDataResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = (response.body ?? {}) as IDataObject;
	failWhenEveryPlatformFailed.call(this, body);

	const output = this.getNodeParameter('options.output', 'items') as string;
	if (output === 'raw') return [{ json: body }];

	const records = (body.data ?? []) as IDataObject[];
	return limitPerPlatform.call(this, records).map((record) => ({ json: record }));
}

// A flat limit would let the first platform's page crowd out the rest, so the
// limit applies to each platform separately. Return All keeps every record.
function limitPerPlatform(this: IExecuteSingleFunctions, records: IDataObject[]): IDataObject[] {
	if (this.getNodeParameter('operation') !== 'searchPosts') return records;

	const returnAll = this.getNodeParameter('returnAll', false) as boolean;
	if (returnAll) return records;

	const limit = this.getNodeParameter('limit', 50) as number;
	const keptPerPlatform: Record<string, number> = {};

	return records.filter((record) => {
		const platform = String(record.platform ?? '');
		keptPerPlatform[platform] = (keptPerPlatform[platform] ?? 0) + 1;
		return keptPerPlatform[platform] <= limit;
	});
}

export const socialDataDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['socialData'] } },
		options: [
			{
				name: 'Search Posts',
				value: 'searchPosts',
				action: 'Search social posts',
				description:
					'Get recent posts for a handle, hashtag or keyword across several social platforms in one call',
				routing: {
					request: {
						method: 'GET',
						url: '/data/posts',
					},
					output: {
						postReceive: [throwOnJuicerError, splitDataResponse],
					},
				},
			},
			{
				name: 'Look Up Profiles',
				value: 'lookUpProfiles',
				action: 'Look up social profiles',
				description: 'Get the profile and follower metrics for handles on each platform',
				routing: {
					request: {
						method: 'GET',
						url: '/data/profiles',
					},
					output: {
						postReceive: [throwOnJuicerError, splitDataResponse],
					},
				},
			},
		],
		default: 'searchPosts',
	},

	// ── Search Posts ───────────────────────────────────────────────
	{
		displayName: 'Term',
		name: 'term',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. #coffee, nasa or "your brand"',
		description: 'The handle, hashtag or keyword to look up. How it is read depends on Term Type.',
		displayOptions: { show: showForSearchPosts },
		routing: { send: { type: 'query', property: 'term' } },
	},
	{
		displayName: 'Platforms',
		name: 'platforms',
		type: 'multiOptions',
		required: true,
		options: dataPostPlatformOptions,
		default: ['Instagram', 'TikTok', 'X'],
		description:
			'Platforms to search. Each platform spends API credits per request (1 for most, 3 for Instagram, LinkedIn and TikTok, 6 for Facebook).',
		displayOptions: { show: showForSearchPosts },
		routing: {
			send: {
				type: 'query',
				property: 'platforms',
				value: '={{ $value.join(",") }}',
			},
		},
	},
	{
		displayName: 'Term Type',
		name: 'termType',
		type: 'options',
		options: termTypeOptions,
		default: 'auto',
		description:
			'How to read the term. Reddit always needs Channel or Mentions / Keyword, and Google needs Reviews.',
		displayOptions: { show: showForSearchPosts },
		routing: {
			send: {
				type: 'query',
				property: 'term_type',
				value: '={{ $value === "auto" ? undefined : $value }}',
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		hint: 'Follows each platform’s next page until none is left. Every extra page spends API credits again.',
		displayOptions: { show: showForSearchPosts },
		routing: {
			send: { paginate: '={{ $value }}' },
			operations: {
				pagination: {
					type: 'generic',
					properties: {
						continue:
							'={{ ($response.body?.meta?.platforms ?? []).some(status => !!status.next_cursor) }}',
						request: {
							qs: {
								platforms:
									'={{ $response.body.meta.platforms.filter(status => !!status.next_cursor).map(status => status.platform).join(",") }}',
								cursor:
									'={{ $response.body.meta.platforms.filter(status => !!status.next_cursor).map(status => status.next_cursor).join(",") }}',
							},
						},
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		hint: 'Applies to each platform separately, taken from its first page, so it never spends extra credits',
		displayOptions: { show: { ...showForSearchPosts, returnAll: [false] } },
	},

	// ── Look Up Profiles ───────────────────────────────────────────
	{
		displayName: 'Handles',
		name: 'handles',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. nasa, spacex',
		description: 'Up to 5 handles, separated by commas. An @ prefix is allowed; hashtags are not.',
		displayOptions: { show: showForLookUpProfiles },
		routing: { send: { type: 'query', property: 'term' } },
	},
	{
		displayName: 'Platforms',
		name: 'profilePlatforms',
		type: 'multiOptions',
		required: true,
		options: dataProfilePlatformOptions,
		default: ['Instagram', 'TikTok', 'Twitter'],
		description: 'Platforms to look the handles up on. Each platform spends API credits.',
		displayOptions: { show: showForLookUpProfiles },
		routing: {
			send: {
				type: 'query',
				property: 'platforms',
				value: '={{ $value.join(",") }}',
			},
		},
	},

	// ── Shared ─────────────────────────────────────────────────────
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['socialData'] } },
		options: [
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				options: [
					{
						name: 'One Item per Result',
						value: 'items',
						description:
							'Each post, or each handle-and-platform profile group, becomes its own item',
					},
					{
						name: 'Raw Response',
						value: 'raw',
						description:
							'One item with the full response, including per-platform status and next-page cursors',
					},
				],
				default: 'items',
			},
		],
	},
];
