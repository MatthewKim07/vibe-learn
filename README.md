# VibeLearn

Learning-first AI coding assistant for VS Code.

VibeLearn helps you code your own ideas. Instead of generating full solutions, it gives **hints**, **guiding questions**, and **teaching-focused feedback** so you stay in the driver's seat and actually learn.

## Status

Early but live. Sidebar chat now talks to **OpenAI** and **Ollama** (local). Anthropic / Gemini / OpenRouter clients are scaffolded but not wired yet — switching to those providers will show a clear "not implemented yet" message.

## Features

- Sidebar chat panel (graduation-cap icon in the Activity Bar) — sends to OpenAI and shows the reply.
- Teaching-rules system prompt driven by `vibelearn.helpLevel` (strict / guided / assist / full).
- Commands:
  - `VibeLearn: Open Chat` — focus the sidebar.
  - `VibeLearn: Set API Key` — store an API key per provider in VS Code SecretStorage.
  - `VibeLearn: Clear API Key` — remove a stored key.
  - `VibeLearn: Review Selected Code` — select code in the editor, then run from Command Palette or right-click menu. Review lands in the sidebar chat with: what it does, what's good, what to improve, one hint to try next.
  - `VibeLearn: Rewrite Prompt for Learning` — enter a normal coding prompt (e.g. "build me a React login page"). Local template-based rewrite turns it into a teaching-focused prompt. No AI call. Result opens in a new editor tab and is copied to your clipboard.
  - `VibeLearn: Pick Model` — provider-aware model picker. For Ollama, lists models actually installed on your machine. For cloud providers, shows curated options + "Custom…" entry. Writes to `vibelearn.model`.
- Settings: choose provider, model, and how much the assistant teaches vs. answers.

## Getting Started

Prerequisites: Node.js 18+, VS Code 1.85+.

```bash
npm install
npm run compile
npm test          # optional: run prompt builder unit tests
```

Then in VS Code:

1. Open this folder.
2. Press `F5` (or `Fn+F5` on Mac) to launch the Extension Development Host.
3. Click the **graduation-cap icon** in the left Activity Bar to open the VibeLearn sidebar.
4. Type a message → press Enter or click **Send**.

## Configuration

Open settings: `Cmd+,` (Mac) / `Ctrl+,` (Win/Linux), search **VibeLearn**.

