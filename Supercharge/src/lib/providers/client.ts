import { interpolateTemplate } from './interpolate';
import { jsonNormalizers, streamNormalizers } from './normalizers';
import type {
    NormalizedProviderResponse,
    ProviderConfig,
    ProviderRequestContext,
    ProviderUsage,
} from './schema';

export interface ProviderChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ProviderChatRequest {
    config: ProviderConfig;
    apiKey: string;
    model: string;
    messages: ProviderChatMessage[];
    maxOutputTokens: number;
    extraContext?: Record<string, unknown>;
}

function buildAppReferer(): string {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'https://supercharge-app.vercel.app/' : `${window.location.origin}/`;
}

function joinUrl(baseUrl: string, path: string): string {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
    const next = Object.fromEntries(
        Object.entries(value).filter(([, entryValue]) => entryValue !== '' && entryValue !== null && entryValue !== undefined)
    );
    return next as T;
}

function compactTemplateValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((entry) => compactTemplateValue(entry)) as T;
    }

    if (value && typeof value === 'object') {
        const nextEntries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== '' && entryValue !== null && entryValue !== undefined)
            .map(([entryKey, entryValue]) => [entryKey, compactTemplateValue(entryValue)]);

        return Object.fromEntries(nextEntries) as T;
    }

    return value;
}

function createRequestContext(
    request: ProviderChatRequest,
    stream: boolean
): ProviderRequestContext & Record<string, unknown> {
    const systemMessage = request.messages.find((message) => message.role === 'system')?.content ?? '';
    const nonSystemMessages = request.messages.filter(
        (message): message is ProviderChatMessage & { role: 'user' | 'assistant' } => message.role !== 'system'
    );

    return {
        api_key: request.apiKey,
        model: request.model,
        stream,
        max_output_tokens: request.maxOutputTokens,
        messages: request.messages,
        non_system_messages: nonSystemMessages,
        system_message: systemMessage,
        anthropic_messages: nonSystemMessages.map((message) => ({ role: message.role, content: message.content })),
        cohere_messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
        gemini_contents: nonSystemMessages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
        })),
        gemini_system_instruction: systemMessage ? { parts: [{ text: systemMessage }] } : null,
        app_origin: window.location.origin,
        app_referer: buildAppReferer(),
        app_title: 'Supercharge',
        ...(request.extraContext ?? {}),
    };
}

function validateRequest(request: ProviderChatRequest): void {
    if (!request.config?.id) {
        throw new Error('Invalid provider config: missing id');
    }
    if (!request.config.endpoints.chat) {
        throw new Error(`Invalid provider config "${request.config.id}": missing chat endpoint`);
    }
    if (!request.config.requestTemplate.chat) {
        throw new Error(`Invalid provider config "${request.config.id}": missing chat request template`);
    }
    if (!request.apiKey?.trim()) {
        throw new Error(`Missing API key for provider "${request.config.label}"`);
    }
    if (!request.model?.trim()) {
        throw new Error(`Missing model for provider "${request.config.label}"`);
    }
}

function buildFetchRequest(request: ProviderChatRequest, stream: boolean): RequestInit & { url: string } {
    validateRequest(request);

    const context = createRequestContext(request, stream);
    const endpoint = request.config.endpoints.chat!;
    const method = endpoint.method ?? 'POST';
    const url = joinUrl(
        interpolateTemplate(request.config.baseUrl, context),
        interpolateTemplate(endpoint.path, context)
    );

    const headers = compactObject(interpolateTemplate(request.config.headers, context));
    const body = compactTemplateValue(interpolateTemplate(request.config.requestTemplate.chat!, context));

    return {
        url,
        method,
        headers,
        body: JSON.stringify(body),
    };
}

function mergeUsage(current: ProviderUsage, partial?: Partial<ProviderUsage>): ProviderUsage {
    return {
        prompt_tokens: partial?.prompt_tokens ?? current.prompt_tokens,
        completion_tokens: partial?.completion_tokens ?? current.completion_tokens,
    };
}

async function ensureOk(response: Response, providerLabel: string): Promise<void> {
    if (response.ok) return;

    const text = await response.text();
    throw new Error(`${providerLabel} API error ${response.status}: ${text}`);
}

export async function callProviderChat(request: ProviderChatRequest): Promise<NormalizedProviderResponse> {
    const fetchRequest = buildFetchRequest(request, false);
    const response = await fetch(fetchRequest.url, {
        method: fetchRequest.method,
        headers: fetchRequest.headers,
        body: fetchRequest.body,
    });

    await ensureOk(response, request.config.label);

    const payload = await response.json();
    const normalizer = jsonNormalizers[request.config.normalizer];
    if (!normalizer) {
        throw new Error(`Missing JSON normalizer "${request.config.normalizer}"`);
    }
    return normalizer.normalize(payload);
}

export async function* streamProviderChat(request: ProviderChatRequest): AsyncGenerator<string, NormalizedProviderResponse, unknown> {
    const fetchRequest = buildFetchRequest(request, true);
    const response = await fetch(fetchRequest.url, {
        method: fetchRequest.method,
        headers: fetchRequest.headers,
        body: fetchRequest.body,
    });

    await ensureOk(response, request.config.label);

    const normalizer = streamNormalizers[request.config.normalizer];
    if (!normalizer) {
        throw new Error(`Missing stream normalizer "${request.config.normalizer}"`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Bad response: missing readable body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let usage: ProviderUsage = { prompt_tokens: 0, completion_tokens: 0 };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (!trimmed.startsWith('data: ')) continue;

            const chunk = normalizer.parseChunk(trimmed.slice(6));
            usage = mergeUsage(usage, chunk.usage);

            if (chunk.text) {
                fullText += chunk.text;
                yield chunk.text;
            }
        }
    }

    if (buffer.trim().startsWith('data: ')) {
        const chunk = normalizer.parseChunk(buffer.trim().slice(6));
        usage = mergeUsage(usage, chunk.usage);
        if (chunk.text) {
            fullText += chunk.text;
            yield chunk.text;
        }
    }

    return {
        text: fullText,
        usage,
    };
}
