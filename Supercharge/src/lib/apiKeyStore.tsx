import { createContext, useContext, useReducer, useEffect, useCallback, useState, type ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────

export type ModelFamilyId =
    | 'openai' | 'anthropic' | 'gemini'
    | 'deepseek' | 'mistral' | 'groq' | 'perplexity'
    | 'xai' | 'cohere' | 'llama' | 'qwen';

export type SourceType = 'official' | 'openrouter';

export type ApiFormat = 'openai' | 'anthropic' | 'gemini' | 'cohere';

/** How to reach a model through a given source (official API vs OpenRouter) */
export interface SourceConfig {
    sourceType: SourceType;
    label: string;                     // "Official" or "OpenRouter"
    apiFormat: ApiFormat;
    endpoint: string;                  // full URL or proxy path
    /** Maps family model value → the ID used by this source */
    modelMap?: Record<string, string>;
    comingSoon?: boolean;
}

export interface ModelVariant {
    value: string;   // canonical model id (used as key for modelMap)
    label: string;   // human label
}

export interface ModelFamily {
    id: ModelFamilyId;
    name: string;
    color: string;
    popular: boolean;
    description: string;
    variants: ModelVariant[];
    sources: SourceConfig[];
}

export interface ApiProvider {
    id: string;
    family: ModelFamilyId;
    source: SourceType;
    label: string;
    apiKey: string;
    model: string;       // the canonical model value
}

// ── Model Families Registry ────────────────────────────────────

const OR = 'https://openrouter.ai/api';  // OpenRouter base

export const MODEL_FAMILIES: ModelFamily[] = [
    {
        id: 'openai',
        name: 'GPT (OpenAI)',
        color: '#10a37f',
        popular: true,
        description: 'GPT-4o, o3, GPT-4 Turbo',
        variants: [
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            { value: 'o3-mini', label: 'o3 Mini' },
            { value: 'o1', label: 'o1' },
            { value: 'o1-mini', label: 'o1 Mini' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '/api/openai' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'gpt-4o': 'openai/gpt-4o', 'gpt-4o-mini': 'openai/gpt-4o-mini', 'o3-mini': 'openai/o3-mini', 'o1': 'openai/o1', 'o1-mini': 'openai/o1-mini', 'gpt-4-turbo': 'openai/gpt-4-turbo', 'gpt-3.5-turbo': 'openai/gpt-3.5-turbo' }
            },
        ],
    },
    {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        color: '#d4a574',
        popular: true,
        description: 'Claude Sonnet 4, Opus, Haiku',
        variants: [
            { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
            { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
            { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
            { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'anthropic', endpoint: '/api/anthropic' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4', 'claude-3-5-sonnet-20241022': 'anthropic/claude-3.5-sonnet', 'claude-3-5-haiku-20241022': 'anthropic/claude-3.5-haiku', 'claude-3-opus-20240229': 'anthropic/claude-3-opus' }
            },
        ],
    },
    {
        id: 'gemini',
        name: 'Gemini (Google)',
        color: '#4285f4',
        popular: true,
        description: 'Gemini 2.5 Pro, 2.5 Flash',
        variants: [
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'gemini', endpoint: '' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'gemini-2.5-pro': 'google/gemini-2.5-pro-preview', 'gemini-2.5-flash': 'google/gemini-2.5-flash-preview', 'gemini-2.0-flash': 'google/gemini-2.0-flash-001', 'gemini-1.5-pro': 'google/gemini-pro-1.5' }
            },
        ],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        color: '#4d6bfe',
        popular: false,
        description: 'DeepSeek V3, R1 Reasoner',
        variants: [
            { value: 'deepseek-chat', label: 'DeepSeek V3' },
            { value: 'deepseek-reasoner', label: 'DeepSeek R1' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: 'https://api.deepseek.com' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'deepseek-chat': 'deepseek/deepseek-chat', 'deepseek-reasoner': 'deepseek/deepseek-r1-0528:free' }
            },
        ],
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        color: '#ff7000',
        popular: false,
        description: 'Mistral Large, Small, Codestral',
        variants: [
            { value: 'mistral-large-latest', label: 'Mistral Large' },
            { value: 'mistral-small-latest', label: 'Mistral Small' },
            { value: 'codestral-latest', label: 'Codestral' },
            { value: 'open-mistral-nemo', label: 'Mistral Nemo' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '/api/mistral' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'mistral-large-latest': 'mistralai/mistral-large-latest', 'mistral-small-latest': 'mistralai/mistral-small-latest', 'codestral-latest': 'mistralai/codestral-latest', 'open-mistral-nemo': 'mistralai/mistral-nemo' }
            },
        ],
    },
    {
        id: 'llama',
        name: 'Llama (Meta)',
        color: '#1877f2',
        popular: false,
        description: 'Llama 3.3 70B, Llama 3.1',
        variants: [
            { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
            { value: 'llama-3.1-405b', label: 'Llama 3.1 405B' },
            { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '', comingSoon: true },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct', 'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct', 'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct' }
            },
        ],
    },
    {
        id: 'qwen',
        name: 'Qwen (Alibaba)',
        color: '#6366f1',
        popular: false,
        description: 'Qwen 2.5 72B, Qwen 2.5 Coder',
        variants: [
            { value: 'qwen-2.5-72b', label: 'Qwen 2.5 72B' },
            { value: 'qwen-2.5-coder-32b', label: 'Qwen 2.5 Coder 32B' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '', comingSoon: true },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'qwen-2.5-72b': 'qwen/qwen-2.5-72b-instruct', 'qwen-2.5-coder-32b': 'qwen/qwen-2.5-coder-32b-instruct' }
            },
        ],
    },
    {
        id: 'groq',
        name: 'Groq',
        color: '#f55036',
        popular: false,
        description: 'Ultra-fast inference engine',
        variants: [
            { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
            { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
            { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '/api/groq' },
            { sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR, comingSoon: true },
        ],
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        color: '#20b2aa',
        popular: false,
        description: 'Sonar search-augmented models',
        variants: [
            { value: 'sonar-pro', label: 'Sonar Pro' },
            { value: 'sonar', label: 'Sonar' },
            { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '/api/perplexity' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'sonar-pro': 'perplexity/sonar-pro', 'sonar': 'perplexity/sonar', 'sonar-reasoning-pro': 'perplexity/sonar-reasoning-pro' }
            },
        ],
    },
    {
        id: 'xai',
        name: 'Grok (xAI)',
        color: '#ffffff',
        popular: false,
        description: 'Grok-2 and Grok-2 Mini',
        variants: [
            { value: 'grok-2-latest', label: 'Grok-2' },
            { value: 'grok-2-mini', label: 'Grok-2 Mini' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'openai', endpoint: '/api/xai' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'grok-2-latest': 'x-ai/grok-2-latest', 'grok-2-mini': 'x-ai/grok-2-mini' }
            },
        ],
    },
    {
        id: 'cohere',
        name: 'Cohere',
        color: '#39d98a',
        popular: false,
        description: 'Command R+, Command A',
        variants: [
            { value: 'command-a-08-2025', label: 'Command A' },
            { value: 'command-r-plus-08-2024', label: 'Command R+' },
            { value: 'command-r-08-2024', label: 'Command R' },
        ],
        sources: [
            { sourceType: 'official', label: 'Official', apiFormat: 'cohere', endpoint: '/api/cohere' },
            {
                sourceType: 'openrouter', label: 'OpenRouter', apiFormat: 'openai', endpoint: OR,
                modelMap: { 'command-a-08-2025': 'cohere/command-a-08-2025', 'command-r-plus-08-2024': 'cohere/command-r-plus-08-2024', 'command-r-08-2024': 'cohere/command-r-08-2024' }
            },
        ],
    },
];

