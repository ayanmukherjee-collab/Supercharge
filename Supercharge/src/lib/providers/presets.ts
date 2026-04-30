import type { ProviderConfig } from './schema';

export const PROVIDER_CONFIGS: ProviderConfig[] = [
    {
        id: 'openai-official',
        label: 'OpenAI Official',
        baseUrl: '/api/openai',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
            'HTTP-Referer': '{app_referer}',
            'X-Title': '{app_title}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'deepseek-official',
        label: 'DeepSeek Official',
        baseUrl: 'https://api.deepseek.com',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'mistral-official',
        label: 'Mistral Official',
        baseUrl: '/api/mistral',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'groq-official',
        label: 'Groq Official',
        baseUrl: '/api/groq',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'perplexity-official',
        label: 'Perplexity Official',
        baseUrl: '/api/perplexity',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'xai-official',
        label: 'xAI Official',
        baseUrl: '/api/xai',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
    {
        id: 'anthropic-official',
        label: 'Anthropic Official',
        baseUrl: '/api/anthropic',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': '{api_key}',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        endpoints: {
            chat: { path: '/v1/messages', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                max_tokens: '{max_output_tokens}',
                stream: '{stream}',
                messages: '{anthropic_messages}',
                system: '{system_message}',
            },
        },
        normalizer: 'anthropic-chat',
    },
    {
        id: 'gemini-official',
        label: 'Gemini Official',
        baseUrl: 'https://generativelanguage.googleapis.com',
        headers: {
            'Content-Type': 'application/json',
        },
        endpoints: {
            chat: { path: '/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                contents: '{gemini_contents}',
                generationConfig: {
                    maxOutputTokens: '{max_output_tokens}',
                },
                systemInstruction: '{gemini_system_instruction}',
            },
        },
        normalizer: 'gemini-chat',
    },
    {
        id: 'cohere-official',
        label: 'Cohere Official',
        baseUrl: '/api/cohere',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v2/chat', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{cohere_messages}',
                stream: '{stream}',
            },
        },
        normalizer: 'cohere-chat',
    },
    {
        id: 'openai-compatible-custom',
        label: 'Custom OpenAI Compatible',
        baseUrl: '{base_url}',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {api_key}',
        },
        endpoints: {
            chat: { path: '/v1/chat/completions', method: 'POST', responseMode: 'sse' },
        },
        requestTemplate: {
            chat: {
                model: '{model}',
                messages: '{messages}',
                stream: '{stream}',
                max_tokens: '{max_output_tokens}',
            },
        },
        normalizer: 'openai-chat',
    },
];
