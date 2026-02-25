# Supercharge PLM (Personal Memory Language) Implementation Roadmap
**With Absolute Memory + Decreased Token Usage Strategies**

This document outlines the systematic plan to implement the PML logic described in the Supercharge PRD (v2.0), optimized heavily for minimal LLM token consumption. 
You can use the **Agent Prompt** section in each phase to copy-paste the exact instructions back to me (Antigravity) later so I know exactly what to build for that specific chunk.

---

## Phase 1: Core PML Kernel & Minified Parsing
**Objective**: Build the foundational TypeScript parser to handle the PML syntax and extract `MEMORY_OP` blocks, while implementing payload minification to save base tokens (5-10% savings).

1. **Type Definitions**: Interfaces for `PmlNode`, `PmlCommand`, `CategoryHash`, and metadata.
2. **Lexer & Parser Development**: Regex rules to decode: `COMMAND #CAT:Root.Sub [Item|key:val] <GlobalKey:val> @LINK ^INHERIT`.
3. **LLM `MEMORY_OP` Extractor**: Scan responses and parse the block demarcated by triple backticks.
4. **PML Payload Minification**: Stringify the active memory graph back into PML text, but aggressively *strip all whitespace, tabs, newlines, and abbreviate system instructions* to inject into the LLM system prompt.

> **Agent Prompt (Copy-Paste this to Antigravity)**:
> *"Hey Antigravity, let's start Phase 1 from the plm-implementation-roadmap.md. I want you to build the core TypeScript parser in `src/lib/pmlParser.ts`. Focus on strict types, Regex for the canonical PML syntax, the MEMORY_OP extractor, and the crucial `minify()` function that strips all whitespace when serializing PML back into a string to save tokens. Please write the complete module and some unit tests."*

---

## Phase 2: State Management & Token-Aware Storage
**Objective**: Connect the pure TypeScript parsing logic to Firebase/Firestore, persisting the nodes and managing basic safeguards.

1. **Database Schema Construction**: Setup the document schema for `users/{uid}/memory`. 
2. **Mutation Handlers Implementation**: Handlers for `STORE` (insert), `UPDATE` (overwrite), `PATCH` (time-series append), and `DELETE` (mark as `STALE`).
3. **Context Injector Base**: Create the initial system prompt wrapper injected before every user message.

> **Agent Prompt (Copy-Paste this to Antigravity)**:
> *"Hey Antigravity, let's move to Phase 2 of the roadmap. Hook up our `pmlParser.ts` logic to Firestore. I need you to create the mutation handlers for STORE, UPDATE, PATCH, and DELETE in a new `src/lib/memoryStore.ts` file, ensuring we structure the `users/{uid}/memory` document correctly for efficient reading and writing. Also, create the base function that injects the minified PML into the system prompt."*

---

## Phase 3: Conversation History Pruning (The "Attention Window")
**Objective**: Drastically reduce contextual tokens (up to 90% savings) by discarding older raw messages from the LLM payload, relying solely on the stored PML facts.

1. **Token Budget Thresholding**: In `chatService.ts`, estimate the token count of the payload before sending it to the provider. 
2. **Short-Term Memory Window**: Modify `useChatHistory.ts` & `chatService.ts` to only send the last `N` messages raw to the LLM. 
3. **Long-Term Memory Handover**: Because the LLM outputs `MEMORY_OP`s continuously, drop messages older than `N` from the LLM prompt block entirely—relying solely on the PML context graph to give the LLM ongoing memory.

> **Agent Prompt (Copy-Paste this to Antigravity)**:
> *"Hey Antigravity, we are on Phase 3: Conversation History Pruning. I need you to modify `src/lib/chatService.ts` and `src/hooks/useChatHistory.ts`. Implement a token budget threshold estimator. Only send the last N messages to the LLM (sliding window), dropping older messages completely before making the API call, so we rely entirely on the injected PML to remember past context. Let's maximize our token savings."*

---

## Phase 4: Dynamic PML Injection & Advanced Querying (v2.0)
**Objective**: Only inject the memory nodes that matter for the current context to save 40-70% payload tokens.

1. **Salience & TTL Filtering**: Omit nodes with low `<salience>` scores or expired `<ttl>` dates from the system prompt.
2. **Contextual Masking (`CTX`)**: If a user is in `CTX:work`, dynamically filter out `#pf:food` or `#lc:home` nodes before building the minified PML string to send to the LLM.
3. **`RECALL` Engine & `ON` Triggers**: Execute internal searches on the memory store supporting `WHERE/SINCE/LIMIT`, triggered actively by user context changes (e.g., date checks or entity mentions).

> **Agent Prompt (Copy-Paste this to Antigravity)**:
> *"Hey Antigravity, time for Phase 4. We need to implement Dynamic PML Injection. Update our memory injector to filter out nodes with low salience or expired TTLs. Implement Contextual Masking (CTX) so that passing unrelated nodes like food preferences into a work chat doesn't happen, saving us huge amounts of tokens. Next, build out the RECALL engine and automatic ON triggers."*

---

## Phase 5: UI Hooks & Memory Presentation
**Objective**: Surface the memory mechanics natively into the Supercharge interface.

1. **Inline Chat Indicators**: A small UI notification (e.g., a violet dot displaying "n memories saved") hooked to the `MEMORY_OP` extraction.
2. **Memory Explorer UI Panel**: A sliding side-panel grouping memory nodes logically by `#CAT` hashes, reading from the fetched Firestore JSON.
3. **Manual CRUD Override**: Allow users to explicitly edit/delete nodes directly from the UI, bypassing the LLM.
4. **Raw Data Export**: Dump the serialized PML document to a `.txt` file.

> **Agent Prompt (Copy-Paste this to Antigravity)**:
> *"Hey Antigravity, final push: Phase 5. Let's bring the memory into the UI. I want an inline chat indicator that shows when a MEMORY_OP was executed. More importantly, build the 400px Memory Explorer side panel in React so the user can see their grouped memory nodes, manually edit/delete them, and export them as a .txt file. Hook it up to the existing dark minimalist design."*
