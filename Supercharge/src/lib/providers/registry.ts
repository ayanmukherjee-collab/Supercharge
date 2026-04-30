import { PROVIDER_CONFIGS } from './presets';
import type { ProviderConfig } from './schema';

const configMap = new Map(PROVIDER_CONFIGS.map((config) => [config.id, config]));

export function getProviderConfig(configId: string): ProviderConfig {
    const config = configMap.get(configId);
    if (!config) {
        throw new Error(`Unknown provider config "${configId}"`);
    }
    return config;
}

export function listProviderConfigs(): ProviderConfig[] {
    return PROVIDER_CONFIGS;
}