// ── Lookup helpers ─────────────────────────────────────────────

export function getModelFamily(id: ModelFamilyId): ModelFamily {
    return MODEL_FAMILIES.find((f) => f.id === id) || MODEL_FAMILIES[0];
}

export function getPopularFamilies(): ModelFamily[] {
    return MODEL_FAMILIES.filter((f) => f.popular);
}

export function searchFamilies(query: string): ModelFamily[] {
    const q = query.toLowerCase().trim();
    if (!q) return MODEL_FAMILIES;
    return MODEL_FAMILIES.filter(
        (f) =>
            f.name.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            f.id.includes(q) ||
            f.variants.some((v) => v.label.toLowerCase().includes(q))
    );
}

/** Given a saved provider, resolve the actual model ID and source config for the chat service */
export function resolveProviderRouting(provider: ApiProvider): {
    apiFormat: ApiFormat;
    endpoint: string;
    modelId: string;      // the actual model ID to send to the API
    familyId: ModelFamilyId;
} {
    const family = getModelFamily(provider.family);
    const source = family.sources.find((s) => s.sourceType === provider.source)!;
    const modelId = source.modelMap?.[provider.model] ?? provider.model;
    return { apiFormat: source.apiFormat, endpoint: source.endpoint, modelId, familyId: family.id };
}

// Legacy compat: re-export as PROVIDER_INFO for other components
export const PROVIDER_INFO: Record<string, { name: string; color: string }> = Object.fromEntries(
    MODEL_FAMILIES.map((f) => [f.id, { name: f.name, color: f.color }])
);

