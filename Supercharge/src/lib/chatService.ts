import type { ApiProvider } from './apiKeyStore';
import { resolveProviderRouting } from './apiKeyStore';
import { streamProviderChat } from './providers/client';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const DEFAULT_HISTORY_TURNS = 15;
const MAX_OUTPUT_TOKENS = 1024;

function trimHistory(messages: ChatMessage[], maxTurns: number = DEFAULT_HISTORY_TURNS): ChatMessage[] {
    const systemMessage = messages[0]?.role === 'system' ? [messages[0]] : [];
    const chatMessages = messages.filter((message) => message.role !== 'system');
    const maxMessages = maxTurns * 2;
    const trimmedMessages = chatMessages.length > maxMessages ? chatMessages.slice(-maxMessages) : chatMessages;

    return [...systemMessage, ...trimmedMessages];
}

export async function* sendMessage(
    provider: ApiProvider,
    messages: ChatMessage[],
    pmlSystemPrompt?: string,
    slideWindowSize: number = DEFAULT_HISTORY_TURNS
): AsyncGenerator<string, void, unknown> {
    const { config, modelId } = resolveProviderRouting(provider);

    let messagesWithSystem = messages;
    if (pmlSystemPrompt) {
        const nonSystemMessages = messages.filter((message) => message.role !== 'system');
        messagesWithSystem = [{ role: 'system' as const, content: pmlSystemPrompt }, ...nonSystemMessages];
    }

    const trimmedMessages = trimHistory(messagesWithSystem, slideWindowSize);
    const stream = streamProviderChat({
        config,
        apiKey: provider.apiKey,
        model: modelId,
        messages: trimmedMessages,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    for await (const chunk of stream) {
        yield chunk;
    }
}
