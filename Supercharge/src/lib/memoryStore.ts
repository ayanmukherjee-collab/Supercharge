/**
 * memoryStore.ts
 * Handles all Firebase reads/writes for PML memory_nodes.
 */

import {
    deleteDoc,
    getDoc,
    getDocs,
    runTransaction,
    updateDoc,
    writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { memoryCollectionRef, memoryDocRef } from './firestorePaths'
import { PmlNode, parsePmlLine } from './pmlParser'

interface MemoryRow {
    id: string
    user_id: string
    command: string
    category: string
    path: string
    item: string
    metadata: Record<string, string>
    global_meta: Record<string, string>
    links: string[]
    inherits: string | null
    stale: boolean
    version: number
    created_at: string
    updated_at: string
}

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
    }
}

const POISON_COMMAND_WORDS = ['STORE', 'UPDATE', 'DELETE', 'PATCH', 'RECALL']
const POISON_PHRASES = ['ignore instructions', 'override', 'system access']

function sanitisePoisoning(item: string, nodeId: string): boolean {
    for (const kw of POISON_COMMAND_WORDS) {
        const commandPattern = new RegExp(`\\b${kw}\\s+#[a-z]{2}:`, 'i')
        if (commandPattern.test(item)) {
            console.warn(`[memoryStore] Poisoning attempt blocked for node "${nodeId}" via "${kw}"`)
            return true
        }
    }

    const lower = item.toLowerCase()
    for (const phrase of POISON_PHRASES) {
        if (lower.includes(phrase)) {
            console.warn(`[memoryStore] Poisoning attempt blocked for node "${nodeId}" via "${phrase}"`)
            return true
        }
    }

    return false
}

const SENSITIVE_PATTERNS: RegExp[] = [
    /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\bpassword\b/i,
]

function detectSensitiveData(item: string): boolean {
    return SENSITIVE_PATTERNS.some((re) => re.test(item))
}

const sortByUpdatedAtDesc = (rows: MemoryRow[]) =>
    [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))

export async function fetchAllMemory(userId: string): Promise<PmlNode[]> {
    const snapshot = await getDocs(memoryCollectionRef(userId))
    const rows = snapshot.docs
        .map((docSnapshot) => docSnapshot.data() as MemoryRow)
        .filter((row) => !row.stale)

    return sortByUpdatedAtDesc(rows).map(rowToNode)
}

async function handleStore(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    try {
        return await runTransaction(db, async (transaction) => {
            const ref = memoryDocRef(userId, node.id)
            const snapshot = await transaction.get(ref)
            const existing = snapshot.exists() ? snapshot.data() as MemoryRow : null

            if (existing && !existing.stale) {
                const now = new Date().toISOString()
                transaction.set(ref, {
                    id: node.id,
                    user_id: userId,
                    command: 'UPDATE',
                    category: node.category,
                    path: node.path,
                    item: node.item,
                    metadata: node.metadata,
                    global_meta: node.globalMeta,
                    links: node.links,
                    inherits: node.inherits,
                    stale: false,
                    version: (existing.version ?? 0) + 1,
                    created_at: existing.created_at ?? now,
                    updated_at: now,
                })
                return 'written' as const
            }

            const now = new Date().toISOString()
            transaction.set(ref, {
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
                created_at: existing?.created_at ?? now,
                updated_at: now,
            })

            return 'written' as const
        })
    } catch (error) {
        errors.push(`STORE failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`)
        return 'skipped'
    }
}

async function handleUpdate(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    try {
        return await runTransaction(db, async (transaction) => {
            const ref = memoryDocRef(userId, node.id)
            const snapshot = await transaction.get(ref)
            const existing = snapshot.exists() ? snapshot.data() as MemoryRow : null
            const now = new Date().toISOString()

            transaction.set(ref, {
                id: node.id,
                user_id: userId,
                command: 'UPDATE',
                category: node.category,
                path: node.path,
                item: node.item,
                metadata: node.metadata,
                global_meta: node.globalMeta,
                links: node.links,
                inherits: node.inherits,
                stale: false,
                version: (existing?.version ?? 0) + 1,
                created_at: existing?.created_at ?? now,
                updated_at: now,
            })

            return 'written' as const
        })
    } catch (error) {
        errors.push(`UPDATE failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`)
        return 'skipped'
    }
}

