# Grasp

### Know your code. Own your code.

AI writes your code. Grasp makes sure you understand it.

Point at any line. Ask "why?" You'll have the answer.

---

## The Problem

You use AI every day. It writes half your code. A teammate walks over and points at a function — *"Hey, why does this retry three times before falling back to the cache?"*

You either know the answer, or you don't.

**59% of developers ship AI-generated code they can't explain.** Not because the code is bad — because they never understood it in the first place.

Every AI coding tool optimizes for speed. None of them ask: *"Do you actually understand what you just shipped?"*

Grasp does.

## What It Does

Grasp is an open-source **MCP server** that works inside the AI tools you already use — Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini CLI. No new app. No new interface.

It transforms how your AI generates code:

**Before Grasp:**
```
You: "Add rate limiting to the upload endpoint"
AI:  [dumps 85 lines]
     "Let me know if you need changes."
You: "Looks good" [accepts all, understands nothing]
```

**After Grasp:**
```
You: "Add rate limiting to the upload endpoint"

── 1. Intent & Familiarity ──────────────────────────
AI:  [grasp_start_task → familiarity: 12/100 → guided mode]
     You're unfamiliar with this area. Let's talk design first.

── 2. Design Review (before any code) ───────────────
AI:  I'm thinking sliding window in Redis with per-user keys.
     What should happen when Redis is down — fail open or fail closed?
You: "Fail open. Better to let requests through than block everyone."
AI:  Got it. What status code for rate-limited requests?
You: "429 with a Retry-After header."

── 3. Code with Explanations ────────────────────────
AI:  [writes code, logs each block with grasp_log_chunk]

     WHAT: Sliding window rate limiter middleware
     HOW:
       → Hash user ID into Redis key with TTL
       → INCR + EXPIRE in a pipeline (atomic)
       → If count > limit → 429 with Retry-After header
       → If Redis unreachable → fail open (let request through)
     WHY: Sliding window prevents burst traffic at window
          boundaries that fixed windows allow

     [code — 22 lines]

── 4. Comprehension Check ──────────────────────────
AI:  [grasp_check]
     Why did we use INCR + EXPIRE in a pipeline instead of
     a single SET with NX?
You: "Pipeline makes the increment and TTL atomic — SET NX
      would only set on first request and miss the count."
AI:  Exactly. You own this code.
```

**Same tool. Same interface. You just actually understand what you shipped.**

## Install

**Homebrew:**
```bash
brew install codersanket/tap/grasp
```

**npm:**
```bash
npm install -g grasp-mcp
```

Then configure your project:
```bash
cd your-project
grasp init
```

`grasp init` auto-detects your AI tools and configures everything.

## How It Works

Grasp runs as an MCP server alongside your AI tool. It provides 10 tools that follow a natural workflow:

**Before code is written:**
1. **Intent capture** — AI records what you're building and checks your familiarity with the files involved
2. **Design review** — When familiarity is low, AI discusses the approach with you before writing a single line
3. **Write protection** — AI is blocked from editing files until design review is complete (Claude Code hooks)

**While code is generated:**
4. **Design capture** — Every code block gets a structured WHAT/HOW/WHY explanation stored in a database
5. **Context on read** — When AI reads a file with stored decisions, they surface automatically

**After code is generated:**
6. **Smart checks** — Comprehension questions only when you're in unfamiliar territory
7. **Familiarity memory** — Grasp remembers what you know and adapts over time

**Anytime:**
8. **Decision lookup** — `grasp why <file>` shows why any AI-generated code was written the way it was
9. **Codebase heatmap** — `grasp map` shows a color-coded tree of all AI-generated files by familiarity
10. **Coverage scoring** — Track what percentage of your AI-generated codebase has design context

## Supported Tools

| Tool | Support |
|------|---------|
| Claude Code | Full (MCP + Hooks + Rules) |
| Cursor | Full (MCP + Rules) |
| OpenAI Codex | Full (MCP + AGENTS.md) |
| GitHub Copilot | Full (MCP + Instructions) |
| Windsurf | Full (MCP + Rules) |
| Gemini CLI | Full (MCP + Rules) |
| Cline / Roo Code | MCP only (manual setup) |

## Commands

```bash
grasp init          # Auto-detect tools, configure everything
grasp score         # Show your comprehension score (coverage + engagement)
grasp why <file>    # Show design decisions for any file
grasp map           # Show color-coded familiarity heatmap of AI-generated files
grasp status        # Show which tools are configured
```

### `grasp map`

See which AI-generated files you understand — and which ones you don't.

```
  Grasp — Codebase Familiarity Map

  lib/
  ├── presentation/upi/
  │   ├── upi_receipt/
  │   │   ├── upi_receipt_screen.dart        ██░░░░░░░░ 15/100  (3 chunks)
  │   │   └── receipt_image_widget.dart       █░░░░░░░░░ 12/100  (2 chunks)
  │   └── upi_transaction_history/
  │       ├── upi_transaction_history_screen  ████████░░ 72/100  (3 chunks)
  │       └── cubit/
  │           ├── ...state.dart               ██████░░░░ 55/100  (1 chunk)
  │           └── ...cubit.dart               ███████░░░ 68/100  (2 chunks)
  └── data/core/router/
      └── go_router_config.dart               ██████████ 90/100  (6 chunks)

  6 AI-generated files | Avg familiarity: 52/100 | 2 files need attention (< 30)
```

- **Red** (0-30): You don't understand this code
- **Yellow** (31-60): Partial understanding
- **Green** (61-100): You own it

Options: `--sort score|name|recent`, `--no-color`

Inside any AI chat:
- Say **"grasp score"** to see your stats
- Say **"full speed"** or **"skip checks"** to skip questions for the current task

## Why Grasp Exists

AI coding tools made us faster. They also made us strangers in our own codebases.

**Comprehension debt** — code you don't understand well enough to know if it's bad — is the hidden cost of every AI-generated line you accept without understanding.

Unlike technical debt (which you know about), comprehension debt is invisible until someone asks you to explain your own code and you can't.

Grasp exists so that never happens.

## License

AGPL-3.0 — Free to use, modify, and self-host. If you offer Grasp as a service, your modifications must be open-sourced.

---

*Built by developers who refuse to be strangers in their own codebases.*
