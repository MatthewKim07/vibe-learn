# VibeLearn

Learning-first AI coding assistant for VS Code.

VibeLearn helps you code your own ideas. Instead of generating full solutions, it gives **hints**, **guiding questions**, and **teaching-focused feedback** so you stay in the driver's seat and actually learn.

## Status

Early scaffold. No AI logic yet. First milestone: extension boots, command runs.

## Features

- Command: `VibeLearn: Open Chat` — placeholder, shows an info message for now.

## Getting Started

Prerequisites: Node.js 18+, VS Code 1.85+.

```bash
npm install
npm run compile
```

Then in VS Code:

1. Open this folder.
2. Press `F5` to launch the Extension Development Host.
3. In the new window, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
4. Run **VibeLearn: Open Chat**.
5. You should see: *"VibeLearn chat coming soon."*

## Project Layout

```
.
├── src/extension.ts       # extension entry point
├── docs/                  # design + teaching docs
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
