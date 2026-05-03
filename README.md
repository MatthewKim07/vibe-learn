# VibeLearn

Learning-first AI coding assistant for VS Code.

VibeLearn helps you code your own ideas. Instead of generating full solutions, it gives **hints**, **guiding questions**, and **teaching-focused feedback** so you stay in the driver's seat and actually learn.

## Status

Early scaffold. Sidebar chat UI works with a placeholder reply. Settings + secure API key storage in place. **No live AI calls yet** — the LLM backend lands in the next milestone.

## Features

- Sidebar chat panel (graduation-cap icon in the Activity Bar).
- Commands:
  - `VibeLearn: Open Chat` — focus the sidebar.
  - `VibeLearn: Set API Key` — store an API key per provider in VS Code SecretStorage.
  - `VibeLearn: Clear API Key` — remove a stored key.
- Settings: choose provider, model, and how much the assistant teaches vs. answers.

## Getting Started

Prerequisites: Node.js 18+, VS Code 1.85+.

```bash
npm install
npm run compile
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

## Project Layout

```
.
├── src/
│   ├── extension.ts         # activate, command registration
│   ├── chatViewProvider.ts  # sidebar webview UI
│   └── secrets.ts           # SecretStorage helpers
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
