import type { ApiProvider } from './apiKeyStore';
import { resolveProviderRouting } from './apiKeyStore';

// ── Types ──────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// ── Main entry point ───────────────────────────────────────────

export async function* sendMessage(
    provider: ApiProvider,
    messages: ChatMessage[]
): AsyncGenerator<string, void, unknown> {
    const { apiFormat, endpoint, modelId } = resolveProviderRouting(provider);

    switch (apiFormat) {
        case 'openai':
            yield* streamOpenAICompat(endpoint, provider.apiKey, modelId, messages, provider.source);
            break;
        case 'anthropic':
            yield* streamAnthropic(endpoint, provider.apiKey, modelId, messages);
            break;
        case 'gemini':
            yield* streamGemini(provider.apiKey, modelId, messages);
            break;
        case 'cohere':
            yield* streamCohere(endpoint, provider.apiKey, modelId, messages);
            break;
        default:
            throw new Error(`Unknown API format: ${apiFormat}`);
    }
}

// ── Generic OpenAI-Compatible ──────────────────────────────────

async function* streamOpenAICompat(
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    source: string
): AsyncGenerator<string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
    };

    // OpenRouter requires referer + title headers
    if (source === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin + '/';
        headers['X-Title'] = 'Supercharge';
    }

    const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error ${res.status}: ${err}`);
    }

    yield* readSSE(res, (data) => {
        if (data === '[DONE]') return null;
        try {
            const parsed = JSON.parse(data);
            return parsed.choices?.[0]?.delta?.content ?? null;
        } catch {
            return null;
        }
    });
}

// ── Anthropic ──────────────────────────────────────────────────

async function* streamAnthropic(
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[]
): AsyncGenerator<string> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        stream: true,
        messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch(`${endpoint}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${err}`);
    }

    yield* readSSE(res, (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
                return parsed.delta?.text ?? null;
            }
            return null;
        } catch {
            return null;
        }
    });
}

// ── Gemini ─────────────────────────────────────────────────────

async function* streamGemini(
    apiKey: string,
    model: string,
    messages: ChatMessage[]
): AsyncGenerator<string> {
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const systemInstruction = messages.find((m) => m.role === 'system');
    const body: Record<string, unknown> = { contents };
    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini error ${res.status}: ${err}`);
    }

    yield* readSSE(res, (data) => {
        try {
            const parsed = JSON.parse(data);
            return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        } catch {
            return null;
        }
    });
}

// ── Cohere ─────────────────────────────────────────────────────

async function* streamCohere(
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[]
): AsyncGenerator<string> {
    const res = await fetch(`${endpoint}/v2/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cohere error ${res.status}: ${err}`);
    }

    yield* readSSE(res, (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content-delta') {
                return parsed.delta?.message?.content?.text ?? null;
            }
            return null;
        } catch {
            return null;
        }
    });
}

// ── SSE Reader ─────────────────────────────────────────────────

async function* readSSE(
    response: Response,
    extractText: (data: string) => string | null
): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                const text = extractText(data);
                if (text) yield text;
            }
        }
    }

    if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            const text = extractText(data);
            if (text) yield text;
        }
    }
}
