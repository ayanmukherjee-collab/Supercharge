/**
 * pmlParser.ts
 * Core PML (Personal Memory Language) parser — pure logic, no DB connections.
 * Implements PML v2.0 specification as defined in the Supercharge PRD.
 */

// 1. TYPE DEFINITIONS

/** All 10 category hashes supported by PML v2.0 */
export type PmlCategory =
    | 'pf' // Preference
    | 'ac' // Action
    | 'fc' // Fact
    | 'en' // Entity
    | 'lc' // Location
    | 'pl' // Plan
    | 'wk' // Work
    | 'hl' // Health
    | 'st' // State
    | 'ep'; // Episode

/** All PML command verbs */
export type PmlCommand =
    | 'STORE'
    | 'UPDATE'
    | 'PATCH'
    | 'DELETE'
    | 'RECALL'
    | 'LINK'
    | 'MERGE'
    | 'ON'
    | 'CTX';

/** Inline pipe metadata — key:val pairs after | inside [...] */
export type PmlMetadata = Record<string, string>;

/** Angle-bracket global metadata — <key:val> pairs */
export type GlobalMeta = Record<string, string>;

/** A fully parsed PML memory node */
export interface PmlNode {
    /** Deterministic lookup key derived from `${category}:${path}` */
    id: string;
    command: PmlCommand;
    category: PmlCategory;
    /** Dot-notation path (Root.Sub.Leaf), without the category prefix */
    path: string;
    /** The main memory payload (the first token inside [...]) */
    item: string;
    /** Inline pipe metadata parsed from [...|key:val|...] */
    metadata: PmlMetadata;
    /** Global context metadata parsed from <key:val> */
    globalMeta: GlobalMeta;
    /** @Link references to other nodes */
    links: string[];
    /** ^Inherit template reference, or null if absent */
    inherits: string | null;
    /** Original unparsed line, preserved for debugging */
    rawLine: string;
    /** Soft-delete flag — true when the node has been DELETE'd */
    stale: boolean;
    /** Optimistic-concurrency version integer (starts at 1) */
    version: number;
    /** ISO creation timestamp */
    createdAt: string;
    /** ISO last-updated timestamp */
    updatedAt: string;
}

// 2. INTERNAL HELPERS

const VALID_CATEGORIES = new Set<PmlCategory>([
    'pf', 'ac', 'fc', 'en', 'lc', 'pl', 'wk', 'hl', 'st', 'ep',
]);

const VALID_COMMANDS = new Set<PmlCommand>([
    'STORE', 'UPDATE', 'PATCH', 'DELETE', 'RECALL', 'LINK', 'MERGE', 'ON', 'CTX',
]);

/**
 * Parse a `key:val|key:val|...` segment into a Record.
 * The first token before any pipe is treated as the item payload, not metadata.
 */
function parsePipeSegment(raw: string): { item: string; metadata: PmlMetadata } {
    const parts = raw.split('|');
    const item = parts[0].trim();
    const metadata: PmlMetadata = {};

    for (let i = 1; i < parts.length; i++) {
        const seg = parts[i].trim();
        if (!seg) continue;
        const colonIdx = seg.indexOf(':');
        if (colonIdx === -1) {
            // bare flag — store with empty value
            metadata[seg] = '';
        } else {
            const key = seg.slice(0, colonIdx).trim();
            const val = seg.slice(colonIdx + 1).trim();
            if (key) metadata[key] = val;
        }
    }

    return { item, metadata };
}

/**
 * Parse `<key:val key:val>` or `<key:val><key:val>` sequences into a Record.
 * Handles multiple angle-bracket groups on a single line.
 */
