import type { INodeProperties } from 'n8n-workflow';
import { feedSelect, pagedListFields } from '../shared/descriptions';
import { throwOnJuicerError } from '../shared/transport';

const postsPath = '=/feeds/{{ $parameter.feedId }}/posts';
const postPath = `${postsPath}/{{ $parameter.postId }}`;

const unwrapData = [
	throwOnJuicerError,
	{ type: 'rootProperty' as const, properties: { property: 'data' } },
];

export const postDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['post'] } },
		options: [
			{
				name: 'Approve',
				value: 'approve',
				action: 'Approve a post',
				description: 'Make a moderated, rejected or deleted post public',
				routing: {
					request: { method: 'POST', url: `${postPath}/approve` },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a post',
				description: 'Get a single post from a feed',
				routing: {
					request: { method: 'GET', url: postPath },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many posts in a feed',
				description: 'List a feed’s posts, newest first, with filters',
				routing: {
					request: { method: 'GET', url: postsPath },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Reject',
				value: 'reject',
				action: 'Reject a post',
				description: 'Hide a post from the feed',
				routing: {
					request: { method: 'POST', url: `${postPath}/reject` },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search posts across feeds',
				description: 'Find posts whose text or author contains a word, across one or more feeds',
				routing: {
					request: { method: 'GET', url: '/search/posts' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	feedSelect({ resource: ['post'], operation: ['approve', 'get', 'getAll', 'reject'] }),

	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 123456789',
		displayOptions: { show: { resource: ['post'], operation: ['approve', 'get', 'reject'] } },
	},

	// ── Get Many ───────────────────────────────────────────────────
	...pagedListFields({ resource: ['post'], operation: ['getAll'] }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['post'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'After',
				name: 'startingAt',
				type: 'dateTime',
				default: '',
				description: 'Only posts published after this time',
				routing: { send: { type: 'query', property: 'starting_at' } },
			},
			{
				displayName: 'Before',
				name: 'endingAt',
				type: 'dateTime',
				default: '',
				description: 'Only posts published before this time',
				routing: { send: { type: 'query', property: 'ending_at' } },
			},
			{
				displayName: 'Search Text',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Only posts whose text or author name contains this',
				routing: { send: { type: 'query', property: 'search' } },
			},
			{
				displayName: 'Sources',
				name: 'sources',
				type: 'string',
				default: '',
				placeholder: 'e.g. 12345,67890',
				description:
					'Comma-separated source IDs, source terms or platform names to limit results to',
				routing: { send: { type: 'query', property: 'filter' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Public', value: 'public' },
					{ name: 'Waiting for Moderation', value: 'moderated' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: 'public',
				routing: { send: { type: 'query', property: 'status' } },
			},
		],
	},

	// ── Search ─────────────────────────────────────────────────────
	{
		displayName: 'Search Text',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. refund',
		description: 'Posts whose text or author name contains this',
		displayOptions: { show: { resource: ['post'], operation: ['search'] } },
		routing: { send: { type: 'query', property: 'query' } },
	},
	{
		// Required because an account-wide text search reads every post and times out on big accounts.
		displayName: 'Feed Names or IDs',
		name: 'feedIds',
		type: 'multiOptions',
		required: true,
		typeOptions: { loadOptionsMethod: 'getFeedOptions' },
		default: [],
		description:
			'Feeds to search in. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['post'], operation: ['search'] } },
		routing: {
			send: {
				type: 'query',
				property: 'feed_ids',
				value: '={{ [].concat($value).join(",") }}',
			},
		},
	},
	...pagedListFields({ resource: ['post'], operation: ['search'] }),
	{
		displayName: 'Filters',
		name: 'searchFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['post'], operation: ['search'] } },
		options: [
			{
				displayName: 'After',
				name: 'startingAt',
				type: 'dateTime',
				default: '',
				description: 'Only posts published after this time',
				routing: { send: { type: 'query', property: 'starting_at' } },
			},
			{
				displayName: 'Before',
				name: 'endingAt',
				type: 'dateTime',
				default: '',
				description: 'Only posts published before this time',
				routing: { send: { type: 'query', property: 'ending_at' } },
			},
			{
				displayName: 'Platform Names or IDs',
				name: 'platforms',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getPlatforms' },
				default: [],
				description:
					'Only posts from sources on these platforms. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: {
					send: {
						type: 'query',
						property: 'platforms',
						value: '={{ [].concat($value).join(",") || undefined }}',
					},
				},
			},
		],
	},
];
