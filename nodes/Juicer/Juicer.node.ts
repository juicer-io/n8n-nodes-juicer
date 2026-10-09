import {
	NodeConnectionTypes,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeListSearchResult,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { feedDescription } from './resources/feed';
import { postDescription } from './resources/post';
import { socialDataDescription } from './resources/socialData';
import { sourceDescription } from './resources/source';
import { JUICER_API_BASE_URL, JUICER_CLIENT_HEADERS, juicerApiRequest } from './shared/transport';

type PlatformTermType = {
	term_type: string;
	display_name: string;
	requires_connection?: boolean;
};

type Platform = {
	platform: string;
	display_name: string;
	term_types: PlatformTermType[];
};

export class Juicer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Juicer',
		name: 'juicer',
		icon: { light: 'file:../../icons/juicer.svg', dark: 'file:../../icons/juicer.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Search social posts and profiles, run social listening feeds and moderate posts with the Juicer API',
		defaults: {
			name: 'Juicer',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'juicerApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: JUICER_API_BASE_URL,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				...JUICER_CLIENT_HEADERS,
			},
			// Errors are read from Juicer's error envelope by throwOnJuicerError,
			// which every operation runs first in postReceive.
			ignoreHttpStatusErrors: true,
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Social Data',
						value: 'socialData',
						description: 'One-off lookups of posts and profiles, without creating a feed',
					},
					{
						name: 'Feed',
						value: 'feed',
						description: 'A collection of sources that Juicer keeps syncing in the background',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'socialData',
			},
			...socialDataDescription,
			...feedDescription,
			...sourceDescription,
			...postDescription,
		],
	};

	methods = {
		listSearch: {
			async getFeeds(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const page = paginationToken ? Number(paginationToken) : 1;
				const response = await juicerApiRequest.call(this, 'GET', '/feeds', undefined, {
					page,
					per_page: 100,
				});

				const feeds = (response.data ?? []) as IDataObject[];
				const meta = (response.meta ?? {}) as { page?: number; total_pages?: number };
				const needle = filter?.toLowerCase();

				const results = feeds
					.filter(
						(feed) =>
							!needle ||
							String(feed.name ?? '')
								.toLowerCase()
								.includes(needle),
					)
					.map((feed) => ({
						name: `${feed.name as string} (${feed.id as number})`,
						value: String(feed.id),
					}));

				const hasMore =
					meta.page !== undefined && meta.total_pages !== undefined && meta.page < meta.total_pages;
				return { results, paginationToken: hasMore ? String(page + 1) : undefined };
			},
		},

		loadOptions: {
			async getPlatforms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await juicerApiRequest.call(this, 'GET', '/platforms');
				const platforms = (response.data ?? []) as Platform[];

				return platforms
					.map((platform) => ({ name: platform.display_name, value: platform.platform }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},

			async getTermTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const selectedPlatform = this.getCurrentNodeParameter('platform') as string | undefined;
				if (!selectedPlatform) return [];

				const response = await juicerApiRequest.call(this, 'GET', '/platforms');
				const platforms = (response.data ?? []) as Platform[];
				const platform = platforms.find((candidate) => candidate.platform === selectedPlatform);

				return (platform?.term_types ?? []).map((termType) => ({
					name: termType.requires_connection
						? `${termType.display_name} (needs a connected account)`
						: termType.display_name,
					value: termType.term_type,
				}));
			},
		},
	};
}