// ── Reducer ────────────────────────────────────────────────────

type Action =
    | { type: 'SET_ALL'; providers: ApiProvider[] }
    | { type: 'ADD_PROVIDER'; provider: ApiProvider }
    | { type: 'UPDATE_PROVIDER'; provider: ApiProvider }
    | { type: 'DELETE_PROVIDER'; id: string };

function reducer(state: ApiProvider[], action: Action): ApiProvider[] {
    switch (action.type) {
        case 'SET_ALL':
            return action.providers;
        case 'ADD_PROVIDER':
            return [...state, action.provider];
        case 'UPDATE_PROVIDER':
            return state.map((p) => (p.id === action.provider.id ? action.provider : p));
        case 'DELETE_PROVIDER':
            return state.filter((p) => p.id !== action.id);
        default:
            return state;
    }
}

// ── Storage helpers ────────────────────────────────────────────

const STORAGE_KEY = 'supercharge_api_keys';

function loadProviders(): ApiProvider[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.map((p: any) => {
            if (p.provider && !p.family) {
                // Migrate from old format
                let family = p.provider;
                let source = 'official';

                if (p.provider === 'openrouter') {
                    source = 'openrouter';
                    if (p.model.includes('deepseek')) family = 'deepseek';
                    else if (p.model.includes('anthropic')) family = 'anthropic';
                    else if (p.model.includes('gemini') || p.model.includes('google')) family = 'gemini';
                    else if (p.model.includes('mistral')) family = 'mistral';
                    else if (p.model.includes('llama')) family = 'llama';
                    else if (p.model.includes('qwen')) family = 'qwen';
                    else family = 'openai';
                } else if (['together', 'fireworks', 'cerebras', 'sambanova'].includes(p.provider)) {
                    family = 'llama';
                } else if (!['openai', 'anthropic', 'gemini', 'deepseek', 'mistral', 'groq', 'perplexity', 'xai', 'cohere', 'llama', 'qwen'].includes(family)) {
                    family = 'openai';
                }

                return {
                    id: p.id,
                    family,
                    source,
                    label: p.label,
                    apiKey: p.apiKey,
                    model: p.model
                };
            }
            return p;
        }).filter((p: any) => p.family && p.source);
    } catch {
        return [];
    }
}

function saveProviders(providers: ApiProvider[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

// ── Context ────────────────────────────────────────────────────

interface ApiKeyStoreContextValue {
    providers: ApiProvider[];
    addProvider: (provider: Omit<ApiProvider, 'id'>) => ApiProvider;
    updateProvider: (provider: ApiProvider) => void;
    deleteProvider: (id: string) => void;
    getProvider: (id: string) => ApiProvider | undefined;
    activeProviderId: string | null;
    setActiveProviderId: (id: string | null) => void;
}

const ApiKeyStoreContext = createContext<ApiKeyStoreContextValue | null>(null);

export function ApiKeyStoreProvider({ children }: { children: ReactNode }) {
    const [providers, dispatch] = useReducer(reducer, [], loadProviders);
    const [activeProviderId, setActiveProviderId] = useState<string | null>(() => {
        return localStorage.getItem('supercharge_active_provider') || null;
    });

    useEffect(() => {
        if (activeProviderId) {
            localStorage.setItem('supercharge_active_provider', activeProviderId);
        } else {
            localStorage.removeItem('supercharge_active_provider');
        }
    }, [activeProviderId]);

    useEffect(() => {
        saveProviders(providers);
    }, [providers]);

    const addProvider = useCallback((data: Omit<ApiProvider, 'id'>) => {
        const provider: ApiProvider = { ...data, id: crypto.randomUUID() };
        dispatch({ type: 'ADD_PROVIDER', provider });
        setActiveProviderId(provider.id);
        return provider;
    }, []);

    const updateProvider = useCallback((provider: ApiProvider) => {
        dispatch({ type: 'UPDATE_PROVIDER', provider });
    }, []);

    const deleteProvider = useCallback((id: string) => {
        dispatch({ type: 'DELETE_PROVIDER', id });
        setActiveProviderId(prev => prev === id ? null : prev);
    }, []);

    const getProvider = useCallback(
        (id: string) => providers.find((p) => p.id === id),
        [providers]
    );

    return (
        <ApiKeyStoreContext.Provider value={{ providers, addProvider, updateProvider, deleteProvider, getProvider, activeProviderId, setActiveProviderId }}>
            {children}
        </ApiKeyStoreContext.Provider>
    );
}

export function useApiKeyStore() {
    const ctx = useContext(ApiKeyStoreContext);
    if (!ctx) throw new Error('useApiKeyStore must be used within ApiKeyStoreProvider');
    return ctx;
}
