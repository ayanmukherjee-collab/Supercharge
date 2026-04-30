const EXACT_PLACEHOLDER = /^\{([a-zA-Z0-9_]+)\}$/;
const INLINE_PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

function assertDefined(key: string, value: unknown): unknown {
    if (value === undefined || value === null) {
        throw new Error(`Missing interpolation value for "${key}"`);
    }
    return value;
}

function interpolateString(template: string, values: Record<string, unknown>): unknown {
    const exactMatch = template.match(EXACT_PLACEHOLDER);
    if (exactMatch) {
        return assertDefined(exactMatch[1], values[exactMatch[1]]);
    }

    return template.replace(INLINE_PLACEHOLDER, (_, key: string) => {
        const value = assertDefined(key, values[key]);
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        throw new Error(`Placeholder "${key}" must resolve to a primitive when used inside a string`);
    });
}

export function interpolateTemplate<T>(template: T, values: Record<string, unknown>): T {
    if (typeof template === 'string') {
        return interpolateString(template, values) as T;
    }

    if (Array.isArray(template)) {
        return template.map((item) => interpolateTemplate(item, values)) as T;
    }

    if (template && typeof template === 'object') {
        const entries = Object.entries(template as Record<string, unknown>).map(([key, value]) => [
            key,
            interpolateTemplate(value, values),
        ]);
        return Object.fromEntries(entries) as T;
    }

    return template;
}
