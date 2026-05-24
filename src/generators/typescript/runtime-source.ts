export const RUNTIME_SOURCE = `/* Auto-generated runtime. Do not edit. */

export interface ClientConfig {
    apiKey?: string;
    baseURL?: string;
}

export interface RequestOptions {
    query?: Record<string, unknown>;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

export type CallOptions = Omit<RequestOptions, 'query' | 'body'>;

export class SDKError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly body: unknown;
    readonly response: Response;

    constructor(status: number, statusText: string, body: unknown, response: Response) {
        super(\`HTTP \${status} \${statusText}\`);
        this.name = 'SDKError';
        this.status = status;
        this.statusText = statusText;
        this.body = body;
        this.response = response;
    }
}

export async function request<T>(
    config: ClientConfig,
    method: string,
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    const baseURL = config.baseURL;
    if (!baseURL) throw new Error('SDKClient: missing baseURL');

    const url = new URL(path.replace(/^\\//, ''), baseURL.endsWith('/') ? baseURL : baseURL + '/');
    if (opts.query) {
        for (const [k, v] of Object.entries(opts.query)) {
            if (v === undefined || v === null) continue;
            if (Array.isArray(v)) {
                for (const item of v) {
                    url.searchParams.append(k, String(item));
                }
            } else {
                url.searchParams.append(k, String(v));
            }
        }
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (config.apiKey) headers['Authorization'] = \`Bearer \${config.apiKey}\`;

    const response = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
    });

    let body: unknown = undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (response.status !== 204 && contentType.includes('application/json')) {
        try {
            body = await response.json();
        } catch {
            /* malformed JSON body; leave body as undefined */
        }
    } else if (response.status !== 204) {
        body = await response.text();
    }

    if (!response.ok) {
        throw new SDKError(response.status, response.statusText, body, response);
    }

    return body as T;
}
`
