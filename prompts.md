# Supercharge — PML Implementation Prompts
**Step-by-step prompts to paste to Antigravity, one at a time.**
Each prompt is self-contained. Read any notes before pasting.

---

## PROMPT 1 — PML Types, Parser & MEMORY_OP Extractor

> **What this builds:** `src/lib/pmlParser.ts` — the foundational TypeScript module for the entire PML system. All other prompts depend on this.

```
Read the files `supercharge.txt` and `supercharge-issues.txt` at the root of the workspace so you have full context on the PML spec.

Then, create `src/lib/pmlParser.ts` inside the `/Supercharge` project. This is the core PML parser module. Build the following in one complete file:

1. **Type definitions** — Export these interfaces:
   - `PmlCategory`: union of all 10 category hashes: 'pf' | 'ac' | 'fc' | 'en' | 'lc' | 'pl' | 'wk' | 'hl' | 'st' | 'ep'
   - `PmlCommand`: union of all commands: 'STORE' | 'UPDATE' | 'PATCH' | 'DELETE' | 'RECALL' | 'LINK' | 'MERGE' | 'ON' | 'CTX'
   - `PmlMetadata`: Record<string, string> for inline pipe metadata (key:val pairs after |)
   - `GlobalMeta`: Record<string, string> for angle-bracket global metadata (<key:val>)
   - `PmlNode`: full parsed node with fields: id (string), command (PmlCommand), category (PmlCategory), path (string), item (string), metadata (PmlMetadata), globalMeta (GlobalMeta), links (string[]), inherits (string | null), rawLine (string), stale (boolean), version (number), createdAt (string), updatedAt (string)

2. **Parser function** `parsePmlLine(line: string): PmlNode | null`
   - Use regex to parse the canonical syntax: `COMMAND #CAT:Root.Sub [Item|key:val|key:val] <GlobalKey:val> @LINK ^INHERIT`
   - Extract all parts: command, category + path, item payload, pipe metadata, global metadata, @links, ^inherit
   - Return null for comment lines (// ...) or blank lines
   - Generate a deterministic id from: `${category}:${path}` (used as the Supabase lookup key)

3. **MEMORY_OP block extractor** `extractMemoryOp(llmResponse: string): { displayText: string; commands: string[] }`
   - The LLM wraps its memory commands in a triple-backtick block labelled MEMORY_OP:
     ```
     \`\`\`MEMORY_OP
     STORE #en:person [arjun|rel:self] <src:user>
     \`\`\`
     ```
   - Strip the MEMORY_OP block from the response entirely
   - Return `displayText` (clean response shown to user, with no PML visible) and `commands` (array of raw PML command strings)
   - Also detect and strip any accidental PML leakage in `displayText` using the regex `/#[a-z]{2}:[^\s]+\s*\[/g`

4. **PML serializer/minifier** `serializePml(nodes: PmlNode[]): string`
   - Reconstruct a minimal PML string from an array of active (non-stale) nodes
   - Output format: one node per line, no comments, no extra whitespace
   - Only include non-stale nodes
   - Example output line: `#en:person[arjun|rel:self]<src:user>`
   - Omit any metadata key with an empty value

5. **RECALL query parser** `parseRecallQuery(line: string): { category: string; path: string; filters: Record<string, string>; since?: string; until?: string; limit?: number; sort?: string } | null`
   - Parse lines like: `RECALL #pf:food WHERE s:-- SINCE 2026-01-01 LIMIT 5 SORT t:desc`

Do not connect to Supabase or Firebase in this file — it is pure logic only. Export all functions and types. Write the complete file.
```

---

## PROMPT 2 — Supabase Memory Store (CRUD Handlers)

> **What this builds:** `src/lib/memoryStore.ts` — connects the parser to Supabase, implementing all CRUD operations with optimistic locking (fixes issue #3.1).
> **Prerequisite:** Prompt 1 must be done. Supabase is already set up in `src/lib/supabase.ts`.

```
Read `supercharge-issues.txt` for the full list of issues. We are fixing: #2.1 (STORE/UPDATE confusion), #2.3 (TTL pruning), #2.4 (PATCH history cap), #2.5 (node count cap), #3.1 (race conditions), #3.2 (session desync), #4.1 (memory poisoning), #4.3 (sensitive data).

Create `src/lib/memoryStore.ts`. This module handles all Supabase reads/writes for PML memory nodes.

**Supabase table schema to target** (the table is called `memory_nodes`):
```sql
memory_nodes (
  id TEXT,           -- deterministic key: "{category}:{path}" e.g. "en:person.arjun"
  user_id UUID,      -- from Supabase auth.uid()
  command TEXT,      -- last written command
  category TEXT,     -- 2-letter hash without #
  path TEXT,         -- Root.Sub path
  item TEXT,         -- payload value
  metadata JSONB,    -- pipe-separated key:val pairs as JSON object
  global_meta JSONB, -- angle-bracket key:val pairs as JSON object
  links TEXT[],      -- @LINK targets
  inherits TEXT,     -- ^INHERIT reference
  stale BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

**Build these exported functions:**

1. `fetchAllMemory(userId: string): Promise<PmlNode[]>`
   - Fetch all non-stale nodes for userId, ordered by updated_at DESC
   - Map Supabase rows back to PmlNode objects

2. `executeMemoryOp(userId: string, commands: string[]): Promise<{ written: number; skipped: number; errors: string[] }>`
   - Takes the array of raw PML command strings from `extractMemoryOp()`
   - Parses each with `parsePmlLine()` from pmlParser.ts
   - Routes each to the appropriate handler below
   - Wraps all writes in a batch (use Promise.all for parallel writes, catch per-item errors)
   - **STORE handler**: Check if node id already exists. If YES, auto-upgrade to UPDATE (log this upgrade). If NO, insert. Upsert on (user_id, id).
   - **UPDATE handler**: Overwrite the existing row. Include version check — read current version, write with version+1. If version mismatch (0 rows updated), retry once after 200ms.
   - **PATCH handler**: Read existing item array (or create). Append new entry with timestamp. Cap at 50 entries — if over cap, compute min/max/avg of entries older than 30 days, store as `_summary` metadata, drop the raw old entries.
   - **DELETE handler**: Set `stale = true`, do NOT hard delete (soft delete).
   - **Sanitise before every write** (fix #4.1): Reject or sanitize any node where `item` value contains: "STORE", "UPDATE", "DELETE", "ignore instructions", "admin", "override", "system access". Log rejections.
   - **Sensitive data check** (fix #4.3): Before writing, scan item for patterns matching card numbers (\d{4}[\s-]\d{4}), SSN (\d{3}-\d{2}-\d{4}), or the word "password". If matched, skip the write and add to errors array.

3. `pruneExpiredNodes(userId: string): Promise<number>`
   - Set stale=true on all nodes where global_meta->>'ttl' < today's date
   - Set stale=true on all #st nodes older than 24 hours
   - Returns count of pruned nodes

4. `getNodeCount(userId: string): Promise<{ active: number; stale: number }>`
   - Returns counts of active vs stale nodes for the user

5. `hardDeleteNode(userId: string, nodeId: string): Promise<void>`
   - Permanently deletes a single node row (for Memory Explorer hard delete UX — fixes #5.2)

Import `PmlNode`, `parsePmlLine` from `./pmlParser`. Import `supabase` from `./supabase`. Export all functions.
```

---

## PROMPT 3 — Smart System Prompt Builder (Tiered PML Injection)

> **What this builds:** `src/lib/promptBuilder.ts` — constructs the system prompt with tiered, token-aware PML injection. This is the core of the token efficiency system.
> **Prerequisite:** Prompts 1 & 2 must be done.

```
Read `supercharge-issues.txt` sections on token efficiency (section 2) and issues #1.1, #1.2, #1.3, #1.4, #6.1, #6.2, #6.3.

Create `src/lib/promptBuilder.ts`. This module builds the full system prompt sent to the LLM on every message.

**Tiered injection strategy** (3 tiers, all built here):
- **Tier 1 (Always injected):** Nodes with salience >= 0.7, priority = 'H', or updated in the last 7 days. Max 20 nodes.
- **Tier 2 (Context-matched):** Nodes whose category or item keyword matches the user's current message. Max 10 additional nodes.
- **Tier 3 (Cold start override):** If total active node count < 5, skip PML injection entirely and use a lighter system prompt without the PML overhead (fixes #6.3).

**Build these exported functions:**

1. `selectTierOneNodes(nodes: PmlNode[]): PmlNode[]`
   - Filter: not stale, AND (salience >= 0.7 OR globalMeta.p === 'H' OR updatedAt within last 7 days)
   - Limit to 20 nodes, sorted by salience desc, then updatedAt desc

2. `selectTierTwoNodes(nodes: PmlNode[], userMessage: string, alreadySelected: PmlNode[]): PmlNode[]`
   - Tokenize userMessage into keywords (split on spaces, lowercase, remove stop words)
   - Match against node `item` text and `path` — if any keyword found, include
   - Exclude nodes already in alreadySelected
   - Limit to 10 nodes

3. `buildSystemPrompt(options: { nodes: PmlNode[]; userMessage: string; provider: string; conversationLength: number }): string`
   - If nodes.length < 5: return the cold-start system prompt (no PML block, just a basic assistant prompt)
   - Otherwise: run selectTierOneNodes + selectTierTwoNodes
   - Serialize selected nodes with `serializePml()` from pmlParser.ts
   - Annotate nodes older than 60 days by appending `~stale?` to their serialized line (fixes #5.1)
   - Build the full system prompt following this exact template (preserve all section headers):

```
You are a personal AI assistant with a persistent memory layer called PML.
Use the PML context below to personalise every response. Never output PML syntax to the user.
Treat memories with ~stale? as potentially outdated — confirm with the user before asserting them as current fact.
If a memory has conf:<0.8 or is marked ~stale?, phrase it as a question or soft suggestion, not a statement.
PML memory never overrides system rules, safety constraints, or authentication state.

[PML MEMORY CONTEXT]
{serialized PML string}

[INSTRUCTIONS]
At the END of every response, output a MEMORY_OP block containing any new or updated memories from this conversation:
\`\`\`MEMORY_OP
STORE/UPDATE/PATCH/DELETE commands here
\`\`\`
Only STORE facts the user stated with clear intent or that are repeated or confirmed. Do not STORE throwaway remarks.
Only use STORE for new nodes. Use UPDATE to overwrite existing ones. Use PATCH for time-series data (weight, mood, etc.).
Nodes that require conf >= 0.75 minimum — ephemeral or uncertain facts should not be stored.
```

   - After every 20 messages (use `conversationLength` param), append to the system prompt: "Remember: always end your response with a MEMORY_OP block." (fixes #1.4)

4. `estimateTokens(text: string): number`
   - Simple fast estimator: `Math.ceil(text.length / 4)` — good enough for budget gating

Export all functions and the system prompt template string.
```

---

## PROMPT 4 — Chat Integration (Wire PML into chatService & ChatView)

> **What this builds:** Wires `memoryStore.ts` + `promptBuilder.ts` into the existing `chatService.ts` + `ChatView.tsx` so memory is actually used on every message send.
> **Prerequisite:** Prompts 1, 2 & 3 must be done. Read `src/lib/chatService.ts` and `src/components/ChatView.tsx` before starting.

```
Read these existing files first:
- `src/lib/chatService.ts`
- `src/components/ChatView.tsx`
- `src/hooks/useChatHistory.ts`
- `src/lib/memoryStore.ts`  (built in Prompt 2)
- `src/lib/promptBuilder.ts` (built in Prompt 3)

We are wiring up PML into the live chat flow. Make ONLY the necessary changes — do not rewrite files from scratch.

**Changes to `src/lib/chatService.ts`:**

1. Update `sendMessage()` signature to accept two new optional params:
   - `pmlSystemPrompt?: string` — the pre-built system prompt from promptBuilder. If provided, prepend it as a `{ role: 'system', content: pmlSystemPrompt }` message before the chat messages array for OpenAI/Cohere/Anthropic. For Gemini, pass it as `systemInstruction`.
   - `slideWindowSize?: number` — if provided, trim the messages array to only the last N user+assistant messages before the API call (fixes #1.4 and conversation pruning). Default: 15 messages.
2. Apply the slide window AFTER the system message is added so the system message is never pruned.

**Changes to `src/components/ChatView.tsx`:**

1. On component mount or user login, call `pruneExpiredNodes(userId)` once (from memoryStore.ts).
2. Before calling `sendMessage()`, call:
   - `fetchAllMemory(userId)` to get current PML nodes
   - `buildSystemPrompt({ nodes, userMessage: input, provider: activeProvider, conversationLength: messages.length })` to build the system prompt
   - Pass the result as `pmlSystemPrompt` to `sendMessage()`
3. After the full streaming response is received (on stream complete), call `extractMemoryOp(fullResponse)`:
   - Display `displayText` in the chat (not the raw LLM output)
   - If `commands.length > 0`, call `executeMemoryOp(userId, commands)` to persist new memories
   - If `commands.length > 0`, show the existing "memory updated" indicator in the UI with the count of written nodes (use the `written` count from the result)
   - If `commands.length === 0` (LLM forgot to output MEMORY_OP — fixes #1.1): queue a lightweight follow-up call with the same provider using this single-message prompt: "Please output only the MEMORY_OP block for your previous response. No other text." Parse the follow-up response the same way.
4. After `executeMemoryOp()` completes, also save the `written` count to a local React state `lastMemoryCount` and pass it to the "memory updated" indicator in the message.

Keep all existing streaming, error handling, and UI patterns intact. Only add/modify what is needed.
```

---

## PROMPT 5 — Memory Explorer Side Panel

> **What this builds:** `src/components/MemoryExplorer.tsx` — the 400px sliding side panel for the user to view, edit, search, and delete their PML memories.
> **Prerequisite:** Prompts 1–4 must be done. Follow the existing glassmorphic dark design system exactly.

```
Read these files first:
- `src/components/ChatView.tsx` — to match the exact existing design system (colors, glass styles, spacing)
- `src/lib/memoryStore.ts` — for fetchAllMemory, hardDeleteNode, getNodeCount
- `src/lib/pmlParser.ts` — for PmlNode type and serializePml

Create `src/components/MemoryExplorer.tsx`. This is a sliding side panel (not a full page) for viewing and managing PML memories.

**Design requirements (match the existing app exactly):**
- Panel: 400px wide, fixed right side, slides in from right with a smooth CSS transition (translateX)
- Background: `rgba(26,26,46,0.85)` + `backdrop-filter: blur(20px)` + `1px solid rgba(255,255,255,0.08)` border on left edge
- All text: Inter font, primary `#E2E8F0`, muted `#94A3B8`
- Accent color: `#6C63FF`
- Close button: top-right X, muted color, hover accent
- z-index above chat, below modals

**Panel layout (top to bottom):**

1. **Header bar:**
   - Title: "Your Memory" (Inter 600, 16px)
   - Node count badge: small pill showing "{n} memories" in accent color
   - Two buttons: "Export .txt" and "✕ Close"

2. **Search bar:**
   - Full-width input, dark glass background, placeholder "Search memories..."
   - Filters nodes in real time as user types (match against item + path text)

3. **Category tab bar:**
   - Horizontal scrollable pills: All | Preferences (#pf) | People (#en) | Plans (#pl) | Work (#wk) | Health (#hl) | Facts (#fc) | Location (#lc) | States (#st) | Episodes (#ep)
   - Active pill: filled `#6C63FF` background, white text
   - Inactive: transparent, muted text

4. **Memory node list (scrollable):**
   - Each node as a compact card (glass background, 1px border, 8px radius):
     - Top row: category badge (2-letter hash, accent color, small), node path in muted text
     - Main row: item value in primary text
     - Bottom row: timestamp (relative, e.g. "3 days ago"), confidence if present
     - Right side: pencil (edit) icon and trash (delete) icon
   - Nodes marked `~stale?` (older than 60 days): slightly dimmed opacity, italic item text, "⚠ stale" label
   - Empty state: centered muted text "No memories yet. Start chatting to build your memory."

5. **Edit mode (inline):**
   - Clicking pencil icon on a card: turns item text into an editable input
   - Save/Cancel buttons appear
   - On Save: call UPDATE via executeMemoryOp with the edited value
   - On Cancel: revert

6. **Delete flow (fixes #5.2):**
   - Clicking trash icon: show a small inline confirmation row ("Permanently delete?" + Confirm + Cancel)
   - On Confirm: call `hardDeleteNode(userId, node.id)` — hard delete, not soft
   - Show a brief "Deleted" toast for 2 seconds

7. **Export button:**
   - Calls `serializePml(activeNodes)` and downloads the result as `supercharge-memory.txt`

**Component props:**
```typescript
interface MemoryExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}
```

Wire this component into `ChatView.tsx`: toggle it open/close from the memory icon button in the input area (the button already exists). Pass the current user's uid as userId.
```

---

## PROMPT 6 — Critical Bug Fixes & Trust Layer

> **What this builds:** A targeted sweep of the highest-priority issues from `supercharge-issues.txt` that weren't fully covered in earlier prompts. Address issues: #5.3 (wrong memory erodes trust), #2.2 (contradictory nodes), #4.2 (cross-user isolation check).
> **Prerequisite:** All previous prompts must be done.

```
Read `supercharge-issues.txt` carefully, focusing on issues #2.2, #4.2, and #5.3.

Make the following targeted changes:

**1. Contradiction detection before writes (fixes #2.2) — add to `src/lib/memoryStore.ts`:**
- In the STORE/UPDATE handler of `executeMemoryOp()`, before writing any node, fetch all existing active nodes with the same category and same root path prefix.
- If an existing node's item value semantically contradicts the new value (use this simple heuristic: the new item starts with "!" (bang/negation) and the existing item matches the same keyword without "!", OR vice versa), treat this as a contradiction.
- When a contradiction is detected:
  - If new node uses "!" negation and old node does not: soft-delete the old node (set stale=true)
  - Add a `resolution: "contradiction_resolved"` entry to the new node's metadata
  - Log the resolution to console for monitoring

**2. "This is wrong" feedback button (fixes #5.3) — add to `src/components/ChatView.tsx`:**
- On every AI message bubble, add a small muted "⚑ Wrong memory?" link below the message text (hidden until hover).
- On click: show a small inline dropdown listing the last executed MEMORY_OP commands for that message (retrieve from message metadata stored after executeMemoryOp runs).
- User can click any command to immediately call `hardDeleteNode()` for that node.
- Show a toast: "Memory corrected. It won't affect future responses."
- Store the list of written node IDs alongside each assistant message in the chat state so we know which nodes to offer for deletion.

**3. RLS policy reminder comment (fixes #4.2) — add to `src/lib/memoryStore.ts`:**
- Add a prominent comment block at the top of the file:
```
/*
 * SECURITY: All Supabase queries in this file MUST include a user_id filter
 * derived from the authenticated session — NEVER from client-provided input.
 * Supabase RLS policy on memory_nodes table must enforce:
 *   using (auth.uid() = user_id)
 * This prevents cross-user memory leakage (Issue #4.2).
 * Verify RLS is enabled on memory_nodes before shipping.
 */
```
- Audit every query in the file to confirm `.eq('user_id', userId)` is present. Add it wherever missing.

**4. Confidence gating in `promptBuilder.ts` (fixes #5.3 continued):**
- In `buildSystemPrompt()`, before serializing nodes, filter out any node where `globalMeta.conf` is present and parseFloat(globalMeta.conf) < 0.6.
- For nodes where conf is between 0.6–0.79, append a `~uncertain` marker to their serialized line so the LLM knows to treat them as soft suggestions.

After making these changes, verify the app still builds with `npm run build` inside the `/Supercharge` directory and fix any TypeScript errors.
```

---

## PROMPT 7 — Cold Start Onboarding Conversation (Nice to Have)

> **What this builds:** A guided first-conversation that seeds the user's PML memory on first login. Addresses issue #5.4.
> **Prerequisite:** All previous prompts must be done.

```
Read `supercharge-issues.txt` issue #5.4 (Cold Start). Read `src/components/ChatView.tsx` and `src/lib/memoryStore.ts`.

When a user logs in and has 0 PML nodes (check via `getNodeCount(userId)`), run a seeded onboarding conversation automatically before they can type:

**Implementation in `ChatView.tsx`:**
1. On mount, after fetching memory, check if `activeNodeCount === 0`.
2. If true, set a React state flag `isOnboarding = true`.
3. While `isOnboarding` is true, show a different empty state banner: "Let's set up your memory. I'll ask you a few quick questions." with an "OK, let's go" button.
4. On button click, inject a hidden system message into the chat and trigger an automatic first AI message using this seeding prompt sent to the LLM:

```
You are starting a new user's personal memory onboarding for Supercharge.
Ask the user 4 short, natural questions one at a time to seed their core identity:
1. Their name and where they're based
2. What they do for work
3. One or two key preferences (hobbies, food, etc.)
4. Any ongoing project or goal they want to track

After each answer, output MEMORY_OP blocks as normal. When all 4 are answered, output exactly this line: [ONBOARDING_COMPLETE]
Keep the tone warm and conversational — not like a form. Short messages only.
```

5. When the AI's response contains `[ONBOARDING_COMPLETE]`, set `isOnboarding = false` and show the normal chat interface.
6. Strip `[ONBOARDING_COMPLETE]` from the displayed message text.
7. After onboarding, show the Memory Explorer briefly (auto-open for 3 seconds) with the newly seeded nodes visible, with a banner: "Your memory is ready. ✓"
```

---

## Notes for all prompts

- The project is at `d:\New Websites\PLM model supercharge\Supercharge`
- Stack: React + TypeScript + Vite + Tailwind CSS
- Database: Supabase (configured in `src/lib/supabase.ts`)
- Auth: Supabase Auth (user available via `AuthContext`)
- After every prompt, run `npm run build` inside `/Supercharge` to check for TypeScript errors before moving to the next prompt.
- Paste one prompt at a time. Wait for Antigravity to finish and confirm before pasting the next.
