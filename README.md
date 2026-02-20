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
AI:  [85 lines dumped at once]
     "Let me know if you need changes."
You: "Looks good" [accepts all, understands nothing]
```

**After Grasp:**
```
You: "Add rate limiting to the upload endpoint"
AI:  [captures intent via grasp_start_task]
     Before I write this — rate limit per user, per IP, or global?
You: "Per user, 429 response, Redis"

AI:  [logs chunk with explanation via grasp_log_chunk]
     Here's the sliding window rate limiter using Redis...
     [code — 14 lines]

     [calls grasp_check — gets your first question]
     Quick check: Why did I use a sliding window instead of a
     fixed window approach here?

You: "Fixed windows allow burst traffic at boundaries."
AI:  [records via grasp_record — correct]
     Exactly. Next question: If Redis goes down with 4 app
     instances, what's the effective rate limit?

You: "4x the configured limit since each instance tracks separately."
AI:  Solid — you own this decision.
```

**Same tool. Same interface. You just actually own the code.**

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

Grasp runs as an MCP server alongside your AI tool. It provides 10 tools that change how the AI behaves:

1. **Design capture** — Every code block gets a "why" explanation via `grasp_log_chunk` (the core rule)
2. **Intent capture** — AI asks what you're building before generating (recommended, auto-creates if skipped)
3. **Design review** — When familiarity is low, AI discusses approach with you before writing code
4. **Smart checks** — Comprehension questions only when you're in unfamiliar territory (familiarity < 50)
5. **Context on read** — When AI reads a file with stored decisions, they appear automatically
6. **Coverage scoring** — "78% of AI files have design context" — meaningful, not arbitrary
7. **Decision lookup** — `grasp why <file>` shows design decisions during review, debugging, or onboarding
8. **Familiarity memory** — Grasp remembers what you know, adapts accordingly
9. **Codebase heatmap** — `grasp map` shows a color-coded tree of all AI-generated files by familiarity

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
