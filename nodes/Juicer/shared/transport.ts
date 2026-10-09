import {
	NodeApiError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';

export const JUICER_API_BASE_URL = 'https://api.juicer.io/v1';

// The Juicer API reads this header to attribute traffic by client. Any value other
// than `mcp` is billed as ordinary API usage, so `n8n` only changes attribution.
export const JUICER_CLIENT_HEADERS = {
	'X-Juicer-Client': 'n8n',
};

type JuicerErrorBody = {
	error?: {
		code?: string;
		message?: string;
		details?: Record<string, string[]> | null;
		action?: {
			type?: string;
			upgrade_url?: string;
			connection_url?: string;
			checkout_url?: string;
		} | null;
	};
};

function actionLink(body: JuicerErrorBody): string | undefined {
	const action = body.error?.action;
	if (!action) return undefined;
	return action.checkout_url ?? action.upgrade_url ?? action.connection_url;
}

export function describeJuicerError(
	body: JuicerErrorBody,
	statusCode: number,
): {
	message: string;
	description: string;
} {
	const code = body.error?.code ?? `http_${statusCode}`;
	const message = body.error?.message ?? `The Juicer API returned HTTP ${statusCode}`;
	const details = body.error?.details
		? Object.entries(body.error.details)
				.map(([field, problems]) => `${field}: ${problems.join(', ')}`)
				.join('; ')
		: undefined;
	const link = actionLink(body);

	const hints: Record<string, string> = {
		unauthorized: 'Check the API key in your Juicer credential.',
		insufficient_credits: 'Your Juicer API credit balance is too low for this request.',
		social_account_required: 'This platform needs a connected social account in Juicer.',
		feed_limit_reached: 'Your Juicer plan does not allow more feeds.',
		source_limit_reached: 'This feed has reached its source limit.',
	};

	const description = [
		hints[code],
		details,
		link ? `Fix it here: ${link}` : undefined,
		`Error code: ${code}`,
	]
		.filter(Boolean)
		.join(' ');

	return { message, description };
}

// Declarative routes set `ignoreHttpStatusErrors` so this runs first on every response
// and turns Juicer's error envelope into a readable n8n error with the fix link.
export async function throwOnJuicerError(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (response.statusCode < 400) return items;

	const body = (response.body ?? {}) as JuicerErrorBody;
	const { message, description } = describeJuicerError(body, response.statusCode);

	throw new NodeApiError(this.getNode(), body as JsonObject, {
		message,
		description,
		httpCode: String(response.statusCode),
	});
}

export async function juicerApiRequest(
	this: IHookFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${JUICER_API_BASE_URL}${endpoint}`,
		headers: { Accept: 'application/json', ...JUICER_CLIENT_HEADERS },
		qs,
		body,
		json: true,
	};

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'juicerApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
