import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { feedSelect, pagedListFields } from '../shared/descriptions';
import { throwOnJuicerError } from '../shared/transport';

const syncIntervalOptions: INodePropertyOptions[] = [
	{ name: 'Plan Default', value: 'default' },
	{ name: 'Every Minute', value: 1 },
	{ name: 'Every 5 Minutes', value: 5 },
	{ name: 'Every 10 Minutes', value: 10 },
	{ name: 'Every 30 Minutes', value: 30 },
	{ name: 'Every Hour', value: 60 },
	{ name: 'Every 4 Hours', value: 240 },
	{ name: 'Once a Day', value: 1440 },
];

const syncIntervalDescription =
	'How often Juicer syncs the feed’s sources. On credit-based API plans every sync spends credits, so an hourly feed costs about 24 times a daily one.';

const feedPath = '=/feeds/{{ $parameter.feedId }}';

export const feedDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['feed'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a feed',
				description: 'Create a new feed',
				routing: {
					request: { method: 'POST', url: '/feeds' },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a feed',
				description: 'Delete a feed and its posts',
				routing: {
					request: { method: 'DELETE', url: feedPath },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'set', properties: { value: '={{ { "deleted": true } }}' } },
						],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a feed',
				description: 'Get a feed’s settings',
				routing: {
					request: { method: 'GET', url: feedPath },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
			{
				name: 'Get Embed Code',
				value: 'getEmbed',
				action: 'Get a feed embed code',
				description:
					'Get the JavaScript, iframe and WordPress snippets to show a feed on a website',
				routing: {
					request: { method: 'GET', url: `${feedPath}/embed` },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many feeds',
				description: 'List the feeds in your account',
				routing: {
					request: { method: 'GET', url: '/feeds' },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a feed',
				description: 'Change a feed’s name, sync frequency or moderation, including AI moderation',
				routing: {
					request: { method: 'PATCH', url: feedPath },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
		],
		default: 'getAll',
	},

	feedSelect({ resource: ['feed'], operation: ['delete', 'get', 'getEmbed', 'update'] }),

	// ── Create ─────────────────────────────────────────────────────
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Brand Mentions',
		displayOptions: { show: { resource: ['feed'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'name' } },
	},
	{
		displayName: 'Sync Interval',
		name: 'syncInterval',
		type: 'options',
		options: syncIntervalOptions,
		default: 'default',
		description: syncIntervalDescription,
		displayOptions: { show: { resource: ['feed'], operation: ['create'] } },
		routing: {
			send: {
				type: 'body',
				property: 'sync_interval',
				value: '={{ $value === "default" ? null : $value }}',
			},
		},
	},

	// ── Get ────────────────────────────────────────────────────────
	{
		displayName: 'Include Sources',
		name: 'includeSources',
		type: 'boolean',
		default: false,
		description: 'Whether to include the feed’s sources in the result',
		displayOptions: { show: { resource: ['feed'], operation: ['get'] } },
		routing: {
			send: {
				type: 'query',
				property: 'include',
				value: '={{ $value ? "sources" : undefined }}',
			},
		},
	},

	// ── Get Many ───────────────────────────────────────────────────
	...pagedListFields({ resource: ['feed'], operation: ['getAll'] }),

	// ── Update ─────────────────────────────────────────────────────
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['feed'], operation: ['update'] } },
		options: [
			{
				displayName: 'AI Harmful Content Filter',
				name: 'aiHarmfulContentFilter',
				type: 'boolean',
				default: true,
				description: 'Whether to hold posts flagged for hate, violence or sexual content',
				routing: { send: { type: 'body', property: 'ai_harmful_content_filter' } },
			},
			{
				displayName: 'AI Moderation',
				name: 'aiModeration',
				type: 'boolean',
				default: true,
				description:
					'Whether AI checks new posts before they go live. Needs at least one AI filter below and the Pro plan or higher.',
				routing: { send: { type: 'body', property: 'ai_moderation' } },
			},
			{
				displayName: 'AI Moderation Rules',
				name: 'aiModerationRules',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder: 'e.g. Only show posts about our coffee products',
				description: 'Plain-language rules the AI applies when deciding whether to keep a post',
				routing: { send: { type: 'body', property: 'ai_moderation_rules' } },
			},
			{
				displayName: 'AI Sentiment Filter',
				name: 'aiSentimentFilter',
				type: 'multiOptions',
				options: [
					{ name: 'Negative', value: 'negative' },
					{ name: 'Neutral', value: 'neutral' },
					{ name: 'Positive', value: 'positive' },
				],
				default: ['positive', 'neutral'],
				description:
					'Sentiments allowed to go live. Posts with any other sentiment wait in the moderation queue.',
				routing: { send: { type: 'body', property: 'ai_sentiment_filter' } },
			},
			{
				displayName: 'Blocked Words',
				name: 'disallowed',
				type: 'string',
				default: '',
				placeholder: 'e.g. spam, giveaway',
				description: 'Comma-separated words that hide a post',
				routing: { send: { type: 'body', property: 'disallowed' } },
			},
			{
				displayName: 'Moderation Queue',
				name: 'queue',
				type: 'boolean',
				default: true,
				description: 'Whether new posts wait for approval before they go live',
				routing: { send: { type: 'body', property: 'queue' } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'name' } },
			},
			{
				displayName: 'Prevent Duplicates',
				name: 'preventDuplicates',
				type: 'boolean',
				default: true,
				routing: { send: { type: 'body', property: 'prevent_duplicates' } },
			},
			{
				displayName: 'Profanity Filter',
				name: 'profanity',
				type: 'boolean',
				default: true,
				routing: { send: { type: 'body', property: 'profanity' } },
			},
			{
				displayName: 'Required Words',
				name: 'allowed',
				type: 'string',
				default: '',
				placeholder: 'e.g. coffee, espresso',
				description: 'Comma-separated words a post must contain to be shown',
				routing: { send: { type: 'body', property: 'allowed' } },
			},
			{
				displayName: 'Sync Interval',
				name: 'syncInterval',
				type: 'options',
				options: syncIntervalOptions,
				default: 'default',
				description: syncIntervalDescription,
				routing: {
					send: {
						type: 'body',
						property: 'sync_interval',
						value: '={{ $value === "default" ? null : $value }}',
					},
				},
			},
		],
	},
];
