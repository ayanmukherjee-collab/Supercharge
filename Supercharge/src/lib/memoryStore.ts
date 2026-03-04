/**
 * memoryStore.ts
 * Handles all Supabase reads/writes for PML memory_nodes.
 *
 * Issues addressed:
 *  #2.1 — STORE/UPDATE confusion → auto-upgrade STORE to UPDATE when node exists
 *  #2.3 — TTL pruning            → pruneExpiredNodes() marks stale by ttl / #st age
 *  #2.4 — PATCH history cap      → cap at 50 entries; aggregate old entries as _summary
 *  #2.5 — Node count cap         → getNodeCount() surfaces active count to callers
 *  #3.1 — Race conditions        → optimistic locking via version integer
 *  #3.2 — Session desync         → fetchAllMemory() always re-fetches from Supabase
 *  #4.1 — Memory poisoning       → sanitisePoisoning() blocks injection keywords
 *  #4.3 — Sensitive data         → detectSensitiveData() blocks PII patterns
 */

import { supabase } from './supabase';
import { PmlNode, parsePmlLine } from './pmlParser';

// ─────────────────────────────────────────────
// INTERNAL: Type for a raw memory_nodes row
// ─────────────────────────────────────────────

interface MemoryRow {
    id: string;
    user_id: string;
    command: string;
    category: string;
    path: string;
    item: string;
    metadata: Record<string, string>;
    global_meta: Record<string, string>;
    links: string[];
    inherits: string | null;
    stale: boolean;
    version: number;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────
// INTERNAL: Row → PmlNode mapper
// ─────────────────────────────────────────────

function rowToNode(row: MemoryRow): PmlNode {
    return {
        id: row.id,
        command: row.command as PmlNode['command'],
        category: row.category as PmlNode['category'],
        path: row.path,
        item: row.item ?? '',
        metadata: row.metadata ?? {},
        globalMeta: row.global_meta ?? {},
        links: row.links ?? [],
        inherits: row.inherits ?? null,
        rawLine: '',
        stale: row.stale,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─────────────────────────────────────────────
// INTERNAL: Security / Sanitisation helpers
// ─────────────────────────────────────────────

/** PML command injection keywords — issue #4.1 */
const POISON_COMMAND_WORDS = ['STORE', 'UPDATE', 'DELETE', 'PATCH', 'RECALL'];
const POISON_PHRASES = ['ignore instructions', 'override', 'system access'];

/**
 * Returns true (and logs) if the item value contains memory-poisoning patterns.
 * Uses word-boundary matching for PML commands to avoid false positives
 * on normal English words (e.g. "store" → food store, "update" → status update).
 * Fix for issue #4.1.
 */
function sanitisePoisoning(item: string, nodeId: string): boolean {
    // Check PML command words with word boundaries (must look like actual commands)
    // e.g. "STORE #en:person" would match, but "cookie store" would not
    for (const kw of POISON_COMMAND_WORDS) {
        const commandPattern = new RegExp(`\\b${kw}\\s+#[a-z]{2}:`, 'i');
        if (commandPattern.test(item)) {
            console.warn(`[memoryStore] Poisoning attempt blocked — node "${nodeId}" contains command pattern "${kw}"`);
            return true;
        }
    }

    // Check injection phrases as substring (these are always suspicious)
    const lower = item.toLowerCase();
    for (const phrase of POISON_PHRASES) {
        if (lower.includes(phrase)) {
            console.warn(`[memoryStore] Poisoning attempt blocked — node "${nodeId}" contains phrase "${phrase}"`);
            return true;
        }
    }

    return false;
}

/** PII patterns — issue #4.3 */
const SENSITIVE_PATTERNS: RegExp[] = [
    /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, // credit/debit card
    /\b\d{3}-\d{2}-\d{4}\b/,                     // SSN
    /\bpassword\b/i,                              // plaintext password
];

/**
 * Returns true if any PII pattern is detected in the item value.
 * Fix for issue #4.3.
 */
function detectSensitiveData(item: string): boolean {
    return SENSITIVE_PATTERNS.some((re) => re.test(item));
}

// ─────────────────────────────────────────────
// 1. fetchAllMemory
// ─────────────────────────────────────────────

/**
 * Fetch all non-stale memory nodes for a user, newest first.
 * Always re-fetches from Supabase to avoid session desync (fix #3.2).
 */
export async function fetchAllMemory(userId: string): Promise<PmlNode[]> {
    const { data, error } = await supabase
        .from('memory_nodes')
        .select('*')
        .eq('user_id', userId)
        .eq('stale', false)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('[memoryStore] fetchAllMemory error:', error.message);
        throw new Error(`Failed to fetch memory: ${error.message}`);
    }

    return (data as MemoryRow[]).map(rowToNode);
}

// ─────────────────────────────────────────────
// INTERNAL: Individual command handlers
// ─────────────────────────────────────────────

/**
 * STORE handler with auto-upgrade to UPDATE when the node already exists.
 * Fix for issue #2.1.
 */
async function handleStore(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    // Check if the node already exists
    const { data: existing, error: fetchError } = await supabase
        .from('memory_nodes')
        .select('id, version, stale')
        .eq('user_id', userId)
        .eq('id', node.id)
        .maybeSingle();

    if (fetchError) {
        errors.push(`STORE fetch check failed for ${node.id}: ${fetchError.message}`);
        return 'skipped';
    }

    if (existing && !existing.stale) {
        // Node exists — auto-upgrade to UPDATE
        console.info(`[memoryStore] Auto-upgrading STORE → UPDATE for node "${node.id}"`);
        return handleUpdate(userId, node, errors);
    }

    // Insert new node (or resurrect a stale one via upsert)
    const { error: insertError } = await supabase
        .from('memory_nodes')
        .upsert(
            {
                id: node.id,
                user_id: userId,
                command: 'STORE',
                category: node.category,
                path: node.path,
                item: node.item,
                metadata: node.metadata,
                global_meta: node.globalMeta,
                links: node.links,
                inherits: node.inherits,
                stale: false,
                version: 1,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,id' }
        );

    if (insertError) {
        errors.push(`STORE failed for ${node.id}: ${insertError.message}`);
        return 'skipped';
    }

    return 'written';
}

/**
 * UPDATE handler with optimistic locking via version integer.
 * Retries once on version mismatch. Fix for issue #3.1.
 */
async function handleUpdate(
    userId: string,
    node: PmlNode,
    errors: string[],
    attempt = 1
): Promise<'written' | 'skipped'> {
    // Read the current version
    const { data: existing, error: fetchError } = await supabase
        .from('memory_nodes')
        .select('version')
        .eq('user_id', userId)
        .eq('id', node.id)
        .maybeSingle();

    if (fetchError) {
        errors.push(`UPDATE version fetch failed for ${node.id}: ${fetchError.message}`);
        return 'skipped';
    }

    const currentVersion = existing?.version ?? 0;
    const nextVersion = currentVersion + 1;

    // Conditional update — only commits if version matches (optimistic lock)
    const { error: updateError, count } = await supabase
        .from('memory_nodes')
        .update({
            command: 'UPDATE',
            item: node.item,
            metadata: node.metadata,
            global_meta: node.globalMeta,
            links: node.links,
            inherits: node.inherits,
            stale: false,
            version: nextVersion,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', node.id)
        .eq('version', currentVersion); // optimistic lock condition

    if (updateError) {
        errors.push(`UPDATE failed for ${node.id}: ${updateError.message}`);
        return 'skipped';
    }

    // count === 0 means version mismatch — another writer beat us
    if (count === 0) {
        if (attempt < 2) {
            // Retry once after 200ms (fix #3.1)
            await new Promise((r) => setTimeout(r, 200));
            return handleUpdate(userId, node, errors, attempt + 1);
        }
        errors.push(`UPDATE version conflict after retry for ${node.id}`);
        return 'skipped';
    }

    return 'written';
}

/**
 * PATCH handler — appends a timestamped entry to the item history.
 * Caps at 50 entries; aggregates old entries as _summary metadata.
 * Fix for issue #2.4.
 */
async function handlePatch(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    const now = new Date().toISOString();

    // Read current PATCH history from metadata._history (stored as JSON string)
    const { data: existing, error: fetchError } = await supabase
        .from('memory_nodes')
        .select('metadata, version')
        .eq('user_id', userId)
        .eq('id', node.id)
        .maybeSingle();

    if (fetchError) {
        errors.push(`PATCH fetch failed for ${node.id}: ${fetchError.message}`);
        return 'skipped';
    }

    // History is stored in metadata._history as a JSON-encoded array
    let history: Array<{ item: string; metadata: Record<string, string>; t: string }> = [];
    if (existing?.metadata?._history) {
        try {
            history = JSON.parse(existing.metadata._history as unknown as string);
        } catch {
            history = [];
        }
    }

    // Append new entry
    history.push({ item: node.item, metadata: node.metadata, t: now });

    // Cap at 50 entries (fix #2.4)
    if (history.length > 50) {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const oldEntries = history.filter((e) => e.t < cutoff);
        const recentEntries = history.filter((e) => e.t >= cutoff);

        let summaryMeta: Record<string, string> = {};
        if (oldEntries.length > 0) {
            // Try to extract numeric values for min/max/avg
            const nums = oldEntries
                .map((e) => {
                    const valMeta = e.metadata['val'] ?? '';
                    const numMatch = valMeta.match(/n:([\d.]+)/);
                    return numMatch ? parseFloat(numMatch[1]) : null;
                })
                .filter((n): n is number => n !== null);

            if (nums.length > 0) {
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
                summaryMeta = { _summary: `min:${min}|max:${max}|avg:${avg}|count:${nums.length}` };
            } else {
                summaryMeta = { _summary: `count:${oldEntries.length}` };
            }
        }

        // Keep only recent entries + the summary
        history = recentEntries;
        if (Object.keys(summaryMeta).length > 0) {
            const newMeta: Record<string, string> = {
                ...node.metadata,
                ...summaryMeta,
                _history: JSON.stringify(history),
            };

            const { error: patchError } = await supabase
                .from('memory_nodes')
                .upsert(
                    {
                        id: node.id,
                        user_id: userId,
                        command: 'PATCH',
                        category: node.category,
                        path: node.path,
                        item: node.item,
                        metadata: newMeta,
                        global_meta: node.globalMeta,
                        links: node.links,
                        inherits: node.inherits,
                        stale: false,
                        version: (existing?.version ?? 0) + 1,
                        updated_at: now,
                    },
                    { onConflict: 'user_id,id' }
                );

            if (patchError) {
                errors.push(`PATCH(capped) failed for ${node.id}: ${patchError.message}`);
                return 'skipped';
            }
            return 'written';
        }
    }

    // Standard upsert with updated history
    const newMeta: Record<string, string> = {
        ...node.metadata,
        _history: JSON.stringify(history),
    };

    const { error: upsertError } = await supabase
        .from('memory_nodes')
        .upsert(
            {
                id: node.id,
                user_id: userId,
                command: 'PATCH',
                category: node.category,
                path: node.path,
                item: node.item,
                metadata: newMeta,
                global_meta: node.globalMeta,
                links: node.links,
                inherits: node.inherits,
                stale: false,
                version: (existing?.version ?? 0) + 1,
                updated_at: now,
            },
            { onConflict: 'user_id,id' }
        );

    if (upsertError) {
        errors.push(`PATCH failed for ${node.id}: ${upsertError.message}`);
        return 'skipped';
    }

    return 'written';
}

/**
 * DELETE handler — soft delete by setting stale = true.
 * Per spec, hard deletes are only via hardDeleteNode().
 */
async function handleDelete(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    const { error } = await supabase
        .from('memory_nodes')
        .update({ stale: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', node.id);

    if (error) {
        errors.push(`DELETE (soft) failed for ${node.id}: ${error.message}`);
        return 'skipped';
    }

    return 'written';
}

// ─────────────────────────────────────────────
// 2. executeMemoryOp
// ─────────────────────────────────────────────

export interface MemoryOpResult {
    written: number;
    skipped: number;
    errors: string[];
}

/**
 * Parse and execute an array of raw PML command strings extracted from a
 * MEMORY_OP block. Applies sanitisation and security checks before every write.
 */
export async function executeMemoryOp(
    userId: string,
    commands: string[]
): Promise<MemoryOpResult> {
    const errors: string[] = [];
    let written = 0;
    let skipped = 0;

    // Process all commands in parallel; per-item errors are caught individually
    const results = await Promise.all(
        commands.map(async (rawLine) => {
            const node = parsePmlLine(rawLine);
            if (!node) {
                errors.push(`Could not parse PML line: "${rawLine}"`);
                return 'skipped' as const;
            }

            // ── Security gate #4.1: memory poisoning sanitisation ────────────────
            if (sanitisePoisoning(node.item, node.id)) {
                errors.push(`Poisoning attempt blocked for node "${node.id}"`);
                return 'skipped' as const;
            }

            // ── Security gate #4.3: sensitive data detection ──────────────────────
            if (detectSensitiveData(node.item)) {
                errors.push(
                    `Sensitive data detected — node "${node.id}" was not stored. ` +
                    `Review and remove PII before re-submitting.`
                );
                return 'skipped' as const;
            }

            // ── Command routing ───────────────────────────────────────────────────
            try {
                switch (node.command) {
                    case 'STORE':
                        return await handleStore(userId, node, errors);
                    case 'UPDATE':
                        return await handleUpdate(userId, node, errors);
                    case 'PATCH':
                        return await handlePatch(userId, node, errors);
                    case 'DELETE':
                        return await handleDelete(userId, node, errors);
                    default:
                        // RECALL, LINK, MERGE, ON, CTX — not persisted by this layer
                        return 'skipped' as const;
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                errors.push(`Unhandled error for "${node.id}": ${msg}`);
                return 'skipped' as const;
            }
        })
    );

    for (const r of results) {
        if (r === 'written') written++;
        else skipped++;
    }

    return { written, skipped, errors };
}

// ─────────────────────────────────────────────
// 3. pruneExpiredNodes
// ─────────────────────────────────────────────

/**
 * Soft-delete nodes whose TTL has passed, and all #st (State) nodes older than 24 hours.
 * Fixes issue #2.3.
 * Returns the total count of nodes marked stale.
 */
export async function pruneExpiredNodes(userId: string): Promise<number> {
    const now = new Date().toISOString();
    const todayDate = now.slice(0, 10); // YYYY-MM-DD
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let pruned = 0;

    // ── Prune by TTL field in global_meta ───────────────────────────────────
    // Supabase PostgREST: use ->> to extract text from JSONB, then compare
    const { data: ttlRows, error: ttlError } = await supabase
        .from('memory_nodes')
        .update({ stale: true, updated_at: now })
        .eq('user_id', userId)
        .eq('stale', false)
        .lt('global_meta->>ttl', todayDate)
        .select('id');

    if (ttlError) {
        console.error('[memoryStore] TTL prune error:', ttlError.message);
    } else {
        pruned += ttlRows?.length ?? 0;
    }

    // ── Prune #st (State) nodes older than 24 hours ──────────────────────────
    const { data: stRows, error: stError } = await supabase
        .from('memory_nodes')
        .update({ stale: true, updated_at: now })
        .eq('user_id', userId)
        .eq('category', 'st')
        .eq('stale', false)
        .lt('updated_at', cutoff24h)
        .select('id');

    if (stError) {
        console.error('[memoryStore] State node prune error:', stError.message);
    } else {
        pruned += stRows?.length ?? 0;
    }

    if (pruned > 0) {
        console.info(`[memoryStore] Pruned ${pruned} expired/stale nodes for user ${userId}`);
    }

    return pruned;
}

// ─────────────────────────────────────────────
// 4. getNodeCount
// ─────────────────────────────────────────────

/**
 * Returns the count of active (non-stale) and stale nodes for a user.
 * Callers can use this to enforce the 500-node hard cap (issue #2.5)
 * and surface a warning in the Memory Explorer.
 */
export async function getNodeCount(
    userId: string
): Promise<{ active: number; stale: number }> {
    const { count: activeCount, error: activeError } = await supabase
        .from('memory_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('stale', false);

    const { count: staleCount, error: staleError } = await supabase
        .from('memory_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('stale', true);

    if (activeError) {
        console.error('[memoryStore] getNodeCount (active) error:', activeError.message);
    }
    if (staleError) {
        console.error('[memoryStore] getNodeCount (stale) error:', staleError.message);
    }

    return {
        active: activeCount ?? 0,
        stale: staleCount ?? 0,
    };
}

// ─────────────────────────────────────────────
// 5. hardDeleteNode
// ─────────────────────────────────────────────

/**
 * Permanently removes a single memory node from Supabase.
 * Used by the Memory Explorer hard-delete UX flow (fixes issue #5.2).
 * Callers should confirm intent with the user before calling this.
 */
export async function hardDeleteNode(
    userId: string,
    nodeId: string
): Promise<void> {
    const { error } = await supabase
        .from('memory_nodes')
        .delete()
        .eq('user_id', userId)
        .eq('id', nodeId);

    if (error) {
        console.error('[memoryStore] hardDeleteNode error:', error.message);
        throw new Error(`Failed to hard-delete node "${nodeId}": ${error.message}`);
    }

    console.info(`[memoryStore] Hard-deleted node "${nodeId}" for user ${userId}`);
}