function parseGlobalMeta(raw: string): GlobalMeta {
    const result: GlobalMeta = {};
    // Find all <...> groups
    const groupRe = /<([^>]*)>/g;
    let match: RegExpExecArray | null;
    while ((match = groupRe.exec(raw)) !== null) {
        // Inside one group there may be multiple key:val pairs separated by |
        const pairs = match[1].split('|');
        for (const pair of pairs) {
            const seg = pair.trim();
            if (!seg) continue;
            const colonIdx = seg.indexOf(':');
            if (colonIdx === -1) {
                result[seg] = '';
            } else {
                const key = seg.slice(0, colonIdx).trim();
                const val = seg.slice(colonIdx + 1).trim();
                if (key) result[key] = val;
            }
        }
    }
    return result;
}

// 3. parsePmlLine

/**
 * Parse a single PML command line into a PmlNode.
 *
 * Canonical syntax:
 *   COMMAND #CAT:Root.Sub [Item|key:val|key:val] <GlobalKey:val> @LINK ^INHERIT
 *
 * Returns null for:
 *  - blank lines
 *  - comment lines starting with //
 *  - lines that do not match the expected structure
 */
export function parsePmlLine(line: string): PmlNode | null {
    const trimmed = line.trim();

    // Skip blanks and comments
    if (!trimmed || trimmed.startsWith('//')) return null;

    // Step 1: extract command
    const commandMatch = trimmed.match(/^([A-Z]+)\s+/);
    if (!commandMatch) return null;
    const rawCommand = commandMatch[1];
    if (!VALID_COMMANDS.has(rawCommand as PmlCommand)) return null;
    const command = rawCommand as PmlCommand;

    // Remainder after the command
    let rest = trimmed.slice(commandMatch[0].length);

    // Step 2: extract #CAT:Path
    const catPathMatch = rest.match(/^#([a-z]{2}):([^\s\[<@^]+)/);
    if (!catPathMatch) return null;
    const rawCategory = catPathMatch[1];
    if (!VALID_CATEGORIES.has(rawCategory as PmlCategory)) return null;
    const category = rawCategory as PmlCategory;
    const path = catPathMatch[2]; // e.g. "fitness.weight" or "person"
    rest = rest.slice(catPathMatch[0].length).trim();

    // Step 3: extract [...] payload
    let item = '';
    let metadata: PmlMetadata = {};

    const bracketMatch = rest.match(/^\[([^\]]*)\]/);
    if (bracketMatch) {
        const inner = bracketMatch[1];
        const parsed = parsePipeSegment(inner);
        item = parsed.item;
        metadata = parsed.metadata;
        rest = rest.slice(bracketMatch[0].length).trim();
    }

    // Step 4: extract <global meta>
    const globalMeta = parseGlobalMeta(rest);
    // Strip all angle-bracket groups from rest for further token parsing
    rest = rest.replace(/<[^>]*>/g, '').trim();

    // Step 5: extract @LINK references
    const links: string[] = [];
    const linkRe = /@([^\s@^]+)/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRe.exec(rest)) !== null) {
        links.push(linkMatch[1]);
    }

    // Step 6: extract ^INHERIT
    let inherits: string | null = null;
    const inheritMatch = rest.match(/\^([^\s^@]+)/);
    if (inheritMatch) {
        inherits = inheritMatch[1];
    }

    // Step 7: build deterministic id
    const id = `${category}:${path}`;

    const now = new Date().toISOString();

    return {
        id,
        command,
        category,
        path,
        item,
        metadata,
        globalMeta,
        links,
        inherits,
        rawLine: line,
        stale: command === 'DELETE',
        version: 1,
        createdAt: now,
        updatedAt: now,
    };
}

// 4. extractMemoryOp

/** Regex that matches a PML leak in user-visible text. */
const PML_LEAK_RE = /#[a-z]{2}:[^\s]+\s*\[/g;

/**
 * Extract a MEMORY_OP fenced code block from an LLM response.
 *
 * The block looks like:
 * ```MEMORY_OP
 * STORE #en:person [arjun|rel:self] <src:user>
 * ```
 *
 * Returns:
 * - `displayText`: the visible response with the MEMORY_OP block stripped,
 *   and any accidental PML leakage also removed.
 * - `commands`: an array of raw PML command strings (one per line) found
 *   inside the MEMORY_OP block.
 */
