# VibeLearn

> Learning-first AI coding assistant for VS Code. Most AI tools write code *for* you. VibeLearn helps you write it *yourself*.

Instead of dumping full solutions, VibeLearn asks clarifying questions, hands you hints, names the underlying concept, and only reveals code when you're stuck. You stay in the driver's seat and actually learn while you build.

## Why

Autocomplete-style AI helpers are great for shipping. They are not great for *learning*. If a beginner asks "build me a React login page," a normal assistant emits 80 lines they didn't think about. VibeLearn replies: *"What pieces do you think a login page needs? Show me your starting JSX."* Then it walks alongside.

You pick how much help you want — from **strict** (questions only) to **full** (real answers, with the concept still called out).

## Features

- **Sidebar chat** with a mortarboard icon in the Activity Bar. Built-in welcome, suggested starter prompts, animated "thinking…" indicator, error bubbles, clear-chat button.
- **Sidebar action buttons** — Project, Learn, and Code action groups let you trigger key commands (Start Session, Dashboard, Reflect, Explain Back, Review Code, etc.) directly from the sidebar without opening the Command Palette.
- **Help-level selector** in the sidebar header — switch tutoring intensity any time.
- **Multiple providers** behind a clean interface: OpenAI ✓, Ollama ✓ (local, free), Anthropic / Gemini / OpenRouter (placeholders).
- **Fuzzy Ollama model resolution** — `Llama 3.2`, `llama 3.2`, `LLAMA3.2`, even `llma3.2` all resolve to `llama3.2:latest`.
- **Code review command** — select code, right-click → `VibeLearn: Review Selected Code`. Reply structured as: what it does / what's good / what could be improved / one hint to try next.
- **Prompt rewriter** — turn `"build me a todo app"` into a learning-focused prompt you can paste into any AI tool. Local templates, no API call.
- **Model picker** — dropdown of installed Ollama models, or curated suggestions for cloud providers.
- **Secure API keys** — stored in OS keychain via VS Code SecretStorage. Never in settings.json, never logged.

## Quick Start

Prerequisites: Node.js 18+, VS Code 1.85+.

```bash
npm install
npm run compile
npm test          # run unit tests
```

In VS Code:

1. Open this folder.
2. Press `F5` (or `Fn+F5` on Mac) → Extension Development Host opens.
3. Click the mortarboard icon in the left Activity Bar.
4. **Configure a provider** (see below) and start chatting.

### Choose a provider

