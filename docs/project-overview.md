# Project Overview

## What is VibeLearn?

VibeLearn is a **learning-first AI coding assistant** delivered as a VS Code extension. Most AI coding tools optimize for output: write the code for me, finish the task, ship the PR. VibeLearn optimizes for **understanding**: help me learn while I build my own ideas.

## Who is it for?

- Beginners learning to program who don't want an autocomplete to do their thinking.
- Self-taught developers leveling up on a new language or framework.
- Students who need to actually understand the assignment, not just submit it.
- Anyone who wants AI as a tutor, not a ghostwriter.

## Core Idea

When the user asks for help, the assistant defaults to:

1. **Ask a clarifying question** if the goal is fuzzy.
2. **Hint at the next step** instead of writing the whole solution.
3. **Point out the concept** behind the problem (e.g., "this is a closure issue").
4. **Reveal more only on request** — escalation: hint → guided steps → partial code → full code.

The user can always ask for the full answer. The default is the teaching path.

## Non-Goals

- Replacing the user's thinking.
- Generating large blocks of code unprompted.
- Competing with Copilot on raw autocompletion speed.

## Roadmap

- **v0.0.1 (now):** Scaffold. `VibeLearn: Open Chat` command exists and shows a placeholder message.
- **v0.1:** Chat panel UI (webview) inside VS Code.
- **v0.2:** Wire up an LLM backend behind a teaching-rules system prompt.
- **v0.3:** Inline hints for the active editor selection.
- **v0.4:** Progress tracking — what concepts the user has practiced.

## Architecture (planned)

```
VS Code Extension (TypeScript)
  ├── Command: vibelearn.openChat
  ├── Webview: chat panel
  └── LLM client (later)  ──►  Teaching-rules system prompt  ──►  Provider API
```

No AI calls happen yet. The first version only proves the extension activates and the command runs.