| Setting | Values | Default | What it does |
|---|---|---|---|
| `vibelearn.provider` | `openai`, `anthropic`, `gemini`, `openrouter`, `ollama` | `openai` | Which AI provider to call. `openai` and `ollama` are fully wired; the others return a "not implemented yet" message. |
| `vibelearn.model` | any string | `gpt-4o-mini` | Model name for that provider (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`, `gemini-1.5-pro`, `llama3`). |
| `vibelearn.helpLevel` | `strict`, `guided`, `assist`, `full` | `guided` | How much the assistant teaches vs. answers directly. |

### Help levels

- **strict** — only questions and concept hints, never code.
- **guided** — hints and small steps, partial code only when asked.
- **assist** — hints first, but willing to show full code on request.
- **full** — behaves like a normal assistant, gives complete answers.

## API Key Setup

Keys are stored in **VS Code SecretStorage** (encrypted by the OS keychain). They are never written to settings.json, never logged, and never sent to telemetry.

1. `Cmd+Shift+P` → **VibeLearn: Set API Key**.
2. Pick the provider (openai / anthropic / gemini / ollama).
3. Paste your key. Input is masked.
4. Done — confirmation message appears.

To remove a key: `Cmd+Shift+P` → **VibeLearn: Clear API Key** → pick provider.

**Ollama** runs locally and does not require a key — choosing it just shows a notice.

You can store keys for multiple providers at once. Switching `vibelearn.provider` picks which one is used.

## Using the Chat (OpenAI)

1. Save your OpenAI key: `Cmd+Shift+P` → **VibeLearn: Set API Key** → pick `openai` → paste key.
2. Confirm settings: `Cmd+,` → search **vibelearn**.
   - `vibelearn.provider` = `openai`
   - `vibelearn.model` = e.g. `gpt-4o-mini` (any OpenAI chat model ID).
   - `vibelearn.helpLevel` = `guided` (or whichever).
3. Open the sidebar (graduation-cap icon).
4. Type a question → Enter. You should see a "thinking…" indicator, then the reply.

The chat keeps history within the sidebar session — each message is sent with prior turns so the model has context. Reload the dev host (`Cmd+R`) to clear history.

### Errors you might see

| Message | Meaning | Fix |
|---|---|---|
| `No OpenAI API key found...` | No key stored for the selected provider. | Run **VibeLearn: Set API Key**. |
| `OpenAI request failed (401): invalid or missing API key` | Key is wrong/expired. | Re-run Set API Key with a fresh key. |
| `OpenAI request failed (429): ...` | Rate limit / quota. | Wait or check your OpenAI billing. |
| `Provider "anthropic" is not connected yet.` | Selected a provider that isn't wired yet. | Switch `vibelearn.provider` back to `openai`. |

## Using the Chat (Ollama, local)

Ollama runs models on your own machine. **No API key. No network. Free.** Slower than cloud models on a laptop CPU, fine on Apple Silicon or a GPU.

### One-time setup

1. Install Ollama: download from [ollama.com](https://ollama.com) (macOS / Windows / Linux).
2. Start the local server (a dock-bar app on macOS, or run in a terminal):
   ```bash
   ollama serve
   ```
   Leave it running in the background. It listens on `http://localhost:11434`.
3. Pull a model. Pick one that fits your machine — start small:
   ```bash
   ollama pull llama3.2          # ~2 GB, decent quality
   ollama pull qwen2.5-coder:7b  # ~4 GB, code-focused
   ollama pull deepseek-coder    # ~3 GB, code-focused
   ```
   List installed models: `ollama list`.

### Configure VibeLearn

1. `Cmd+,` → search **vibelearn**.
   - `vibelearn.provider` = `ollama`
   - `vibelearn.model` = the exact tag you pulled, e.g. `llama3.2` or `qwen2.5-coder:7b`.
   - `vibelearn.helpLevel` = whatever you prefer.
2. No `Set API Key` step — Ollama needs no key.
3. Open the sidebar → ask a question. First reply may be slow while the model loads into RAM; subsequent replies are faster.

### Errors specific to Ollama

| Message | Meaning | Fix |
|---|---|---|
| `Could not reach Ollama at http://localhost:11434...` | Ollama server isn't running. | Run `ollama serve`, or start the Ollama desktop app. |
| `Ollama model "X" not found locally. Pull it first...` | Model tag in settings isn't pulled. | Run `ollama pull X` matching `vibelearn.model`. |
| `Ollama request failed (500): ...` | Model loaded but errored (e.g. context overflow). | Try a smaller prompt, or a different model. |

The teaching-rules system prompt (helpLevel) still applies — Ollama models receive the same prompt structure as cloud providers.

## Project Layout

```
.
├── src/
│   ├── extension.ts         # activate, command registration
│   ├── chatViewProvider.ts  # sidebar webview UI + chat orchestration
│   ├── secrets.ts           # SecretStorage helpers
│   ├── promptRewrite.ts             # local prompt-rewrite templates
│   ├── promptRewrite.test.ts        # unit tests
│   └── ai/
│       ├── types.ts                 # AIClient, AIRequest, AIError, Provider, ChatMessage
│       ├── promptBuilder.ts         # teaching system prompt per helpLevel
│       ├── promptBuilder.test.ts    # unit tests (node:test)
│       ├── notImplementedClient.ts  # base for placeholder providers
│       ├── openaiClient.ts          # OpenAI (implemented)
│       ├── anthropicClient.ts       # placeholder
│       ├── geminiClient.ts          # placeholder
│       ├── openrouterClient.ts     # placeholder
│       ├── ollamaClient.ts          # placeholder
│       ├── factory.test.ts          # factory unit tests
│       └── index.ts                 # provider factory
├── media/vibelearn.svg      # activity bar icon
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