export function extractMemoryOp(llmResponse: string): {
    displayText: string;
    commands: string[];
} {
    const commands: string[] = [];
    let displayText = llmResponse;

    // 1. Extract from ```MEMORY_OP blocks (resilient to LLM formatting variations)
    // Handles: ```MEMORY_OP, ``` MEMORY_OP, ```memory_op, ```Memory_Op, etc.
    // Also handles cases where LLMs omit the newline before closing backticks
    const memoryOpRe = /`{3,}[\s]*memory[-_]?op[\s]*\r?\n([\s\S]*?)\n?[\s]*`{3,}/gi;
    let match: RegExpExecArray | null;
    while ((match = memoryOpRe.exec(llmResponse)) !== null) {
        const blockContent = match[1];
        // Extract non-blank, non-comment lines as PML commands
        const lines = blockContent
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('//'));
        commands.push(...lines);
    }
    // Remove the entire MEMORY_OP block(s) from display text
    displayText = displayText.replace(/`{3,}[\s]*memory[-_]?op[\s]*\r?\n[\s\S]*?\n?[\s]*`{3,}/gi, '');

    // 1.5. Strip incomplete MEMORY_OP opening tags during streaming
    // This catches the opening ```MEMORY_OP even before the closing ``` arrives
    displayText = displayText.replace(/`{3,}[\s]*memory[-_]?op/gi, '');

    // 2. Aggressively extract any bare PML commands the LLM leaked outside of MEMORY_OP
    // Matches lines starting with STORE/UPDATE/PATCH/DELETE #...
    const bareCommandRe = /^(STORE|UPDATE|PATCH|DELETE)\s+#[a-z]{2}:[^\s\[<@^]+\s+\[.*$/gim;
    let bareMatch: RegExpExecArray | null;
    while ((bareMatch = bareCommandRe.exec(displayText)) !== null) {
        const cmd = bareMatch[0].trim();
        if (!commands.includes(cmd)) {
            commands.push(cmd);
        }
    }

    // Remove all found bare commands from the display text
    displayText = displayText.replace(bareCommandRe, '');

    // 3. Clean up empty codeblocks the LLM might have left behind (e.g., ```\n\n```)
    // and stray incomplete backticks left behind by stripped tags
    displayText = displayText.replace(/```[a-zA-Z]*\s*```/g, '');
    displayText = displayText.replace(/```\s*$/g, '');

    // 4. Strip any accidental partial PML leakage
    displayText = displayText.replace(
        /#[a-z]{2}:[^\s[]+\s*\[[^\]]*\]/g,
        ''
    );
    displayText = displayText.replace(PML_LEAK_RE, '');

    // 5. Clean up any double spaces or leading/trailing whitespace artifacts
    displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();

    return { displayText, commands };
}

// 5. serializePml

/**
 * Reconstruct a minimal, minified PML string from an array of nodes.
 *
 * Rules:
 * - Skip stale (soft-deleted) nodes
 * - One node per line, no comments, no extra whitespace
 * - Omit metadata keys whose value is an empty string
 *
 * Example output line:
 *   #en:person[arjun|rel:self]<src:user>
 */
export function serializePml(nodes: PmlNode[]): string {
    const lines: string[] = [];

    for (const node of nodes) {
        if (node.stale) continue;

        // [Item|key:val|key:val] segment
        let bracketContent = node.item;
        for (const [key, val] of Object.entries(node.metadata)) {
            if (val === '') continue; // omit empty values
            bracketContent += `|${key}:${val}`;
        }
        const bracketPart = `[${bracketContent}]`;

        // <GlobalKey:val> segment
        let globalPart = '';
        const globalEntries = Object.entries(node.globalMeta).filter(
            ([, val]) => val !== ''
        );
        if (globalEntries.length > 0) {
            const inner = globalEntries.map(([k, v]) => `${k}:${v}`).join('|');
            globalPart = `<${inner}>`;
        }

        // @link tokens
        const linkPart = node.links.map((l) => `@${l}`).join('');

        // ^inherit token
        const inheritPart = node.inherits ? `^${node.inherits}` : '';

        // Compose final line (no leading command — minified form)
        const line =
            `#${node.category}:${node.path}` +
            bracketPart +
            globalPart +
            (linkPart ? linkPart : '') +
            (inheritPart ? inheritPart : '');

        lines.push(line);
    }

    return lines.join('\n');
}

