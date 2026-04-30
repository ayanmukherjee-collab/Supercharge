import type {
    JsonNormalizer,
    NormalizedProviderResponse,
    ProviderUsage,
    StreamNormalizer,
} from './schema';

function normalizeUsage(usage: Partial<ProviderUsage> | undefined): ProviderUsage {
    return {
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
    };
}

function getOpenAIText(payload: any): string {
    return payload?.choices?.[0]?.message?.content ?? '';
}

function getAnthropicText(payload: any): string {
    const content = Array.isArray(payload?.content) ? payload.content : [];
    return content
        .filter((block: any) => block?.type === 'text')
        .map((block: any) => block.text ?? '')
        .join('');
}

function getGeminiText(payload: any): string {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => part?.text ?? '').join('');
}

function getCohereText(payload: any): string {
    const message = payload?.message;
    const content = Array.isArray(message?.content) ? message.content : [];
    return content
        .map((block: any) => block?.text ?? '')
        .join('');
}

function buildJsonNormalizer(
    getText: (payload: any) => string,
    getUsage: (payload: any) => Partial<ProviderUsage> | undefined
): JsonNormalizer {
    return {
        normalize(payload: unknown): NormalizedProviderResponse {
            const typedPayload = payload as any;
            return {
                text: getText(typedPayload),
                usage: normalizeUsage(getUsage(typedPayload)),
                raw: payload,
            };
        },
    };
}

export const jsonNormalizers: Record<string, JsonNormalizer> = {
    'openai-chat': buildJsonNormalizer(
        getOpenAIText,
        (payload) => ({
            prompt_tokens: payload?.usage?.prompt_tokens,
            completion_tokens: payload?.usage?.completion_tokens,
        })
    ),
    'anthropic-chat': buildJsonNormalizer(
        getAnthropicText,
        (payload) => ({
            prompt_tokens: payload?.usage?.input_tokens,
            completion_tokens: payload?.usage?.output_tokens,
        })
    ),
    'gemini-chat': buildJsonNormalizer(
        getGeminiText,
        (payload) => ({
            prompt_tokens: payload?.usageMetadata?.promptTokenCount,
            completion_tokens: payload?.usageMetadata?.candidatesTokenCount,
        })
    ),
    'cohere-chat': buildJsonNormalizer(
        getCohereText,
        (payload) => ({
            prompt_tokens: payload?.usage?.tokens?.input_tokens,
            completion_tokens: payload?.usage?.tokens?.output_tokens,
        })
    ),
};

export const streamNormalizers: Record<string, StreamNormalizer> = {
    'openai-chat': {
        parseChunk(payload: string) {
            if (payload === '[DONE]') {
                return { done: true };
            }

            const parsed = JSON.parse(payload);
            return {
                text: parsed?.choices?.[0]?.delta?.content ?? undefined,
                usage: parsed?.usage
                    ? {
                        prompt_tokens: parsed.usage.prompt_tokens,
                        completion_tokens: parsed.usage.completion_tokens,
                    }
                    : undefined,
            };
        },
    },
    'anthropic-chat': {
        parseChunk(payload: string) {
            const parsed = JSON.parse(payload);
            if (parsed?.type === 'content_block_delta') {
                return { text: parsed?.delta?.text ?? undefined };
            }
            if (parsed?.type === 'message_stop') {
                return { done: true };
            }
            if (parsed?.type === 'message_delta' && parsed?.usage) {
                return {
                    usage: {
                        prompt_tokens: parsed.usage.input_tokens,
                        completion_tokens: parsed.usage.output_tokens,
                    },
                };
            }
            return {};
        },
    },
    'gemini-chat': {
        parseChunk(payload: string) {
            const parsed = JSON.parse(payload);
            return {
                text: parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? undefined,
                usage: parsed?.usageMetadata
                    ? {
                        prompt_tokens: parsed.usageMetadata.promptTokenCount,
                        completion_tokens: parsed.usageMetadata.candidatesTokenCount,
                    }
                    : undefined,
            };
        },
    },
    'cohere-chat': {
        parseChunk(payload: string) {
            const parsed = JSON.parse(payload);
            if (parsed?.type === 'content-delta') {
                return { text: parsed?.delta?.message?.content?.text ?? undefined };
            }
            if (parsed?.type === 'message-end') {
                return {
                    done: true,
                    usage: parsed?.delta?.usage?.tokens
                        ? {
                            prompt_tokens: parsed.delta.usage.tokens.input_tokens,
                            completion_tokens: parsed.delta.usage.tokens.output_tokens,
                        }
                        : undefined,
                };
            }
            return {};
        },
    },
};
