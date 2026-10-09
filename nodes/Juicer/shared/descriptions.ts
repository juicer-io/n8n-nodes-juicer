import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

// Platforms served by the Data API without a connected account
// (Api::V1::Data::PostsFetcher::SUPPORTED_TERM_TYPES).
export const dataPostPlatformOptions: INodePropertyOptions[] = [
	{ name: 'Bluesky', value: 'Bluesky' },
	{ name: 'Facebook', value: 'Facebook' },
	{ name: 'Flickr', value: 'Flickr' },
	{ name: 'Giphy', value: 'Giphy' },
	{ name: 'Google Reviews', value: 'Google' },
	{ name: 'Instagram', value: 'Instagram' },
	{ name: 'LinkedIn', value: 'LinkedIn' },
	{ name: 'Pinterest', value: 'Pinterest' },
	{ name: 'Reddit', value: 'Reddit' },
	{ name: 'TikTok', value: 'TikTok' },
	{ name: 'Tumblr', value: 'Tumblr' },
	{ name: 'Vimeo', value: 'Vimeo' },
	{ name: 'X (Twitter)', value: 'X' },
	{ name: 'YouTube', value: 'YouTube' },
];

// Platforms supported by GET /data/profiles.
export const dataProfilePlatformOptions: INodePropertyOptions[] = [
	{ name: 'Bluesky', value: 'Bluesky' },
	{ name: 'Facebook', value: 'Facebook' },
	{ name: 'Google (Place Search)', value: 'Google' },
	{ name: 'Instagram', value: 'Instagram' },
	{ name: 'LinkedIn', value: 'LinkedIn' },
	{ name: 'Pinterest', value: 'Pinterest' },
	{ name: 'TikTok', value: 'TikTok' },
	{ name: 'X (Twitter)', value: 'Twitter' },
	{ name: 'YouTube', value: 'YouTube' },
];

export const termTypeOptions: INodePropertyOptions[] = [
	{
		name: 'Auto-Detect',
		value: 'auto',
		description: 'Terms starting with # are hashtags, everything else is a username',
	},
	{
		name: 'Channel',
		value: 'channel',
		description: 'A subreddit on Reddit or a channel on YouTube',
	},
	{
		name: 'Hashtag',
		value: 'hashtag',
	},
	{
		name: 'Mentions / Keyword',
		value: 'mentions',
		description: 'Keyword search on Reddit and TikTok, @mentions on X',
	},
	{
		name: 'Reviews',
		value: 'reviews',
		description: 'Google reviews for a Google Place ID',
	},
	{
		name: 'Username',
		value: 'username',
	},
];

export function feedSelect(show: Record<string, string[]>): INodeProperties {
	return {
		displayName: 'Feed',
		name: 'feedId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The Juicer feed to use',
		displayOptions: { show },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a feed...',
				typeOptions: {
					searchListMethod: 'getFeeds',
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12345',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[0-9]+$',
							errorMessage: 'A feed ID is a number',
						},
					},
				],
			},
		],
	};
}

// Page-based "Return All" / "Limit" pair shared by every Juicer list endpoint
// (`meta.page` and `meta.total_pages` in PaginationMeta).
export function pagedListFields(show: Record<string, string[]>): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
			routing: {
				send: {
					paginate: '={{ $value }}',
					type: 'query',
					property: 'per_page',
					value: '100',
				},
				operations: {
					pagination: {
						type: 'generic',
						properties: {
							continue:
								'={{ !!$response.body?.meta && $response.body.meta.page < $response.body.meta.total_pages }}',
							request: {
								qs: {
									page: '={{ ($response.body?.meta?.page ?? 0) + 1 }}',
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
			typeOptions: { minValue: 1, maxValue: 100 },
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
			routing: {
				send: {
					type: 'query',
					property: 'per_page',
				},
				output: {
					maxResults: '={{ $value }}',
				},
			},
		},
	];
}
