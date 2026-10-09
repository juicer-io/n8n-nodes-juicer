import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class JuicerApi implements ICredentialType {
	name = 'juicerApi';

	displayName = 'Juicer API';

	icon: Icon = { light: 'file:../icons/juicer.svg', dark: 'file:../icons/juicer.dark.svg' };

	documentationUrl = 'https://developers.juicer.io/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'jcr_...',
			description:
				'Create a permanent key on the Developer page of your Juicer dashboard. Keys from the email-based quick start expire, so do not use them for scheduled workflows.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.juicer.io/v1',
			url: '/account',
			method: 'GET',
		},
	};
}
