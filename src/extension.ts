import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { pickModel } from './modelPicker';
import { rewritePrompt } from './promptRewrite';
import {
  Provider,
  deleteApiKey,
  pickProvider,
  promptForApiKey,
  storeApiKey
} from './secrets';
import {
  clearLearningProfile,
  formatLearningProfileForPrompt,
  getLearningProfile
} from './learningProfile';
import {
  clearCurrentSession,
  createSession,
  extractMilestonesFromRoadmap,
  getCurrentSession,
  saveSession
} from './learningSession';
import { createClient } from './ai';
import { buildRoadmapMessages } from './ai/roadmapPrompt';
import { AIError, HelpLevel } from './ai/types';
import { getApiKey } from './secrets';

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

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.rewritePrompt', rewritePromptCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.pickModel', pickModel)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.createRoadmap', () =>
      createRoadmap(provider)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.showLearningProfile', () =>
      showLearningProfile(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.clearLearningProfile', () =>
      clearLearningProfileCommand(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.startLearningSession', () =>
      startLearningSession(context, provider)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.showLearningSession', () =>
      showLearningSession(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.completeCurrentMilestone', () =>
      completeCurrentMilestone(context)
    )
  );
}

async function rewritePromptCommand() {
  const input = await vscode.window.showInputBox({
    prompt: 'Enter the prompt you would normally send to an AI',
    placeHolder: 'e.g. Build me a React login page',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'Prompt cannot be empty.' : null)
  });
  if (!input) return;

  const rewritten = rewritePrompt(input);

  const body = [
    '# VibeLearn — Rewritten Prompt',
    '',
    '## Original',
    '',
    input,
    '',
    '## Learning-focused rewrite',
    '',
    rewritten,
    '',
    '---',
    '',
    'Copy the rewritten prompt and paste it into your AI tool of choice.'
  ].join('\n');

  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: body
  });
  await vscode.window.showTextDocument(doc, { preview: false });

  try {
    await vscode.env.clipboard.writeText(rewritten);
    vscode.window.showInformationMessage('VibeLearn: rewritten prompt copied to clipboard.');
  } catch {
    vscode.window.showInformationMessage('VibeLearn: rewritten prompt ready in the new editor tab.');
  }
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

async function createRoadmap(provider: ChatViewProvider) {
  const idea = await vscode.window.showInputBox({
    prompt: 'What project do you want to build?',
    placeHolder: 'e.g. A weather app, a CLI todo list, a personal blog',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'Please enter a project idea.' : null)
  });

  if (!idea) {
    vscode.window.showInformationMessage(
      'VibeLearn: No idea entered. Run "VibeLearn: Create Project Roadmap" when you\'re ready.'
    );
    return;
  }

  await provider.submitRoadmap(idea.trim());
}

