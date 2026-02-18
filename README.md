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
AI:  Before I write this — rate limit per user, per IP, or global?
You: "Per user, 429 response, Redis"

AI:  ━━━ Part 1: Token Bucket Core (14 lines) ━━━
     [code]
     Using sliding window over fixed window because fixed windows
     allow burst traffic at boundaries. The MULTI/EXEC block ensures
     atomicity.

     ━━━ Part 2: Express Middleware (10 lines) ━━━
     [code]
     The fallback to in-memory when Redis is down means each instance
     tracks separately — with 3 instances, effective limit becomes 3x.

     Quick check:
     → If Redis goes down with 4 app instances, what's the effective limit?
     → Should authenticated users get different limits?

You: "4x the configured limit. Yes — auth users need higher limits."
AI:  Exactly right. Adjusting for auth-aware limiting.
```

**Same tool. Same interface. You just actually own the code.**

## Install

```bash
npm install -g grasp-mcp
cd your-project
grasp init
```

That's it. `grasp init` auto-detects your AI tools and configures everything.

## How It Works

Grasp runs as an MCP server alongside your AI tool. It provides 6 tools that change how the AI behaves:

1. **Intent capture** — AI asks what you're building before generating
2. **Chunked generation** — Code arrives in focused blocks, not walls of text
3. **Design explanations** — AI explains *why*, not just *what*
4. **Comprehension checks** — Questions about the actual code, like a good colleague would ask
5. **Score tracking** — See what you understand and where your blind spots are
6. **Familiarity memory** — Grasp remembers what you know, adapts accordingly

## Supported Tools

| Tool | Support |
|------|---------|
| Claude Code | Full (MCP + Hooks + Rules) |
| Cursor | Full (MCP + Rules) |
| OpenAI Codex | Full (MCP + AGENTS.md) |
| GitHub Copilot | Full (MCP + Instructions) |
| Windsurf | Full (MCP + Rules) |
| Gemini CLI | Full (MCP + Rules) |
| Cline / Roo Code | MCP only |

## Commands

```bash
grasp init      # Auto-detect tools, configure everything
grasp score     # Show your comprehension score
grasp status    # Show which tools are configured
```

Inside any AI chat:
- Say **"grasp score"** to see your stats
- Say **"full speed"** to skip checks for the current task

## Why Grasp Exists

AI coding tools made us faster. They also made us strangers in our own codebases.

**Comprehension debt** — code you don't understand well enough to know if it's bad — is the hidden cost of every AI-generated line you accept without understanding.

Unlike technical debt (which you know about), comprehension debt is invisible until someone asks you to explain your own code and you can't.

Grasp exists so that never happens.

## License

AGPL-3.0 — Free to use, modify, and self-host. If you offer Grasp as a service, your modifications must be open-sourced.

---

*Built by developers who refuse to be strangers in their own codebases.*
