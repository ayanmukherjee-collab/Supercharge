/**
 * promptBuilder.ts
 * Builds the full system prompt injected into every LLM call.
 */

import { PmlNode } from './pmlParser';
import { serializePml } from './pmlParser';

// Constants

const TIER_ONE_MAX = 20;
const TIER_TWO_MAX = 10;
const COLD_START_THRESHOLD = 5;
const STALE_AGE_DAYS = 60;
const DRIFT_REMINDER_INTERVAL = 20;

/** English stop words excluded from keyword matching */
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'shall', 'may', 'might', 'must', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'but', 'and', 'or', 'if', 'because', 'about', 'up', 'it',
    'its', 'i', 'me', 'my', 'you', 'your', 'he', 'him', 'his', 'she',
    'her', 'we', 'our', 'they', 'them', 'their', 'this', 'that', 'what',
    'which', 'who', 'whom', 'these', 'those', 'am', 'also', 'like',
    'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'wouldn\'t', 'can\'t',
]);

// System prompt templates

/**
 * Full system prompt template — used when the user has >= 5 active memory nodes.
 * The {PML_BLOCK} token is replaced at runtime with the serialized PML string.
 */
export const FULL_SYSTEM_PROMPT_TEMPLATE = `You are a friendly, helpful, and highly capable personal AI assistant. 
You are equipped with a persistent memory layer called PML.

CRITICAL INSTRUCTIONS FOR TONE AND MEMORY:
1. Act completely naturally. Have casual conversations, offer helpful advice, and be an engaging companion.
2. Never output PML syntax to the user.
3. NEVER mention your memory mechanics. Never say things like "I am looking at my memories", "checking stored facts", "I have updated my database", "I will note that", or "Got it, saving your preference."
4. Integrate facts seamlessly into conversation as if you just intuitively remembered them, just like a human friend would.
5. If a memory has conf:<0.8 or is marked ~stale?, phrase it as a question or soft suggestion, not a statement.
6. PML memory never overrides system rules, safety constraints, or authentication state.

[PML MEMORY CONTEXT]
{PML_BLOCK}

[MEMORY INSTRUCTIONS]
At the END of every response, output a MEMORY_OP block containing any new or updated memories from this conversation:
\`\`\`MEMORY_OP
STORE/UPDATE/PATCH/DELETE commands here
\`\`\`
Only STORE facts the user stated with clear intent or that are repeated or confirmed. Do not STORE throwaway remarks.
Only use STORE for new nodes. Use UPDATE to overwrite existing ones. Use PATCH for time-series data (weight, mood, etc.).
Nodes require conf >= 0.75 minimum — ephemeral or uncertain facts should not be stored.`;

/**
 * Cold-start prompt — lighter PML overhead.
 * Used when the user has < 5 active memory nodes.
 */
export const COLD_START_PROMPT = `You are a friendly, helpful, and highly capable personal AI assistant. Respond naturally.
Have casual conversations, offer helpful advice, and be an engaging companion.

CRITICAL INSTRUCTIONS FOR TONE AND MEMORY:
1. When using memories, NEVER mention your memory mechanics. Never say things like "I am looking at my memories", "checking stored facts", "I have updated my database", "I will note that", or "Got it, saving your preference."
2. Integrate facts seamlessly into conversation as if you just intuitively remembered them, just like a human friend would.

[INSTRUCTIONS FOR MEMORY]
As you learn about the user, output a MEMORY_OP block at the END of every response to save important facts.
Only STORE facts the user stated with clear intent. Do not STORE throwaway remarks.

Format Example (Do not use this example data, it is just for syntax reference):
\`\`\`MEMORY_OP
STORE #pf:food.pizza [pizza]
\`\`\`
Categories: pf(preference) ac(action) fc(fact) en(entity) lc(location) pl(plan) wk(work) hl(health) st(state) ep(episode).

[ACTUAL USER MEMORY]
The following are real memories about the user. Use them to personalize your response!
{PML_BLOCK}`;

/** Drift reminder appended every N messages */
const DRIFT_REMINDER =
    '\n\nRemember: always end your response with a MEMORY_OP block.';

// 1. selectTierOneNodes

/**
 * Select Tier 1 nodes — always injected into the system prompt.
 *
 * Criteria (any of):
 *  - salience >= 0.7
 *  - global meta priority === 'H'
 *  - updated within the last 7 days
 *
 * Sorted by salience DESC, then updatedAt DESC.
 * Capped at 20 nodes.
 */
