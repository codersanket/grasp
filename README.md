# Grasp

### Know your code. Own your code.

AI writes your code. Grasp makes sure you understand it before it ships.

---

## The Problem

You use AI every day. It writes half your code. A teammate walks over and points at a function — *"Hey, why does this retry three times before falling back to the cache?"*

You either know the answer, or you don't.

**59% of developers ship AI-generated code they can't explain.** Not because the code is bad — because they never understood it in the first place.

Every AI coding tool optimizes for speed. None of them ask: *"Do you actually understand what you just shipped?"*

Grasp does.

## What It Does

Grasp is an open-source **MCP server** that works inside the AI tools you already use — Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini CLI. No new app. No new interface.

It turns AI code generation into a **design conversation**:

**Before Grasp:**
```
You: "Add a debounced search bar to the transaction history screen"
AI:  [dumps 120 lines across 4 files]
     "Here's the implementation. Let me know if you need changes."
You: "Looks good" [accepts all, understands nothing]
```

**After Grasp:**
```
You: "Add a debounced search bar to the transaction history screen"

── 1. Intent & Familiarity ──────────────────────────────
AI:  [grasp_start_task → familiarity: 28/100 → guided mode]
     You're unfamiliar with this area. Let's talk design first.

── 2. Design Conversation ──────────────────────────────
AI:  I'm thinking we add a SearchTransactions event to the
     existing BLoC with RxDart's debounceTime + switchMap —
     matching the pattern in UpiSendMoneyBloc.

     The main decision: should search filtering live in the
     BLoC (testable, state-driven) or stay local in the widget
     (simpler, but mixes logic into UI)?

     I'm leaning BLoC + RxDart. What's your take?
You: "Go with the BLoC + RxDart approach."

── 3. Design Recap + Pseudocode Plan ───────────────────
AI:  Here's what we agreed on:
     - Approach: BLoC + RxDart debounce (debounceTime + switchMap)

     Pseudocode plan:
     1. Add SearchTransactions event
     2. Extend state with searchQuery + searchedTransactions
     3. Register handler with RxDart transformer (300ms debounce)
     4. Add search bar widget in header area
     5. Update ListView to use searchedTransactions ?? transactions

     Want to change anything, or should I start coding?
You: "Start coding."

── 4. Code with Explanations ───────────────────────────
AI:  [writes code, logs each block via grasp_log_chunk]

     WHAT: Search event handler with RxDart debounce transformer
     HOW:
       → Register on<SearchTransactions> with debounce(300ms)
       → If query empty → clear searchedTransactions
       → Otherwise → filter by payeeName/payeeVPA (case-insensitive)
     WHY: BLoC + RxDart matches existing patterns, keeps
          filtering logic testable and out of the widget

     [code — 18 lines]

── 5. Done ─────────────────────────────────────────────
AI:  Design was reviewed before code — comprehension check
     skipped. You already own this code.
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

`grasp init` auto-detects your AI tools and configures everything — MCP servers, rules, hooks.

## How It Works

Grasp runs as an MCP server alongside your AI tool. It follows a natural workflow:

**Before code is written:**
1. **Intent capture** — AI records what you're building and checks your familiarity with the files
2. **Design conversation** — When familiarity is low, AI proposes an approach and asks 1-2 focused questions. Not an interrogation — a real conversation about the design
3. **Pseudocode plan** — After the design discussion, AI shows a recap of your decisions + a step-by-step plan. You can chat, ask questions, or suggest changes before any code is written
4. **Write protection** — AI is blocked from editing files until design review is complete (Claude Code hooks)

**While code is generated:**
5. **Design capture** — Every code block gets a structured WHAT/HOW/WHY explanation stored in a database
6. **Context on read** — When AI reads a file with stored decisions, they surface automatically

**After code is generated:**
7. **Smart checks** — If design review was completed, comprehension check is skipped — you already demonstrated understanding. If not, questions are asked
8. **Familiarity memory** — Grasp remembers what you know and adapts over time

**Anytime:**
9. **Decision lookup** — `grasp why <file>` shows why any AI-generated code was written the way it was
10. **Codebase heatmap** — `grasp map` shows a color-coded tree of all AI-generated files by familiarity

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
grasp score         # Show your comprehension score
grasp why <file>    # Show design decisions for any file
grasp map           # Show familiarity heatmap of AI-generated files
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
- Say **"grasp why \<file\>"** to see design decisions for any file

## The Flow

```
grasp_start_task          Is the developer familiar with these files?
        │
        ▼
   familiarity ≤ 50? ──── no ───▶ grasp_log_chunk (code with WHAT/HOW/WHY)
        │                                    │
       yes                                   ▼
        │                          grasp_check (ask questions)
        ▼
grasp_design_review       1-2 focused design questions
        │
        ▼
grasp_record_design       Developer answers → Design Recap + Pseudocode
        │
        ▼
   Open discussion        Developer can chat, ask questions, iterate
        │
        ▼
  "Let's go"              Developer confirms → implementation starts
        │
        ▼
grasp_log_chunk           Code with WHAT/HOW/WHY explanations
        │
        ▼
grasp_check               Skipped — design review covered comprehension
```

## Why Grasp Exists

AI coding tools made us faster. They also made us strangers in our own codebases.

**Comprehension debt** — code you don't understand well enough to know if it's bad — is the hidden cost of every AI-generated line you accept without understanding.

Unlike technical debt (which you know about), comprehension debt is invisible until someone asks you to explain your own code and you can't.

Grasp exists so that never happens.

## License

AGPL-3.0 — Free to use, modify, and self-host. If you offer Grasp as a service, your modifications must be open-sourced.

---

*Built by developers who refuse to be strangers in their own codebases.*
