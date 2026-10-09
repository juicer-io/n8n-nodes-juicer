import type { INodeProperties } from 'n8n-workflow';
import { feedSelect, pagedListFields } from '../shared/descriptions';
import { throwOnJuicerError } from '../shared/transport';

const sourcesPath = '=/feeds/{{ $parameter.feedId }}/sources';

export const sourceDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['source'] } },
		options: [
			{
				name: 'Add',
				value: 'create',
				action: 'Add a source to a feed',
				description:
					'Add a handle, hashtag or keyword to a feed. Juicer then syncs it in the background on the feed’s schedule.',
				routing: {
					request: { method: 'POST', url: sourcesPath },
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
				action: 'Get many sources in a feed',
				description: 'List a feed’s sources',
				routing: {
					request: { method: 'GET', url: sourcesPath },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'rootProperty', properties: { property: 'data' } },
						],
					},
				},
			},
			{
				name: 'Remove',
				value: 'delete',
				action: 'Remove a source from a feed',
				description: 'Remove a source from a feed',
				routing: {
					request: { method: 'DELETE', url: `${sourcesPath}/{{ $parameter.sourceId }}` },
					output: {
						postReceive: [
							throwOnJuicerError,
							{ type: 'set', properties: { value: '={{ { "deleted": true } }}' } },
						],
					},
				},
			},
		],
		default: 'create',
	},

	feedSelect({ resource: ['source'], operation: ['create', 'delete', 'getAll'] }),

	// ── Add ────────────────────────────────────────────────────────
	{
		displayName: 'Platform Name or ID',
		name: 'platform',
		type: 'options',
		required: true,
		typeOptions: { loadOptionsMethod: 'getPlatforms' },
		default: '',
		description:
			'The platform to pull posts from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['source'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'platform' } },
	},
	{
		displayName: 'Term',
		name: 'term',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. nasa, #coffee or "your brand"',
		description: 'The handle, hashtag, keyword or URL to follow',
		displayOptions: { show: { resource: ['source'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'term' } },
	},
	{
		displayName: 'Term Type Name or ID',
		name: 'termType',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getTermTypes',
			loadOptionsDependsOn: ['platform'],
		},
		default: '',
		description:
			'How to read the term on this platform, for example a username, a hashtag or a keyword search. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['source'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'term_type' } },
	},

	// ── Remove ─────────────────────────────────────────────────────
	{
		displayName: 'Source ID',
		name: 'sourceId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 67890',
		description: 'The ID of the source to remove, as returned by Get Many or Add',
		displayOptions: { show: { resource: ['source'], operation: ['delete'] } },
	},

	// ── Get Many ───────────────────────────────────────────────────
	...pagedListFields({ resource: ['source'], operation: ['getAll'] }),
];