async function showLearningProfile(context: vscode.ExtensionContext) {
  const profile = getLearningProfile(context);
  const formatted = formatLearningProfileForPrompt(profile);

  const lines: string[] = ['# VibeLearn — Learning Profile', ''];

  if (!formatted) {
    lines.push('_No learning data yet. Start chatting to build your profile._');
  } else {
    if (profile.conceptsSeen.length > 0) {
      lines.push('## Concepts Seen', '', profile.conceptsSeen.map((c) => `- ${c}`).join('\n'), '');
    }
    if (profile.strengths.length > 0) {
      lines.push('## Strengths', '', profile.strengths.map((s) => `- ${s}`).join('\n'), '');
    }
    if (profile.struggles.length > 0) {
      lines.push('## Struggles', '', profile.struggles.map((s) => `- ${s}`).join('\n'), '');
    }
    if (profile.lastUpdated) {
      lines.push(`---`, `_Last updated: ${new Date(profile.lastUpdated).toLocaleString()}_`);
    }
  }

  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: lines.join('\n')
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function clearLearningProfileCommand(context: vscode.ExtensionContext) {
  const answer = await vscode.window.showWarningMessage(
    'Clear your VibeLearn learning profile? This cannot be undone.',
    { modal: true },
    'Clear'
  );
  if (answer !== 'Clear') return;
  await clearLearningProfile(context);
  vscode.window.showInformationMessage('VibeLearn: Learning profile cleared.');
}

async function startLearningSession(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider
) {
  const idea = await vscode.window.showInputBox({
    prompt: 'What project do you want to learn by building?',
    placeHolder: 'e.g. A weather app, a CLI todo list, a personal blog',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'Please enter a project idea.' : null)
  });
  if (!idea) return;

  const cfg = vscode.workspace.getConfiguration('vibelearn');
  const providerName = cfg.get<Provider>('provider', 'openai');
  const model = cfg.get<string>('model', 'gpt-4o-mini');
  const helpLevel = cfg.get<HelpLevel>('helpLevel', 'guided');

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'VibeLearn: Generating roadmap…', cancellable: false },
    async () => {
      try {
        const apiKey = await getApiKey(context.secrets, providerName);
        const client = createClient({ provider: providerName, apiKey });
        const messages = buildRoadmapMessages(idea.trim(), helpLevel);
        const roadmap = await client.complete({ model, messages });

        const milestones = extractMilestonesFromRoadmap(roadmap);
        if (milestones.length === 0) {
          vscode.window.showWarningMessage(
            'VibeLearn: Could not extract milestones from the roadmap. Try again or rephrase your idea.'
          );
          return;
        }

        // Extract goal from roadmap (first paragraph after "## Goal")
        const goalMatch = roadmap.match(/##\s+Goal\s*\n+([\s\S]+?)(?=\n##|\n###|$)/);
        const goal = goalMatch ? goalMatch[1].trim() : idea.trim();

        const session = createSession(idea.trim(), goal, milestones);
        await saveSession(context, session);

        // Show roadmap in sidebar and confirm session started
        await chatProvider.submitRoadmap(idea.trim());
        vscode.window.showInformationMessage(
          `VibeLearn: Session started! ${milestones.length} milestones. First: "${milestones[0]}"`
        );
      } catch (err) {
        const msg = err instanceof AIError ? err.message : err instanceof Error ? err.message : 'Unknown error.';
        vscode.window.showErrorMessage(`VibeLearn: Failed to start session — ${msg}`);
      }
    }
  );
}

async function showLearningSession(context: vscode.ExtensionContext) {
  const session = getCurrentSession(context);

  const lines = ['# VibeLearn — Learning Session', ''];

  if (!session) {
    lines.push('_No active session. Run **VibeLearn: Start Learning Session** to begin._');
  } else {
    const active = session.milestones[session.activeMilestoneIndex];
    const total = session.milestones.length;
    const done = session.milestones.filter((m) => m.completed).length;

    lines.push(
      `**Project:** ${session.projectName}`,
      `**Current Milestone:** ${active ? active.title : '🎉 All done!'}`,
      `**Progress:** ${done}/${total}`,
      '',
      '## Milestones',
      ''
    );

    for (const m of session.milestones) {
      lines.push(`${m.completed ? '☑' : '☐'} ${m.title}`);
    }

    lines.push('', '---', `_Started: ${new Date(session.createdAt).toLocaleString()}_`);
  }

  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: lines.join('\n')
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function completeCurrentMilestone(context: vscode.ExtensionContext) {
  const session = getCurrentSession(context);
  if (!session) {
    vscode.window.showInformationMessage('VibeLearn: No active session. Start one first.');
    return;
  }

  const { milestones, activeMilestoneIndex } = session;
  if (activeMilestoneIndex >= milestones.length) {
    vscode.window.showInformationMessage('VibeLearn: All milestones are already completed! 🎉');
    return;
  }

  milestones[activeMilestoneIndex].completed = true;
  const nextIndex = activeMilestoneIndex + 1;
  session.activeMilestoneIndex = nextIndex;
  session.updatedAt = new Date().toISOString();
  await saveSession(context, session);

  if (nextIndex >= milestones.length) {
    vscode.window.showInformationMessage(
      `🎉 Congratulations! You completed all milestones for "${session.projectName}"!`
    );
  } else {
    const next = milestones[nextIndex];
    vscode.window.showInformationMessage(
      `VibeLearn: Milestone complete! Next up: "${next.title}"`
    );
  }
}

export function deactivate() {}
