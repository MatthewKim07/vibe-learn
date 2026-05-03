import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import {
  Provider,
  deleteApiKey,
  pickProvider,
  promptForApiKey,
  storeApiKey
} from './secrets';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.openChat', () => {
      vscode.commands.executeCommand('vibelearn.chatView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.setApiKey', () => setApiKey(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.clearApiKey', () => clearApiKey(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.reviewSelection', () =>
      reviewSelection(provider)
    )
  );
}

async function reviewSelection(provider: ChatViewProvider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(
      'VibeLearn: open a file and select some code to review.'
    );
    return;
  }

  const selection = editor.selection;
  const selected = editor.document.getText(selection);
  if (!selected.trim()) {
    vscode.window.showInformationMessage(
      'VibeLearn: no code selected. Highlight the code you want reviewed first.'
    );
    return;
  }

  const language = editor.document.languageId || 'text';
  const prompt = buildReviewPrompt(selected, language);
  const display = buildReviewDisplay(selected, language);
  await provider.submitExternal(prompt, display);
}

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  typescriptreact: 'TSX',
  javascript: 'JavaScript',
  javascriptreact: 'JSX',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  shellscript: 'Shell',
  sql: 'SQL'
};

function prettyLanguage(id: string): string {
  return LANGUAGE_LABELS[id] ?? id;
}

function buildReviewDisplay(code: string, language: string): string {
  const lines = code.split('\n').length;
  const label = prettyLanguage(language);
  return `Review ${lines} line${lines === 1 ? '' : 's'} of ${label}:\n\n\`\`\`${language}\n${code}\n\`\`\``;
}

function buildReviewPrompt(code: string, language: string): string {
  const label = prettyLanguage(language);
  return [
    `Please review this ${label} code in teaching mode.`,
    'Structure your reply with these four sections, in order:',
    '1. **What this code is doing** — short plain-language summary.',
    '2. **What is good** — name what works and why.',
    '3. **What could be improved** — focus on correctness and clarity, then style. Name concepts.',
    '4. **One hint to try next** — a single concrete next step the user can attempt themselves. Do not write the fix for them.',
    '',
    'Keep it concise. Respect my current help level.',
    '',
    `\`\`\`${language}`,
    code,
    '```'
  ].join('\n');
}

async function setApiKey(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration('vibelearn');
  const defaultProvider = cfg.get<Provider>('provider', 'openai');

  const chosen = await pickProvider(defaultProvider);
  if (!chosen) return;

  if (chosen === 'ollama') {
    vscode.window.showInformationMessage(
      'Ollama runs locally and does not need an API key.'
    );
    return;
  }

  const key = await promptForApiKey(chosen);
  if (!key) return;

  await storeApiKey(context.secrets, chosen, key.trim());
  vscode.window.showInformationMessage(`VibeLearn: ${chosen} API key saved.`);
}

async function clearApiKey(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration('vibelearn');
  const defaultProvider = cfg.get<Provider>('provider', 'openai');

  const chosen = await pickProvider(defaultProvider);
  if (!chosen) return;

  await deleteApiKey(context.secrets, chosen);
  vscode.window.showInformationMessage(`VibeLearn: ${chosen} API key cleared.`);
}

export function deactivate() {}