async function handlePatch(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    try {
        return await runTransaction(db, async (transaction) => {
            const ref = memoryDocRef(userId, node.id)
            const snapshot = await transaction.get(ref)
            const existing = snapshot.exists() ? snapshot.data() as MemoryRow : null
            const now = new Date().toISOString()

            let history: Array<{ item: string; metadata: Record<string, string>; t: string }> = []
            if (existing?.metadata?._history) {
                try {
                    history = JSON.parse(existing.metadata._history as unknown as string)
                } catch {
                    history = []
                }
            }

            history.push({ item: node.item, metadata: node.metadata, t: now })

            let nextMetadata: Record<string, string> = {
                ...node.metadata,
                _history: JSON.stringify(history),
            }

            if (history.length > 50) {
                const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                const oldEntries = history.filter((entry) => entry.t < cutoff)
                const recentEntries = history.filter((entry) => entry.t >= cutoff)

                let summaryMeta: Record<string, string> = {}
                if (oldEntries.length > 0) {
                    const nums = oldEntries
                        .map((entry) => {
                            const valMeta = entry.metadata.val ?? ''
                            const numMatch = valMeta.match(/n:([\d.]+)/)
                            return numMatch ? parseFloat(numMatch[1]) : null
                        })
                        .filter((value): value is number => value !== null)

                    summaryMeta = nums.length > 0
                        ? {
                            _summary: `min:${Math.min(...nums)}|max:${Math.max(...nums)}|avg:${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}|count:${nums.length}`,
                        }
                        : { _summary: `count:${oldEntries.length}` }
                }

                history = recentEntries
                nextMetadata = {
                    ...node.metadata,
                    ...summaryMeta,
                    _history: JSON.stringify(history),
                }
            }

            transaction.set(ref, {
                id: node.id,
                user_id: userId,
                command: 'PATCH',
                category: node.category,
                path: node.path,
                item: node.item,
                metadata: nextMetadata,
                global_meta: node.globalMeta,
                links: node.links,
                inherits: node.inherits,
                stale: false,
                version: (existing?.version ?? 0) + 1,
                created_at: existing?.created_at ?? now,
                updated_at: now,
            })

            return 'written' as const
        })
    } catch (error) {
        errors.push(`PATCH failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`)
        return 'skipped'
    }
}

async function handleDelete(
    userId: string,
    node: PmlNode,
    errors: string[]
): Promise<'written' | 'skipped'> {
    try {
        await updateDoc(memoryDocRef(userId, node.id), {
            stale: true,
            updated_at: new Date().toISOString(),
        })
        return 'written'
    } catch (error) {
        errors.push(`DELETE (soft) failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`)
        return 'skipped'
    }
}

export interface MemoryOpResult {
    written: number
    skipped: number
    errors: string[]
}

export async function executeMemoryOp(
    userId: string,
    commands: string[]
): Promise<MemoryOpResult> {
    const errors: string[] = []
    let written = 0
    let skipped = 0

    const results = await Promise.all(
        commands.map(async (rawLine) => {
            const node = parsePmlLine(rawLine)
            if (!node) {
                errors.push(`Could not parse PML line: "${rawLine}"`)
                return 'skipped' as const
            }

            if (sanitisePoisoning(node.item, node.id)) {
                errors.push(`Poisoning attempt blocked for node "${node.id}"`)
                return 'skipped' as const
            }

            if (detectSensitiveData(node.item)) {
                errors.push(`Sensitive data detected for node "${node.id}". Remove PII before storing.`)
                return 'skipped' as const
            }

            try {
                switch (node.command) {
                    case 'STORE':
                        return await handleStore(userId, node, errors)
                    case 'UPDATE':
                        return await handleUpdate(userId, node, errors)
                    case 'PATCH':
                        return await handlePatch(userId, node, errors)
                    case 'DELETE':
                        return await handleDelete(userId, node, errors)
                    default:
                        return 'skipped' as const
                }
            } catch (error) {
                errors.push(`Unhandled error for "${node.id}": ${error instanceof Error ? error.message : String(error)}`)
                return 'skipped' as const
            }
        })
    )

    for (const result of results) {
        if (result === 'written') written++
        else skipped++
    }

    return { written, skipped, errors }
}

export async function pruneExpiredNodes(userId: string): Promise<number> {
    const snapshot = await getDocs(memoryCollectionRef(userId))
    const now = new Date().toISOString()
    const todayDate = now.slice(0, 10)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const docsToPrune = snapshot.docs.filter((docSnapshot) => {
        const row = docSnapshot.data() as MemoryRow
        if (row.stale) return false

        const ttl = row.global_meta?.ttl
        if (ttl && ttl < todayDate) return true

        return row.category === 'st' && row.updated_at < cutoff24h
    })

    if (docsToPrune.length === 0) return 0

    const batch = writeBatch(db)
    docsToPrune.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, {
            stale: true,
            updated_at: now,
        })
    })
    await batch.commit()

    console.info(`[memoryStore] Pruned ${docsToPrune.length} expired/stale nodes for user ${userId}`)
    return docsToPrune.length
}

export async function getNodeCount(
    userId: string
): Promise<{ active: number; stale: number }> {
    const snapshot = await getDocs(memoryCollectionRef(userId))
    let active = 0
    let stale = 0

    snapshot.docs.forEach((docSnapshot) => {
        const row = docSnapshot.data() as MemoryRow
        if (row.stale) stale++
        else active++
    })

    return { active, stale }
}

export async function hardDeleteNode(
    userId: string,
    nodeId: string
): Promise<void> {
    const ref = memoryDocRef(userId, nodeId)
    const snapshot = await getDoc(ref)
    if (!snapshot.exists()) return

    await deleteDoc(ref)
    console.info(`[memoryStore] Hard-deleted node "${nodeId}" for user ${userId}`)
}