- **OpenAI** — fastest path. Get a key from [platform.openai.com](https://platform.openai.com), add billing, then run `VibeLearn: Set API Key`.
- **Ollama** — free + local. Install from [ollama.com](https://ollama.com) (or `brew install ollama`), then `ollama serve` and `ollama pull llama3.2`. No key needed. See the [Ollama section](#using-the-chat-ollama-local) below.

## Commands

Open the Command Palette with `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Win/Linux) and search **VibeLearn**:

| Command | What it does |
|---|---|
| `VibeLearn: Open Chat` | Focus the sidebar chat. |
| `VibeLearn: Pick Model` | Provider-aware dropdown. Lists installed Ollama models or curated cloud options. |
| `VibeLearn: Set API Key` | Pick a provider, paste a key. Stored in OS keychain. |
| `VibeLearn: Clear API Key` | Remove a stored key for a provider. |
| `VibeLearn: Review Selected Code` | Select code in the editor, right-click or run from palette. Teaching-mode review in the sidebar. |
| `VibeLearn: Rewrite Prompt for Learning` | Type a normal prompt; get a teaching-focused rewrite + clipboard copy. No AI call. |
| `VibeLearn: Create Project Roadmap` | Enter a project idea; get a step-by-step learning roadmap with milestones and "Try first" prompts in the sidebar. |
| `VibeLearn: Start Learning Session` | Enter a project idea; generates a roadmap, extracts milestones, and starts a guided learning session. |
| `VibeLearn: Show Learning Session` | Open a Markdown document showing your active session, current milestone, and progress. |
| `VibeLearn: Complete Current Milestone` | Mark the current milestone done and advance to the next one. |
| `VibeLearn: Suggest Next Step` | Get a focused suggestion for your current milestone: why it matters, what to try, and one hint. |
| `VibeLearn: Reflection Check` | Generate 3 reflection questions based on selected code or your active learning session. |
| `VibeLearn: Toggle Socratic Mode` | Flip Socratic Mode on or off. Shows a notification confirming the new state. |
| `VibeLearn: Explain Back` | Enter a concept and your explanation; get encouraging feedback on what you understand and what to refine. |
| `VibeLearn: Show Workspace Context` | Open a Markdown document showing the workspace name, top-level folders, and files VibeLearn sees. |
| `VibeLearn: Open Learning Dashboard` | Open a Markdown document showing your active session, milestones, learning profile, and teaching mode settings. |
| `VibeLearn: Show Learning Profile` | Open a Markdown document showing your tracked concepts, strengths, and struggles. |
| `VibeLearn: Clear Learning Profile` | Wipe your local learning profile after confirmation. |

## Settings

`Cmd+,` → search **vibelearn**.

| Setting | Values | Default | Effect |
|---|---|---|---|
| `vibelearn.provider` | `openai`, `anthropic`, `gemini`, `openrouter`, `ollama` | `openai` | Which backend to call. `openai` and `ollama` are wired today; the rest return a "not implemented" message. |
| `vibelearn.model` | any string | `gpt-4o-mini` | Model id for the selected provider (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`, `llama3.2`). |
| `vibelearn.helpLevel` | `strict`, `guided`, `assist`, `full` | `guided` | How much VibeLearn teaches vs. answers directly. Also editable from the sidebar header. |
| `vibelearn.attemptFirst` | boolean | `true` | Ask the user to explain or try an approach before providing code-focused help. |
| `vibelearn.socraticMode` | boolean | `false` | Prefer teaching through guided questions rather than direct answers. Toggle with `VibeLearn: Toggle Socratic Mode`. |
| `vibelearn.includeWorkspaceContext` | boolean | `true` | Include lightweight workspace structure (top-level files and folders) in teaching prompts. |

### Help levels

- **strict** — only clarifying questions and concept hints. Refuses code.
- **guided** *(default)* — hints first, pseudocode if useful, full code only on explicit request.
- **assist** — quick concept hint, then partial code with explanation.
- **full** — full solutions, but still names the underlying concept.

## Provider Support

| Provider | Status | Notes |
|---|---|---|
| OpenAI | ✓ implemented | Chat Completions API. Any model id (`gpt-4o-mini`, `gpt-4o`, `o1-mini`, …). |
| Ollama | ✓ implemented | Local server at `http://localhost:11434`. No key. Fuzzy model name matching. |
| Anthropic | placeholder | Falls through to a clear "not implemented yet" message. |
| Gemini | placeholder | Same. |
| OpenRouter | placeholder | Same. |

Each client implements the same `AIClient` interface (`src/ai/types.ts`). Adding a provider = drop a new file in `src/ai/`, add a case to the factory in `src/ai/index.ts`. The teaching system prompt and chat history wiring stay shared.

## Using the Chat (OpenAI)

1. `Cmd+Shift+P` → **VibeLearn: Set API Key** → pick `openai` → paste key.
2. `Cmd+,` → confirm:
   - `vibelearn.provider` = `openai`
   - `vibelearn.model` = e.g. `gpt-4o-mini`
3. Open the sidebar (mortarboard icon). Ask a question.

### Errors you might see

| Message | Meaning | Fix |
|---|---|---|
| `No OpenAI API key found...` | No key stored. | Run **VibeLearn: Set API Key**. |
| `OpenAI request failed (401): invalid or missing API key` | Wrong/expired key. | Re-run Set API Key. |
| `OpenAI request failed (429): ...` | Rate limit / quota. | Wait, or check your OpenAI billing. |
| `Provider "anthropic" is not implemented yet.` | Provider stub. | Switch `vibelearn.provider` back to `openai` or `ollama`. |

## Using the Chat (Ollama, local)

Free, private, offline. Requires installing Ollama once.

### One-time setup

1. Install: download from [ollama.com](https://ollama.com), or `brew install ollama`.
2. Start the server (leave running):
   ```bash
   ollama serve
   ```
   Listens on `http://localhost:11434`.
3. Pull a model. Start small:
   ```bash
   ollama pull llama3.2          # ~2 GB, general
   ollama pull qwen2.5-coder:7b  # ~4 GB, code-focused
   ```
   List installed: `ollama list`.

### Configure

1. `Cmd+,` → search **vibelearn**:
   - `vibelearn.provider` = `ollama`
   - `vibelearn.model` = the tag from `ollama list` (e.g. `llama3.2`). Capitalization and spaces are forgiven.
2. No API key step. Open the sidebar and chat.

First reply may be slow while the model loads into RAM; subsequent replies are fast.

### Errors specific to Ollama

| Message | Fix |
|---|---|
| `Could not reach Ollama at http://localhost:11434...` | Run `ollama serve` (or open the Ollama app). |
| `Ollama model "X" not found locally. Did you mean: ...?` | Pick from the suggestions, or `ollama pull X`. |
| `Ollama request failed (500): ...` | Try a smaller prompt or a smaller model. |

## Learning Sessions

A Learning Session ties together a project roadmap, attempt-first guidance, and your learning profile into a single focused experience.

**Start a session:** `VibeLearn: Start Learning Session` → enter a project idea → VibeLearn generates a roadmap, extracts milestones, and saves the session locally.

While a session is active, every chat message includes your current milestone as context so the AI keeps guidance focused on what you're building right now.

**Track progress:** `VibeLearn: Show Learning Session` opens a Markdown document with a checklist of milestones and your current position.

**Advance:** `VibeLearn: Complete Current Milestone` marks the current milestone done and moves to the next. When the final milestone is completed, you get a congratulatory message.

One active session at a time. Sessions are stored in VS Code `globalState` — local only, never synced.

## Learning Profile

VibeLearn tracks what you encounter across chat sessions and uses it to personalise teaching.

After each AI reply, a local heuristic scans the response for:
- **Concepts** — e.g. `array`, `loop`, `async`, `recursion`, `authentication`. Added to *Concepts Seen*.
- **Strength signals** — phrases like "you understand", "good job", "that's correct". Logged as a strength.
- **Struggle signals** — phrases like "common mistake", "watch out", "tricky part". Logged as a struggle.

The profile is injected as optional context into the system prompt so the AI can avoid re-explaining things you already know and give extra care to areas where you've struggled.

**Privacy:** The profile is stored entirely in VS Code `globalState` on your local machine. It is never sent anywhere except as part of the prompt to your configured AI provider (OpenAI or Ollama). It is never logged or synced.

Use `VibeLearn: Show Learning Profile` to inspect it and `VibeLearn: Clear Learning Profile` to wipe it.

## Security

API keys live in **VS Code SecretStorage**, which delegates to the OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux).

- **Not** in `settings.json`.
- **Not** in any extension log or telemetry.
- **Not** echoed back in error messages — error paths read only the provider's `error.message` field.
- **Not** persisted in chat history sent to the model — only your messages and assistant replies are.
- Per-provider slots, so storing a Claude key doesn't overwrite your OpenAI one.

You can clear a key any time with `VibeLearn: Clear API Key`. Ollama uses no key at all.

## Project Layout

```
.
├── src/
│   ├── extension.ts             # activate, command registration
│   ├── chatViewProvider.ts      # sidebar webview UI + chat orchestration
│   ├── secrets.ts               # SecretStorage helpers
│   ├── modelPicker.ts           # provider-aware model picker
│   ├── promptRewrite.ts         # local prompt-rewrite templates
│   ├── promptRewrite.test.ts
│   ├── learningProfile.ts       # local learning profile (globalState)
│   ├── learningProfile.test.ts
│   ├── learningSession.ts       # learning session / project mode (globalState)
│   ├── learningSession.test.ts
│   ├── workspaceContext.ts      # workspace structure reader and formatter
│   ├── workspaceContext.test.ts
│   ├── dashboard.ts             # learning dashboard markdown builder
│   ├── dashboard.test.ts
│   └── ai/
│       ├── types.ts             # AIClient, AIRequest, AIError, Provider, ChatMessage
│       ├── promptBuilder.ts     # teaching system prompt per helpLevel
│       ├── promptBuilder.test.ts
│       ├── roadmapPrompt.ts     # roadmap message builder
│       ├── roadmapPrompt.test.ts
│       ├── attemptDetector.ts   # heuristic: has the user shown an attempt?
│       ├── attemptDetector.test.ts
│       ├── reflectionPrompt.ts  # reflection question builder
│       ├── reflectionPrompt.test.ts
│       ├── explainBackPrompt.ts # explain-back review builder
│       ├── explainBackPrompt.test.ts
│       ├── modelMatch.ts        # fuzzy Ollama model resolution
│       ├── modelMatch.test.ts
│       ├── notImplementedClient.ts
│       ├── openaiClient.ts      # OpenAI (implemented)
│       ├── ollamaClient.ts      # Ollama (implemented)
│       ├── anthropicClient.ts   # placeholder
│       ├── geminiClient.ts      # placeholder
│       ├── openrouterClient.ts  # placeholder
│       ├── factory.test.ts
│       └── index.ts             # provider factory
├── media/vibelearn.svg          # activity bar icon
├── docs/
│   ├── project-overview.md
│   └── teaching-rules.md
├── package.json
├── tsconfig.json
└── README.md
```

## Docs

- [Project Overview](docs/project-overview.md) — what VibeLearn is and why.
- [Teaching Rules](docs/teaching-rules.md) — how the assistant should behave.

## License

MIT — see [LICENSE](LICENSE).