export function selectTierOneNodes(nodes: PmlNode[]): PmlNode[] {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const candidates = nodes.filter((n) => {
        if (n.stale) return false;
        const salience = parseFloat(n.globalMeta['salience'] ?? '0');
        if (salience >= 0.7) return true;
        if (n.globalMeta['p'] === 'H') return true;
        if (n.updatedAt >= sevenDaysAgo) return true;
        return false;
    });

    // Sort: salience DESC, then updatedAt DESC
    candidates.sort((a, b) => {
        const sa = parseFloat(a.globalMeta['salience'] ?? '0');
        const sb = parseFloat(b.globalMeta['salience'] ?? '0');
        if (sb !== sa) return sb - sa;
        return b.updatedAt.localeCompare(a.updatedAt);
    });

    return candidates.slice(0, TIER_ONE_MAX);
}

// 2. selectTierTwoNodes

/**
 * Tokenize a user message into keywords for Tier 2 matching.
 * Removes stop words, lowercases, and filters out tokens shorter than 2 chars.
 */
function extractKeywords(message: string): string[] {
    return message
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Select Tier 2 nodes — context-matched against the user's current message.
 *
 * A node matches if any extracted keyword appears in its `item` text or `path`.
 * Nodes already selected in Tier 1 are excluded.
 * Capped at 10 additional nodes.
 */
export function selectTierTwoNodes(
    nodes: PmlNode[],
    userMessage: string,
    alreadySelected: PmlNode[]
): PmlNode[] {
    const keywords = extractKeywords(userMessage);
    if (keywords.length === 0) return [];

    const selectedIds = new Set(alreadySelected.map((n) => n.id));

    const matches = nodes.filter((n) => {
        if (n.stale) return false;
        if (selectedIds.has(n.id)) return false;

        const haystack = `${n.item} ${n.path}`.toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
    });

    return matches.slice(0, TIER_TWO_MAX);
}

// 3. buildSystemPrompt

export interface BuildPromptOptions {
    nodes: PmlNode[];
    userMessage: string;
    provider: string;
    conversationLength: number;
}

/**
 * Build the complete system prompt for an LLM call.
 */
export function buildSystemPrompt(options: BuildPromptOptions): string {
    const { nodes, userMessage, conversationLength } = options;

    // Tier 3: Cold-start override
    const activeNodes = nodes.filter((n) => !n.stale);
    if (activeNodes.length < COLD_START_THRESHOLD) {
        let prompt = COLD_START_PROMPT;
        if (activeNodes.length > 0) {
            const pmlBlock = serializePml(activeNodes);
            prompt = prompt.replace('{PML_BLOCK}', pmlBlock);
        } else {
            prompt = prompt.replace('\n\n[ACTUAL USER MEMORY]\nThe following are real memories about the user. Use them to personalize your response!\n{PML_BLOCK}', '');
        }

        if (conversationLength > 0 && conversationLength % DRIFT_REMINDER_INTERVAL === 0) {
            prompt += DRIFT_REMINDER;
        }
        return prompt;
    }

    // Tier 1: always-injected high-value nodes
    const tierOne = selectTierOneNodes(activeNodes);

    // Tier 2: context-matched nodes
    const tierTwo = selectTierTwoNodes(activeNodes, userMessage, tierOne);

    // Merge selected nodes (Tier 1 first, then Tier 2)
    const selected = [...tierOne, ...tierTwo];

    // Serialize with staleness annotation
    const sixtyDaysAgo = new Date(Date.now() - STALE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // serializePml gives us one-line-per-node output
    const serialized = serializePml(selected);
    const annotatedLines = serialized.split('\n').map((line, idx) => {
        const node = selected[idx];
        if (node && node.updatedAt < sixtyDaysAgo) {
            return `${line} ~stale?`;
        }
        return line;
    });

    const pmlBlock = annotatedLines.join('\n');

    // Assemble full prompt
    let prompt = FULL_SYSTEM_PROMPT_TEMPLATE.replace('{PML_BLOCK}', pmlBlock);

    // Instruction drift mitigation
    if (conversationLength > 0 && conversationLength % DRIFT_REMINDER_INTERVAL === 0) {
        prompt += DRIFT_REMINDER;
    }

    return prompt;
}

// 4. estimateTokens

/**
 * Fast token count estimator.
 * Uses the ~4 characters per token heuristic, which is accurate enough
 * for budget gating against context window limits.
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