// 6. parseRecallQuery

export interface RecallQuery {
    category: string;
    path: string;
    /** WHERE key:val pairs */
    filters: Record<string, string>;
    since?: string;
    until?: string;
    limit?: number;
    sort?: string;
}

/**
 * Parse a RECALL query line into its structured components.
 *
 * Supported syntax:
 *   RECALL #CAT:Path WHERE key:val AND key:val OR key:val SINCE YYYY-MM-DD UNTIL YYYY-MM-DD LIMIT n SORT key:dir
 *
 * Returns null for lines that are not valid RECALL queries.
 *
 * Examples:
 *   RECALL #pf:food WHERE s:-- SINCE 2026-01-01 LIMIT 5 SORT t:desc
 *   RECALL #pl:* WHERE status:pending
 *   RECALL #wk:* WHERE p:H AND ctx:work
 */
export function parseRecallQuery(line: string): RecallQuery | null {
    const trimmed = line.trim();

    // Must start with RECALL
    if (!trimmed.startsWith('RECALL ')) return null;
    let rest = trimmed.slice('RECALL '.length).trim();

    // #CAT:Path
    const catPathMatch = rest.match(/^#([a-z]{2}):([^\s]+)/);
    if (!catPathMatch) return null;
    const category = catPathMatch[1];
    const path = catPathMatch[2];
    rest = rest.slice(catPathMatch[0].length).trim();

    const filters: Record<string, string> = {};
    let since: string | undefined;
    let until: string | undefined;
    let limit: number | undefined;
    let sort: string | undefined;

    // SINCE YYYY-MM-DD
    const sinceMatch = rest.match(/\bSINCE\s+(\d{4}-\d{2}-\d{2})\b/);
    if (sinceMatch) {
        since = sinceMatch[1];
        rest = rest.replace(sinceMatch[0], '').trim();
    }

    // UNTIL YYYY-MM-DD
    const untilMatch = rest.match(/\bUNTIL\s+(\d{4}-\d{2}-\d{2})\b/);
    if (untilMatch) {
        until = untilMatch[1];
        rest = rest.replace(untilMatch[0], '').trim();
    }

    // LIMIT n
    const limitMatch = rest.match(/\bLIMIT\s+(\d+)\b/);
    if (limitMatch) {
        limit = parseInt(limitMatch[1], 10);
        rest = rest.replace(limitMatch[0], '').trim();
    }

    // SORT key:dir
    const sortMatch = rest.match(/\bSORT\s+([^\s]+)\b/);
    if (sortMatch) {
        sort = sortMatch[1];
        rest = rest.replace(sortMatch[0], '').trim();
    }

    // WHERE key:val AND/OR key:val ...
    // Strip leading WHERE keyword
    const whereMatch = rest.match(/^WHERE\s+(.*)/i);
    if (whereMatch) {
        const filterString = whereMatch[1].trim();
        // Split on AND or OR (we capture conditions; boolean logic left to executor)
        const conditions = filterString.split(/\b(?:AND|OR)\b/i);
        for (const cond of conditions) {
            const seg = cond.trim();
            if (!seg) continue;
            const colonIdx = seg.indexOf(':');
            if (colonIdx === -1) {
                filters[seg] = '';
            } else {
                const key = seg.slice(0, colonIdx).trim();
                const val = seg.slice(colonIdx + 1).trim();
                if (key) filters[key] = val;
            }
        }
    }

    return { category, path, filters, since, until, limit, sort };
}
