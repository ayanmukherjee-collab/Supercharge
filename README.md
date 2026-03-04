# Supercharge

## What is Supercharge?
Supercharge is an advanced, memory-augmented AI chat application designed to provide deeply personalized and context-aware interactions. Unlike traditional AI chatbots that start with a blank slate in every session, Supercharge employs a persistent memory layer to learn about you over time—remembering your preferences, work details, past projects, and specific facts you've shared. The goal is to create an assistant that grows with you, seamlessly integrating your personal context into every response without needing explicit, repetitive reminders from the user.

### Key Uses
- **Persistent Personal Assistant:** Remembers your routine, diet, goals, and projects across multiple disconnected sessions.
- **Context-Aware Coding & Work:** Stores your preferred tech stacks, ongoing tasks, and historical decisions so you never have to re-explain your environment.
- **Continuous Learning:** As you talk to the AI, it automatically extracts and updates facts about you without any manual configuration or forms to fill out.
- **Multi-Model Support:** Built to work seamlessly with a range of top-tier LLM providers (OpenAI, Anthropic, Gemini, Cohere) while preserving your exact memory context across all of them.

---

## 🛠️ Tech Stack

- **Frontend:** React (v18), Vite, TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **Backend/Storage:** Supabase (PostgreSQL)
- **AI Orchestration:** Custom PML Injection Layer

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- A Supabase account
- API keys for your preferred LLM providers (OpenAI, Anthropic, etc.)

### 2. Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd Supercharge

# Install dependencies
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the `Supercharge` directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server
```bash
npm run dev
```

---

## The Secret Sauce: Personal Memory Language (PML)

### What is PML?
Personal Memory Language (PML) is a proprietary, token-efficient syntax designed specifically to inject long-term memory into Large Language Models (LLMs) via system prompts. Instead of dumping raw, verbose chat history into the context window or relying on clunky retrieval-augmented generation (RAG) pipelines, PML condenses user facts into a strict, highly structured format.

For example, instead of the AI reading:
*"The user told me last Tuesday that they really like eating pizza and their current role is a Software Engineer."*

PML synthesizes this into:
```text
STORE #pf:food.pizza [pizza] | conf=0.9
STORE #wk:role.current [Software Engineer] | conf=0.9
```

These condensed "memory nodes" are stored in a database and dynamically injected into the AI's system prompt during a conversation based on relevance and importance (salience).

### The PML Specification

#### Categories (Tags)
| Hash | Category | Use Cases |
| :--- | :--- | :--- |
| `#pf` | Preference | Likes, dislikes, tastes, UI preferences |
| `#ac` | Action | Past events, completed tasks, habits |
| `#fc` | Fact | Hard data, IDs, specs, numbers |
| `#en` | Entity | People, pets, objects (linked nodes) |
| `#lc` | Location | Places, addresses, visited spots |
| `#pl` | Plan | Future intent, goals, reminders |
| `#wk` | Work | Projects, clients, professional context |
| `#hl` | Health | Medical history, diet, fitness |
| `#st` | State | Current mood, energy, situational status |
| `#ep` | Episode | Timestamped conversational event log |

#### Operators & Metadata
- **`|` (Pipe):** Attaches metadata (`|conf:0.9`, `|p:H`).
- **`@` (Link):** Creates relationship pointers between nodes.
- **`~` (Tilde):** Marks uncertainty or unconfirmed facts (`~stale?`).
- **`!` (Bang):** Strict negation or "never" constraints.
- **`PATCH` Command:** Handles time-series data (e.g., tracking weight over months without losing history).

### New PML Logic

Supercharge doesn't just "dump" these tags into the prompt. It uses an advanced multi-tiered logic to ensure the AI stays sharp:

1. **Tiered Injection Strategy:**
   - **Tier 1 (High Salience):** Always-injected facts with `salience > 0.7` or `Priority: H`.
   - **Tier 2 (Contextual):** Dynamically matched nodes based on keywords in your current message.
   - **Tier 3 (Cold Start):** A specialized "teaching" prompt for users with < 5 memories.
2. **Conflict Resolution:** If you change your mind (e.g., "I'm vegan" → "I eat meat"), the PML kernel detects the semantic contradiction and triggers a resolution pass to clean up the store.
3. **Staleness Tracking:** Nodes older than 60 days are automatically tagged with `~stale?`, prompting the AI to verify the fact before asserting it as truth.
4. **Instruction Drift Mitigation:** Every 20 messages, the system re-anchors the memory instructions to prevent the model from "forgetting" to save new facts in long sessions.
5. **Privacy First (BYOK):** API keys are AES-256 encrypted client-side. The memory data is stored in your private database, and `vis:priv` tagged nodes never leave the secure prompt injection layer.

### Pros and Cons of PML

#### Pros:
1. **O(1) Token Scaling (Extreme Efficiency):** Because PML is highly condensed and only a strict subset of relevant memories (e.g., top 20 high-priority Tier 1 nodes + 10 contextual Tier 2 nodes) are injected into the prompt at any given time, the token usage has a hard ceiling (max ~700 tokens). Whether you have 50 memories or 5,000, your context window usage and inference costs remain completely stable.
2. **Infinite-Feeling Long-Term Memory:** You never lose track of old facts. The system seamlessly surfaces them when relevant keywords are triggered in your conversation.
3. **Structured Reliability:** By keeping memories as discrete nodes with categories (e.g., `#pf` for preference, `#wk` for work), staleness tracking, and confidence scores, the AI can selectively update, patch, or delete facts as you naturally change over time.
4. **Model Agnostic:** PML works purely in the prompt injection layer. This means you can swap the underlying AI model (e.g., from GPT-4o to Claude 3.5 Sonnet) mid-conversation, and your complete memory profile comes with you.

#### Cons:
1. **Short-Term Token Overhead:** For brand-new users with zero memories, the system still has to inject the PML instructions (the "Cold Start Prompt"). This means you pay a ~200 token "tax" per message early on before the benefits of having a long-term memory truly kick in.
2. **Extraction Overhead:** The AI has to output a `MEMORY_OP` block at the end of its response to save new memories. This adds a slight delay to the end of the generation stream as it prints out the memory syntax (which the UI parses and hides from the user).
3. **Prompt Brittleness:** Smaller, less capable models (those below the GPT-4/Claude 3.5 class) may occasionally get confused by the strict PML syntax or accidentally output the raw syntax to the user if they fail to follow the system instructions perfectly.

---

### Why Should We Use It?
If you're building a chat interface where the user expects the AI to *know* them over weeks, months, or years, a standard stateless LLM falls short. 

The traditional brute-force solution (putting entire chat histories into the context window) becomes prohibitively expensive, creates massive latency, and leads to the "lost in the middle" phenomenon where the AI simply ignores older context. On the other hand, traditional RAG systems are great for querying large document bases but often feel unnatural and clunky for maintaining a coherent, evolving persona of the user.

PML offers the perfect middle ground: **Zero-latency context injection, mathematically bounded token costs, and structured state management.** It allows Supercharge to feel like a true digital companion that learns and evolves alongside the user, rather than a goldfish resetting its memory every 24 hours.
