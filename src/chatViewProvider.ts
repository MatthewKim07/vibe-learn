import * as vscode from 'vscode';
import { createClient } from './ai';
import { buildMessages } from './ai/promptBuilder';
import { buildRoadmapMessages } from './ai/roadmapPrompt';
import { hasAttempt } from './ai/attemptDetector';
import { AIError, ChatMessage, HelpLevel, Provider } from './ai/types';
import { getApiKey, storeApiKey } from './secrets';
import {
  extractProfileUpdate,
  formatLearningProfileForPrompt,
  getLearningProfile,
  updateLearningProfile
} from './learningProfile';
import { formatSessionForPrompt, getCurrentSession } from './learningSession';
import { formatWorkspaceContextForPrompt, getWorkspaceContext } from './workspaceContext';
import { getOnboardingState, isConfigured } from './onboarding';

const HELP_LEVELS: HelpLevel[] = ['strict', 'guided', 'assist', 'full'];

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibelearn.chatView';

  private history: ChatMessage[] = [];
  private webviewView?: vscode.WebviewView;
  private pendingExternal?: { payload: string; displayText: string };
  private configWatcher?: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
      if (msg?.type === 'userMessage' && typeof msg.text === 'string') {
        await this.handleUserMessage(msg.text);
      } else if (msg?.type === 'webviewReady') {
        await this.postSettings();
        if (this.pendingExternal) {
          const pending = this.pendingExternal;
          this.pendingExternal = undefined;
          await this.submitExternal(pending.payload, pending.displayText);
        }
        // First-run welcome: only show when configured AND not yet completed
        const hasCompleted = this.context.globalState.get<boolean>('vibelearn.hasCompletedFirstRun', false);
        if (!hasCompleted) {
          const cfg = vscode.workspace.getConfiguration('vibelearn');
          const provider = cfg.get<Provider>('provider', 'openai');
          const state = await getOnboardingState(this.context.secrets, provider);
          if (isConfigured(state)) {
            this.postFirstRunWelcome();
          }
        }
      } else if (msg?.type === 'dismissFirstRun') {
        await this.context.globalState.update('vibelearn.hasCompletedFirstRun', true);
      } else if (msg?.type === 'startSession' && typeof msg.idea === 'string') {
        await this.context.globalState.update('vibelearn.hasCompletedFirstRun', true);
        await vscode.commands.executeCommand('vibelearn.startLearningSession', msg.idea);
      } else if (msg?.type === 'setHelpLevel' && typeof msg.value === 'string') {
        await this.applyHelpLevel(msg.value);
      } else if (msg?.type === 'openSettings') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:vibelearn.vibelearn'
        );
      } else if (msg?.type === 'pickModel') {
        await vscode.commands.executeCommand('vibelearn.pickModel');
      } else if (msg?.type === 'pickProvider') {
        await vscode.commands.executeCommand('vibelearn.pickProvider');
      } else if (msg?.type === 'setApiKey') {
        await vscode.commands.executeCommand('vibelearn.setApiKey');
      } else if (msg?.type === 'saveApiKey' && typeof msg.key === 'string' && typeof msg.provider === 'string') {
        await storeApiKey(this.context.secrets, msg.provider as import('./ai/types').Provider, msg.key);
        vscode.window.showInformationMessage(`VibeLearn: ${msg.provider} API key saved.`);
        await this.refreshSettings();
      } else if (msg?.type === 'command' && typeof msg.command === 'string') {
        await vscode.commands.executeCommand(msg.command);
      } else if (msg?.type === 'toggleSetting' && typeof msg.key === 'string') {
        const cfg = vscode.workspace.getConfiguration('vibelearn');
        const current = cfg.get<boolean>(msg.key, false);
        await cfg.update(msg.key, !current, vscode.ConfigurationTarget.Global);
      } else if (msg?.type === 'setProvider' && typeof msg.provider === 'string') {
        const cfg = vscode.workspace.getConfiguration('vibelearn');
        await cfg.update('provider', msg.provider, vscode.ConfigurationTarget.Global);
        const defaultModels: Record<string, string> = {
          openai: 'gpt-4o-mini', ollama: 'llama3.2', anthropic: 'claude-haiku-4-5',
          gemini: 'gemini-1.5-flash', openrouter: 'openrouter/auto'
        };
        await cfg.update('model', defaultModels[msg.provider] ?? '', vscode.ConfigurationTarget.Global);
        await this.context.globalState.update('vibelearn.hasCompletedFirstRun', true);
        await this.refreshSettings();
      } else if (msg?.type === 'setModel' && typeof msg.model === 'string') {
        const cfg = vscode.workspace.getConfiguration('vibelearn');
        await cfg.update('model', msg.model, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`VibeLearn: model set to "${msg.model}".`);
      }
      } catch (err) {
        console.error('[VibeLearn] onDidReceiveMessage error:', err);
      }
    });


    this.configWatcher?.dispose();
    this.configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vibelearn')) {
        this.postSettings();
      }
    });
    webviewView.onDidDispose(() => this.configWatcher?.dispose());
  }

  public async submitExternal(payload: string, displayText?: string) {
    const shown = displayText ?? payload;
    await vscode.commands.executeCommand('vibelearn.chatView.focus');
    if (!this.webviewView) {
      this.pendingExternal = { payload, displayText: shown };
      return;
    }
    this.webviewView.webview.postMessage({ type: 'userBubble', text: shown });
    await this.handleUserMessage(payload);
  }

  public async submitRoadmap(idea: string) {
    await vscode.commands.executeCommand('vibelearn.chatView.focus');
    if (!this.webviewView) {
      this.pendingExternal = {
        payload: idea,
        displayText: `Create a project roadmap for: ${idea}`
      };
      return;
    }

    const cfg = vscode.workspace.getConfiguration('vibelearn');
    const provider = cfg.get<Provider>('provider', 'openai');
    const model = cfg.get<string>('model', 'gpt-4o-mini');
    const helpLevel = cfg.get<HelpLevel>('helpLevel', 'guided');

    this.webviewView.webview.postMessage({
      type: 'userBubble',
      text: `Create a project roadmap for: ${idea}`
    });
    this.postBusy(true);

    try {
      const apiKey = await getApiKey(this.context.secrets, provider);
      const client = createClient({ provider, apiKey });
      const messages = buildRoadmapMessages(idea, helpLevel);
      const reply = await client.complete({ model, messages });
      this.history.push(
        { role: 'user', content: `Create a project roadmap for: ${idea}` },
        { role: 'assistant', content: reply }
      );
      this.postAssistant(reply);
    } catch (err) {
      const message = err instanceof AIError
        ? err.message
        : err instanceof Error ? err.message : 'Unknown error.';
      this.postError(message);
    } finally {
      this.postBusy(false);
    }
  }

  public async submitFocused(
    messages: ChatMessage[],
    displayText: string,
    opts: { model: string; providerName: Provider }
  ) {
    await vscode.commands.executeCommand('vibelearn.chatView.focus');
    if (!this.webviewView) {
      // Fall back: queue as a normal external message
      this.pendingExternal = { payload: messages[messages.length - 1].content, displayText };
      return;
    }

    this.webviewView.webview.postMessage({ type: 'userBubble', text: displayText });
    this.postBusy(true);

    try {
      const apiKey = await getApiKey(this.context.secrets, opts.providerName);
      const client = createClient({ provider: opts.providerName, apiKey });
      const reply = await client.complete({ model: opts.model, messages });
      this.history.push(
        { role: 'user', content: messages[messages.length - 1].content },
        { role: 'assistant', content: reply }
      );
      this.postAssistant(reply);
    } catch (err) {
      const message = err instanceof AIError
        ? err.message
        : err instanceof Error ? err.message : 'Unknown error.';
      this.postError(message);
    } finally {
      this.postBusy(false);
    }
  }

  private async applyHelpLevel(value: string) {
    if (!HELP_LEVELS.includes(value as HelpLevel)) return;
    await vscode.workspace
      .getConfiguration('vibelearn')
      .update('helpLevel', value, vscode.ConfigurationTarget.Global);
  }

  public toggleSettings() {
    this.webviewView?.webview.postMessage({ type: 'toggleSettings' });
  }

  public async refreshSettings() {
    await this.postSettings();
    // If the user just completed onboarding and hasn't seen the welcome yet, show it now
    const hasCompleted = this.context.globalState.get<boolean>('vibelearn.hasCompletedFirstRun', false);
    if (!hasCompleted) {
      const cfg = vscode.workspace.getConfiguration('vibelearn');
      const provider = cfg.get<Provider>('provider', 'openai');
      const state = await getOnboardingState(this.context.secrets, provider);
      if (isConfigured(state)) {
        this.postFirstRunWelcome();
      }
    }
  }

  private async postSettings() {
    if (!this.webviewView) return;
    const cfg = vscode.workspace.getConfiguration('vibelearn');
    const provider = cfg.get<Provider>('provider', 'openai');
    const state = await getOnboardingState(this.context.secrets, provider);
    const session = getCurrentSession(this.context);
    const done = session ? session.milestones.filter((m) => m.completed).length : 0;
    this.webviewView.webview.postMessage({
      type: 'settings',
      provider,
      model: cfg.get<string>('model', ''),
      helpLevel: cfg.get<HelpLevel>('helpLevel', 'guided'),
      socraticMode: cfg.get<boolean>('socraticMode', false),
      attemptFirst: cfg.get<boolean>('attemptFirst', true),
      includeWorkspaceContext: cfg.get<boolean>('includeWorkspaceContext', true),
      configured: isConfigured(state),
      sessionName: session?.projectName ?? null,
      sessionProgress: session ? `${done} / ${session.milestones.length}` : null
    });
  }

  private async handleUserMessage(text: string) {
    const cfg = vscode.workspace.getConfiguration('vibelearn');
    const provider = cfg.get<Provider>('provider', 'openai');
    const model = cfg.get<string>('model', 'gpt-4o-mini');
    const helpLevel = cfg.get<HelpLevel>('helpLevel', 'guided');
    const attemptFirst = cfg.get<boolean>('attemptFirst', true);
    const socraticMode = cfg.get<boolean>('socraticMode', false);

    // Onboarding gate: friendly message before raw provider errors
    const onboardingState = await getOnboardingState(this.context.secrets, provider);
    if (!isConfigured(onboardingState)) {
      this.postAssistant(
        'Before chatting, choose a model and configure access.\n\nRun **VibeLearn: Pick Model** to choose a provider, then **VibeLearn: Set API Key** to add your key.\n\nIf you\'re using Ollama, set `vibelearn.provider` to `ollama` in settings — no key needed.'
      );
      return;
    }

    const profile = getLearningProfile(this.context);
    const profileContext = formatLearningProfileForPrompt(profile);

    const session = getCurrentSession(this.context);
    const sessionContext = session ? formatSessionForPrompt(session) : '';

    const includeWorkspace = cfg.get<boolean>('includeWorkspaceContext', true);
    const wsCtx = includeWorkspace ? await getWorkspaceContext() : null;
    const workspaceContext = wsCtx ? formatWorkspaceContextForPrompt(wsCtx) : '';

    this.history.push({ role: 'user', content: text });
    this.postBusy(true);

    try {
      const apiKey = await getApiKey(this.context.secrets, provider);
      const client = createClient({ provider, apiKey });

      const messages = buildMessages({
        level: helpLevel,
        history: this.history,
        attemptFirst,
        userHasAttempt: hasAttempt(text),
        profileContext,
        sessionContext,
        socraticMode,
        workspaceContext
      });

      const reply = await client.complete({ model, messages });
      this.history.push({ role: 'assistant', content: reply });
      this.postAssistant(reply);

      // Update profile from the AI reply (fire-and-forget, non-blocking)
      const profileUpdate = extractProfileUpdate(reply);
      if (
        profileUpdate.conceptsSeen?.length ||
        profileUpdate.strengths?.length ||
        profileUpdate.struggles?.length
      ) {
        updateLearningProfile(this.context, profileUpdate).catch(() => {/* ignore */});
      }
    } catch (err) {
      const message = err instanceof AIError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error.';
      this.postError(message);
      this.history.pop();
    } finally {
      this.postBusy(false);
    }
  }

  private postAssistant(text: string) {
    this.webviewView?.webview.postMessage({ type: 'assistantMessage', text });
  }

  private postFirstRunWelcome() {
    this.webviewView?.webview.postMessage({ type: 'firstRunWelcome' });
  }

  private postError(text: string) {
    this.webviewView?.webview.postMessage({ type: 'errorMessage', text });
  }

  private postBusy(busy: boolean) {
    this.webviewView?.webview.postMessage({ type: 'busy', busy });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>VibeLearn</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, #1e1e1e);
      display: flex; flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    #btn-gear {
      background: none; border: none; cursor: pointer; padding: 2px 5px;
      color: var(--vscode-foreground); font-size: 14px; opacity: 0.6; border-radius: 3px;
    }
    #btn-gear:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
    #bottom-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 10px 6px;
      border-top: 1px solid var(--vscode-panel-border);
      font-size: 11px; color: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    #bottom-bar select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, transparent);
      border-radius: 3px; padding: 2px 4px;
      font-size: 11px; font-family: inherit;
    }
    #meta-session { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #actions {
      padding: 6px 10px;
      border-bottom: 1px solid rgba(200, 182, 226, 0.08);
      display: flex; flex-direction: column; gap: 4px;
    }
    .action-group { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .action-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.4px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      min-width: 72px;
    }
    .action-btn {
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px; font-family: inherit; cursor: pointer;
    }
    .action-btn:hover { background: var(--vscode-list-hoverBackground); }
    #settings-panel {
      display: none; flex-direction: column; gap: 0;
      flex: 1; overflow-y: auto; padding: 0;
    }
    .sp-section { padding: 14px 14px 10px; border-bottom: 1px solid rgba(200,182,226,0.08); }
    .sp-section h3 { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
    .sp-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .sp-row:last-child { margin-bottom: 0; }
    .sp-label { font-size: 12px; font-weight: 600; }
    .sp-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .sp-select, .sp-input {
      width: 100%; padding: 6px 8px; margin-top: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px; font-family: inherit; font-size: 12px;
      box-sizing: border-box;
    }
    .sp-select:focus, .sp-input:focus { outline: none; border-color: var(--vscode-focusBorder); }
    .sp-btn {
      padding: 5px 12px; margin-top: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; cursor: pointer;
      font-size: 12px; font-family: inherit; font-weight: 500;
    }
    .sp-btn:hover { background: var(--vscode-button-hoverBackground); }
    .sp-toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
    .sp-toggle-row span { font-size: 12px; }
    .sp-toggle {
      width: 36px; height: 20px; border-radius: 10px; border: none; cursor: pointer;
      background: var(--vscode-panel-border); position: relative; transition: background 0.15s;
    }
    .sp-toggle.on { background: var(--vscode-button-background); }
    .sp-toggle::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 14px; height: 14px; border-radius: 50%;
      background: white; transition: left 0.15s;
    }
    .sp-toggle.on::after { left: 19px; }
    #btn-gear {
      background: none; border: none; cursor: pointer; padding: 2px 4px;
      color: var(--vscode-foreground); font-size: 15px; opacity: 0.7;
    }
    #btn-gear:hover { opacity: 1; }
    #inline-picker {
      display: none; flex-direction: column; gap: 3px;
      padding: 6px 10px;
      border-bottom: 1px solid rgba(200,182,226,0.08);
      background: rgba(200,182,226,0.03);
    }
    #inline-picker .picker-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.4px;
      color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 2px;
    }
    .picker-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .picker-opt {
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px; padding: 3px 9px;
      font-size: 11px; font-family: inherit; cursor: pointer;
    }
    .picker-opt:hover { background: var(--vscode-list-hoverBackground); }
    .picker-opt.active { border-color: var(--vscode-focusBorder); color: var(--vscode-focusBorder); }
    .starter-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .starter-chip {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 12px;
      padding: 4px 10px; font-size: 12px; font-family: inherit; cursor: pointer;
    }
    .starter-chip:hover { background: var(--vscode-button-hoverBackground); }
    .dismiss-link {
      display: block; margin-top: 8px; font-size: 11px;
      color: var(--vscode-descriptionForeground); cursor: pointer; background: none; border: none;
      text-align: left; padding: 0; font-family: inherit;
    }
    .dismiss-link:hover { text-decoration: underline; }
    #onboarding {
      margin: 8px 10px;
      padding: 10px 12px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-focusBorder, rgba(200,182,226,0.3));
      border-radius: 6px;
      display: none;
    }
    #onboarding h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
    #onboarding p { margin: 0 0 8px; font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.4; }
    #onboarding ol { margin: 0 0 10px; padding-left: 18px; font-size: 12px; color: var(--vscode-descriptionForeground); }
    #onboarding ol li { margin-bottom: 2px; }
    .onboarding-btns { display: flex; gap: 6px; }
    .onboarding-btns button {
      flex: 1;
      padding: 5px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; cursor: pointer;
      font-size: 12px; font-family: inherit; font-weight: 500;
    }
    .onboarding-btns button:hover { background: var(--vscode-button-hoverBackground); }
    #messages {
      flex: 1; overflow-y: auto;
      padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .msg {
      padding: 8px 11px; border-radius: 8px;
      max-width: 92%; line-height: 1.45;
      white-space: pre-wrap; word-wrap: break-word;
      font-size: 13px;
    }
    .msg.user {
      align-self: flex-end;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 2px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-bottom-left-radius: 2px;
    }
    .msg.error {
      align-self: stretch;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-foreground));
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      font-size: 12px;
    }
    .welcome {
      color: var(--vscode-foreground);
      padding: 16px 6px 6px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .welcome h2 {
      margin: 0; font-size: 15px; font-weight: 600;
    }
    .welcome p {
      margin: 0; font-size: 12.5px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .welcome .pill-row {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-top: 4px;
    }
    .welcome .pill {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      padding: 5px 9px; border-radius: 14px;
      font-size: 12px; cursor: pointer;
    }
    .welcome .pill:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .typing {
      align-self: flex-start;
      color: var(--vscode-descriptionForeground);
      padding: 6px 11px; font-size: 12px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .typing .dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: currentColor; opacity: 0.4;
      animation: tdot 1.2s infinite ease-in-out;
    }
    .typing .dot:nth-child(2) { animation-delay: 0.15s; }
    .typing .dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes tdot {
      0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-2px); }
    }
    form {
      display: flex; gap: 6px; padding: 10px;
      border-top: 1px solid rgba(200, 182, 226, 0.10);
      background: rgba(200, 182, 226, 0.02);
    }
    #input {
      flex: 1; padding: 7px 9px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 5px;
      font-family: inherit; font-size: 13px;
      outline: none;
    }
    #input:focus { border-color: var(--vscode-focusBorder); }
    #send {
      padding: 7px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 5px; cursor: pointer;
      font-family: inherit; font-size: 13px; font-weight: 500;
    }
    #send:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    #send:disabled, #input:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <!-- Settings Panel (replaces chat content when gear is open) -->
  <div id="settings-panel">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0">
      <strong style="font-size:13px">Settings</strong>
      <button id="btn-close-settings" type="button" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--vscode-foreground);opacity:0.7;padding:2px 6px">✕</button>
    </div>
    <div class="sp-section">
      <h3>Provider &amp; Model</h3>
      <div class="sp-row">
        <span class="sp-label">Provider</span>
        <select class="sp-select" id="sp-provider">
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (local, free)</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>
      <div class="sp-row">
        <span class="sp-label">API Key</span>
        <span class="sp-desc" id="sp-key-desc">Not needed for Ollama.</span>
        <input class="sp-input" id="sp-key-input" type="password" placeholder="Paste API key…" autocomplete="off" />
        <button class="sp-btn" id="sp-save-key" type="button">Save Key</button>
      </div>
      <div class="sp-row">
        <span class="sp-label">Model</span>
        <select class="sp-select" id="sp-model"></select>
        <input class="sp-input" id="sp-model-custom" placeholder="or type a custom model id…" style="margin-top:4px" />
        <button class="sp-btn" id="sp-save-model" type="button">Save Model</button>
      </div>
    </div>
    <div class="sp-section">
      <h3>Teaching Mode</h3>
      <div class="sp-toggle-row">
        <span>Socratic Mode <span class="sp-desc" style="display:block;font-size:10px">Teach through questions</span></span>
        <button class="sp-toggle" id="sp-socratic" data-toggle="socraticMode" type="button"></button>
      </div>
      <div class="sp-toggle-row">
        <span>Attempt First <span class="sp-desc" style="display:block;font-size:10px">Ask user to try before answering</span></span>
        <button class="sp-toggle" id="sp-attempt" data-toggle="attemptFirst" type="button"></button>
      </div>
      <div class="sp-toggle-row">
        <span>Workspace Context <span class="sp-desc" style="display:block;font-size:10px">Include project files in prompts</span></span>
        <button class="sp-toggle" id="sp-workspace" data-toggle="includeWorkspaceContext" type="button"></button>
      </div>
    </div>
    <div class="sp-section">
      <h3>Data</h3>
      <div class="sp-row">
        <button class="sp-btn" type="button" data-cmd="vibelearn.showLearningProfile">View Learning Profile</button>
        <button class="sp-btn" type="button" data-cmd="vibelearn.clearLearningProfile" style="margin-top:4px;background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-foreground)">Clear Learning Profile</button>
      </div>
    </div>
  </div>
  <div id="onboarding" role="region" aria-label="Setup required">
    <h3>👋 Welcome to VibeLearn</h3>
    <p>Learn programming by building projects with guided AI teaching.</p>
    <ol>
      <li>Choose a model provider</li>
      <li>Configure access</li>
      <li>Start learning</li>
    </ol>
    <div class="onboarding-btns">
      <button type="button" data-cmd="vibelearn.pickModel" title="Choose your AI provider and model">Choose Model</button>
      <button type="button" data-cmd="vibelearn.setApiKey" title="Add your API key (not needed for Ollama)">Set API Key</button>
    </div>
  </div>
  <div id="messages">
    <div class="welcome" id="welcome">
      <h2>👋 Welcome to <span class="brand"><span class="c1">V</span><span class="c2">i</span><span class="c3">b</span><span class="c4">e</span><span class="c5">L</span><span class="c6">e</span><span class="c7">a</span><span class="c8">r</span><span class="c9">n</span></span></h2>
      <p>I'm a learning-first coding tutor. I won't write your whole program — I'll ask questions, drop hints, and name the concepts so you actually learn while you build.</p>
      <p>The <strong>help</strong> selector above controls how much I show: <em>strict</em> = questions only, <em>full</em> = real answers. Default is <em>guided</em>.</p>
      <div class="pill-row">
        <button class="pill" type="button" data-prompt="How do for loops work in Python?">How do for loops work?</button>
        <button class="pill" type="button" data-prompt="What's a closure in JavaScript?">What's a closure?</button>
        <button class="pill" type="button" data-prompt="Help me debug a NullPointerException I keep getting.">Help me debug</button>
        <button class="pill" type="button" data-prompt="I want to build a todo app. Where should I start?">Plan a project</button>
      </div>
    </div>
  </div>
  <form id="form">
    <input id="input" type="text" placeholder="Ask anything — I'll teach, not solve…" autocomplete="off" />
    <button id="send" type="submit">Send</button>
  </form>
  <div id="bottom-bar">
    <label for="level">help</label>
    <select id="level" title="Change how much VibeLearn teaches vs. answers">
      <option value="strict">strict</option>
      <option value="guided">guided</option>
      <option value="assist">assist</option>
      <option value="full">full</option>
    </select>
    <span id="meta-session"></span>
    <button id="btn-gear" class="linkbtn" type="button" title="Settings">⚙</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const levelEl = document.getElementById('level');
    const onboardingEl = document.getElementById('onboarding');
    const actionsEl = document.getElementById('actions');
    let typingEl = null;

    function clearWelcome() {
      if (welcomeEl && welcomeEl.parentNode) welcomeEl.remove();
    }

    function append(text, role) {
      clearWelcome();
      const el = document.createElement('div');
      el.className = 'msg ' + role;
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping(on) {
      if (on && !typingEl) {
        clearWelcome();
        typingEl = document.createElement('div');
        typingEl.className = 'typing';
        typingEl.innerHTML = '<span>thinking</span><span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        messagesEl.appendChild(typingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else if (!on && typingEl) {
        typingEl.remove();
        typingEl = null;
      }
    }

    function send(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      append(trimmed, 'user');
      vscode.postMessage({ type: 'userMessage', text: trimmed });
      input.value = '';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });

    document.querySelectorAll('.pill').forEach((p) => {
      p.addEventListener('click', () => send(p.getAttribute('data-prompt') || p.textContent));
    });

    levelEl.addEventListener('change', () => {
      vscode.postMessage({ type: 'setHelpLevel', value: levelEl.value });
    });

    document.getElementById('actions')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) vscode.postMessage({ type: 'command', command: btn.getAttribute('data-cmd') });
      const tog = e.target.closest('[data-toggle]');
      if (tog) vscode.postMessage({ type: 'toggleSetting', key: tog.getAttribute('data-toggle') });
    });

    // Settings panel
    const MODELS = {
      openai: ['gpt-4o-mini','gpt-4o','gpt-4-turbo','o1-mini'],
      ollama: ['llama3.2','qwen2.5-coder:7b','mistral','phi3'],
      anthropic: ['claude-haiku-4-5','claude-sonnet-4-6','claude-opus-4-7'],
      gemini: ['gemini-1.5-flash','gemini-1.5-pro'],
      openrouter: ['openrouter/auto','anthropic/claude-sonnet-4','openai/gpt-4o-mini']
    };
    let settingsOpen = false;
    const settingsPanel = document.getElementById('settings-panel');
    const chatContent = document.getElementById('messages');
    const chatForm = document.getElementById('form');
    const actionsEl2 = document.getElementById('actions');

    function openSettings() {
      settingsOpen = true;
      settingsPanel.style.display = 'flex';
      chatContent.style.display = 'none';
      chatForm.style.display = 'none';
      if (actionsEl2) actionsEl2.style.display = 'none';
    }
    function closeSettings() {
      settingsOpen = false;
      settingsPanel.style.display = 'none';
      chatContent.style.display = 'flex';
      chatForm.style.display = 'flex';
    }

    document.getElementById('btn-gear').addEventListener('click', () => settingsOpen ? closeSettings() : openSettings());
    document.getElementById('btn-close-settings').addEventListener('click', () => closeSettings());

    // Populate model dropdown when provider changes in settings
    function populateModels(provider) {
      const sel = document.getElementById('sp-model');
      sel.innerHTML = '';
      (MODELS[provider] || []).forEach(m => {
        const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o);
      });
      const keyDesc = document.getElementById('sp-key-desc');
      if (keyDesc) keyDesc.textContent = provider === 'ollama' ? 'Not needed for Ollama.' : 'Stored securely in OS keychain.';
    }

    document.getElementById('sp-provider').addEventListener('change', (e) => {
      populateModels(e.target.value);
      vscode.postMessage({ type: 'setProvider', provider: e.target.value });
    });

    document.getElementById('sp-save-model').addEventListener('click', () => {
      const custom = document.getElementById('sp-model-custom').value.trim();
      const model = custom || document.getElementById('sp-model').value;
      if (model) vscode.postMessage({ type: 'setModel', model });
    });

    document.getElementById('sp-save-key').addEventListener('click', () => {
      const key = document.getElementById('sp-key-input').value.trim();
      const provider = document.getElementById('sp-provider').value;
      if (!key) return;
      vscode.postMessage({ type: 'saveApiKey', provider, key });
      document.getElementById('sp-key-input').value = '';
    });

    // Toggle switches in settings panel
    document.getElementById('settings-panel').addEventListener('click', (e) => {
      const tog = e.target.closest('.sp-toggle[data-toggle]');
      if (tog) vscode.postMessage({ type: 'toggleSetting', key: tog.getAttribute('data-toggle') });
      const cmd = e.target.closest('[data-cmd]');
      if (cmd) vscode.postMessage({ type: 'command', command: cmd.getAttribute('data-cmd') });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'assistantMessage') {
        append(msg.text, 'assistant');
      } else if (msg.type === 'errorMessage') {
        append(msg.text, 'error');
      } else if (msg.type === 'userBubble') {
        append(msg.text, 'user');
      } else if (msg.type === 'firstRunWelcome') {
        clearWelcome();
        const el = document.createElement('div');
        el.className = 'msg assistant';
        el.innerHTML = '<strong>👋 Welcome to VibeLearn!</strong><br><br>' +
          'The best way to learn is by building.<br><br>' +
          '<strong>Try this:</strong><br>' +
          '1. Start a Learning Session<br>' +
          '2. Enter a project idea<br>' +
          '3. Follow the milestones<br>' +
          '4. Use Reflection Questions and Test My Understanding to reinforce learning<br><br>' +
          'Would you like to build something? Pick a starter:' +
          '<div class="starter-chips">' +
          '<button class="starter-chip" data-idea="A Todo App">Todo App</button>' +
          '<button class="starter-chip" data-idea="A Discord Bot">Discord Bot</button>' +
          '<button class="starter-chip" data-idea="A Personal Portfolio">Portfolio</button>' +
          '</div>' +
          '<button class="dismiss-link" id="dismiss-welcome">Dismiss</button>';
        messagesEl.appendChild(el);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        el.querySelectorAll('.starter-chip').forEach((btn) => {
          btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'startSession', idea: btn.getAttribute('data-idea') });
            el.remove();
          });
        });
        el.querySelector('#dismiss-welcome').addEventListener('click', () => {
          vscode.postMessage({ type: 'dismissFirstRun' });
          el.remove();
        });
      } else if (msg.type === 'busy') {
        showTyping(!!msg.busy);
        sendBtn.disabled = !!msg.busy;
        input.disabled = !!msg.busy;
        if (!msg.busy) input.focus();
      } else if (msg.type === 'toggleSettings') {
        settingsOpen ? closeSettings() : openSettings();
      } else if (msg.type === 'settings') {
        if (msg.helpLevel) levelEl.value = msg.helpLevel;
        const configured = !!msg.configured;
        if (onboardingEl) onboardingEl.style.display = configured ? 'none' : 'block';
        if (!settingsOpen && actionsEl) actionsEl.style.display = configured ? 'flex' : 'none';

        // Sync settings panel controls
        const spProvider = document.getElementById('sp-provider');
        if (spProvider && msg.provider) { spProvider.value = msg.provider; populateModels(msg.provider); }
        const spModel = document.getElementById('sp-model');
        if (spModel && msg.model) spModel.value = msg.model;
        const tog = (id, on) => { const b = document.getElementById(id); if (b) { b.className = 'sp-toggle' + (on ? ' on' : ''); } };
        tog('sp-socratic', msg.socraticMode);
        tog('sp-attempt', msg.attemptFirst);
        tog('sp-workspace', msg.includeWorkspaceContext);

        // Session-contextual groups
        const hasSession = !!msg.sessionName;
        const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? 'flex' : 'none'; };
        show('grp-no-session-project', !hasSession);
        show('grp-no-session-code', !hasSession);
        show('grp-session-project', hasSession);
        show('grp-session-learn', hasSession);
        show('grp-session-code', hasSession);

        const statusEl = document.getElementById('session-status') || document.getElementById('meta-session');
        if (statusEl) {
          statusEl.textContent = hasSession
            ? '\uD83D\uDCCD ' + msg.sessionName + ' \u2022 ' + msg.sessionProgress
            : '';
        }
      }
    });

    vscode.postMessage({ type: 'webviewReady' });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
