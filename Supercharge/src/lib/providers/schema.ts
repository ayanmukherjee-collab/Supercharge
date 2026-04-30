export type ProviderEndpointId = 'chat' | 'embeddings';

export type ProviderHttpMethod = 'POST';

export interface ProviderEndpointConfig {
    path: string;
    method?: ProviderHttpMethod;
    responseMode?: 'json' | 'sse';
}

export interface ProviderRequestTemplates {
    chat?: Record<string, unknown>;
    embeddings?: Record<string, unknown>;
}

export interface ProviderConfig {
    id: string;
    label: string;
    baseUrl: string;
    headers: Record<string, string>;
    endpoints: Partial<Record<ProviderEndpointId, ProviderEndpointConfig>>;
    requestTemplate: ProviderRequestTemplates;
    normalizer: string;
}

export interface ProviderUsage {
    prompt_tokens: number;
    completion_tokens: number;
}

export interface NormalizedProviderResponse {
    text: string;
    usage: ProviderUsage;
    raw?: unknown;
}

export interface ProviderRequestContext {
    api_key: string;
    model: string;
    stream: boolean;
    max_output_tokens: number;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    non_system_messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system_message: string;
    anthropic_messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    cohere_messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    gemini_contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    gemini_system_instruction: { parts: Array<{ text: string }> } | null;
    app_origin: string;
    app_referer: string;
    app_title: string;
}

export interface StreamNormalizer {
    parseChunk: (payload: string) => { text?: string; usage?: Partial<ProviderUsage>; done?: boolean };
}

export interface JsonNormalizer {
    normalize: (payload: unknown) => NormalizedProviderResponse;
}
