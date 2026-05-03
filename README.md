# VibeLearn

Learning-first AI coding assistant for VS Code.

VibeLearn helps you code your own ideas. Instead of generating full solutions, it gives **hints**, **guiding questions**, and **teaching-focused feedback** so you stay in the driver's seat and actually learn.

## Status

Early but live. Sidebar chat now talks to **OpenAI**. Anthropic / Gemini / Ollama clients are scaffolded but not wired yet — switching to those providers will show a clear "not connected yet" message.

## Features

- Sidebar chat panel (graduation-cap icon in the Activity Bar) — sends to OpenAI and shows the reply.
- Teaching-rules system prompt driven by `vibelearn.helpLevel` (strict / guided / assist / full).
- Commands:
  - `VibeLearn: Open Chat` — focus the sidebar.
  - `VibeLearn: Set API Key` — store an API key per provider in VS Code SecretStorage.
  - `VibeLearn: Clear API Key` — remove a stored key.
  - `VibeLearn: Review Selected Code` — select code in the editor, then run from Command Palette or right-click menu. Review lands in the sidebar chat with: what it does, what's good, what to improve, one hint to try next.
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
| `vibelearn.provider` | `openai`, `anthropic`, `gemini`, `ollama` | `openai` | Which AI provider to call. |
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

## Project Layout

```
.
├── src/
│   ├── extension.ts         # activate, command registration
│   ├── chatViewProvider.ts  # sidebar webview UI + chat orchestration
│   ├── secrets.ts           # SecretStorage helpers
│   └── ai/
│       ├── types.ts                 # ChatMessage, LLMClient, LLMError
│       ├── promptBuilder.ts         # teaching system prompt per helpLevel
│       ├── promptBuilder.test.ts    # unit tests (node:test)
│       ├── openaiClient.ts          # OpenAI implementation
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
