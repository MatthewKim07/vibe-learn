import * as vscode from 'vscode';
import { createClient } from './ai';
import { buildMessages } from './ai/promptBuilder';
import { AIError, ChatMessage, HelpLevel, Provider } from './ai/types';
import { getApiKey } from './secrets';

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
      if (msg?.type === 'userMessage' && typeof msg.text === 'string') {
        await this.handleUserMessage(msg.text);
      } else if (msg?.type === 'webviewReady') {
        this.postSettings();
        if (this.pendingExternal) {
          const pending = this.pendingExternal;
          this.pendingExternal = undefined;
          await this.submitExternal(pending.payload, pending.displayText);
        }
      } else if (msg?.type === 'setHelpLevel' && typeof msg.value === 'string') {
        await this.applyHelpLevel(msg.value);
      } else if (msg?.type === 'clearChat') {
        this.history = [];
      } else if (msg?.type === 'openSettings') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:vibelearn.vibelearn'
        );
      } else if (msg?.type === 'pickModel') {
        await vscode.commands.executeCommand('vibelearn.pickModel');
      } else if (msg?.type === 'setApiKey') {
        await vscode.commands.executeCommand('vibelearn.setApiKey');
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

  private async applyHelpLevel(value: string) {
    if (!HELP_LEVELS.includes(value as HelpLevel)) return;
    await vscode.workspace
      .getConfiguration('vibelearn')
      .update('helpLevel', value, vscode.ConfigurationTarget.Global);
  }

  private postSettings() {
    if (!this.webviewView) return;
    const cfg = vscode.workspace.getConfiguration('vibelearn');
    this.webviewView.webview.postMessage({
      type: 'settings',
      provider: cfg.get<Provider>('provider', 'openai'),
      model: cfg.get<string>('model', ''),
      helpLevel: cfg.get<HelpLevel>('helpLevel', 'guided')
    });
  }

  private async handleUserMessage(text: string) {
    const cfg = vscode.workspace.getConfiguration('vibelearn');
    const provider = cfg.get<Provider>('provider', 'openai');
    const model = cfg.get<string>('model', 'gpt-4o-mini');
    const helpLevel = cfg.get<HelpLevel>('helpLevel', 'guided');

    this.history.push({ role: 'user', content: text });
    this.postBusy(true);

    try {
      const apiKey = await getApiKey(this.context.secrets, provider);
      const client = createClient({ provider, apiKey });

      const messages = buildMessages({ level: helpLevel, history: this.history });

      const reply = await client.complete({ model, messages });
      this.history.push({ role: 'assistant', content: reply });
      this.postAssistant(reply);
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
      color: #e8e6f0;
      background:
        radial-gradient(120% 60% at 50% -10%, rgba(200, 182, 226, 0.04) 0%, transparent 60%),
        radial-gradient(120% 60% at 50% 110%, rgba(169, 197, 229, 0.04) 0%, transparent 60%),
        #060608;
      display: flex; flex-direction: column;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }
    .ornament {
      position: fixed; left: 0; right: 0;
      width: 100%; height: 56px;
      pointer-events: none;
      z-index: 0; opacity: 0.10;
      color: #c8b6e2;
    }
    .ornament.top { top: 0; }
    .ornament.bottom { bottom: 0; transform: scaleY(-1); }
    header, .meta, #messages, form {
      position: relative; z-index: 1;
    }
    header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 10px 12px;
      border-bottom: 1px solid rgba(200, 182, 226, 0.10);
      background: rgba(200, 182, 226, 0.02);
    }
    .title {
      font-weight: 700; font-size: 13px;
      letter-spacing: 0.3px;
      display: inline-flex; align-items: center;
    }
    .title .dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: var(--vscode-charts-green, #4ec9b0);
      margin-right: 6px;
    }
    .brand {
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .brand .c1 { color: #f5a9a9; }
    .brand .c2 { color: #f5c9a9; }
    .brand .c3 { color: #f5e9a9; }
    .brand .c4 { color: #b9e5b8; }
    .brand .c5 { color: #a9e5d9; }
    .brand .c6 { color: #a9c5e5; }
    .brand .c7 { color: #b8a9e5; }
    .brand .c8 { color: #e5a9d9; }
    .brand .c9 { color: #d9a9c5; }
    .level-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .level-row select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, transparent);
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 11px;
      font-family: inherit;
    }
    .meta {
      padding: 6px 12px;
      font-size: 11px;
      color: #b8b4c8;
      border-bottom: 1px solid rgba(200, 182, 226, 0.08);
      background: rgba(200, 182, 226, 0.015);
      display: flex; gap: 10px; flex-wrap: wrap;
    }
    .meta button.linkbtn {
      background: transparent; border: none; padding: 0;
      color: var(--vscode-textLink-foreground);
      cursor: pointer; font-size: 11px;
      text-decoration: none;
    }
    .meta button.linkbtn:hover { text-decoration: underline; }
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
  <svg class="ornament top" viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="currentColor">
      <path d="M120 6 L122 14 L130 16 L122 18 L120 26 L118 18 L110 16 L118 14 Z"/>
      <circle cx="120" cy="30" r="1.6"/>
      <path d="M115 9 Q113 6 116 4 Q119 6 117 9 Z"/>
      <path d="M125 9 Q127 6 124 4 Q121 6 123 9 Z"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
      <path d="M120 20 Q104 20 94 23 Q86 25 80 23 Q73 21 68 25"/>
      <path d="M120 20 Q136 20 146 23 Q154 25 160 23 Q167 21 172 25"/>
      <path d="M80 23 Q76 28 82 31 Q88 31 86 25"/>
      <path d="M160 23 Q164 28 158 31 Q152 31 154 25"/>
      <path d="M68 25 Q58 23 53 27 Q49 29 45 26"/>
      <path d="M172 25 Q182 23 187 27 Q191 29 195 26"/>
      <path d="M45 26 Q38 24 32 28 Q28 30 23 27"/>
      <path d="M195 26 Q202 24 208 28 Q212 30 217 27"/>
      <path d="M23 27 Q18 30 14 28"/>
      <path d="M217 27 Q222 30 226 28"/>
      <path d="M94 23 Q92 17 96 13"/>
      <path d="M146 23 Q148 17 144 13"/>
    </g>
    <g fill="currentColor">
      <path d="M96 13 Q94 10 96 8 Q98 10 96 13 Z"/>
      <path d="M144 13 Q146 10 144 8 Q142 10 144 13 Z"/>
      <circle cx="14" cy="28" r="1.2"/>
      <circle cx="226" cy="28" r="1.2"/>
    </g>
  </svg>
  <svg class="ornament bottom" viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="currentColor">
      <path d="M120 6 L122 14 L130 16 L122 18 L120 26 L118 18 L110 16 L118 14 Z"/>
      <circle cx="120" cy="30" r="1.6"/>
      <path d="M115 9 Q113 6 116 4 Q119 6 117 9 Z"/>
      <path d="M125 9 Q127 6 124 4 Q121 6 123 9 Z"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
      <path d="M120 20 Q104 20 94 23 Q86 25 80 23 Q73 21 68 25"/>
      <path d="M120 20 Q136 20 146 23 Q154 25 160 23 Q167 21 172 25"/>
      <path d="M80 23 Q76 28 82 31 Q88 31 86 25"/>
      <path d="M160 23 Q164 28 158 31 Q152 31 154 25"/>
      <path d="M68 25 Q58 23 53 27 Q49 29 45 26"/>
      <path d="M172 25 Q182 23 187 27 Q191 29 195 26"/>
      <path d="M45 26 Q38 24 32 28 Q28 30 23 27"/>
      <path d="M195 26 Q202 24 208 28 Q212 30 217 27"/>
      <path d="M23 27 Q18 30 14 28"/>
      <path d="M217 27 Q222 30 226 28"/>
      <path d="M94 23 Q92 17 96 13"/>
      <path d="M146 23 Q148 17 144 13"/>
    </g>
    <g fill="currentColor">
      <path d="M96 13 Q94 10 96 8 Q98 10 96 13 Z"/>
      <path d="M144 13 Q146 10 144 8 Q142 10 144 13 Z"/>
      <circle cx="14" cy="28" r="1.2"/>
      <circle cx="226" cy="28" r="1.2"/>
    </g>
  </svg>
  <header>
    <div class="title"><span class="dot"></span><span class="brand"><span class="c1">V</span><span class="c2">i</span><span class="c3">b</span><span class="c4">e</span><span class="c5">L</span><span class="c6">e</span><span class="c7">a</span><span class="c8">r</span><span class="c9">n</span></span></div>
    <div class="level-row">
      <label for="level">help</label>
      <select id="level" title="Change how much VibeLearn teaches vs. answers">
        <option value="strict">strict</option>
        <option value="guided">guided</option>
        <option value="assist">assist</option>
        <option value="full">full</option>
      </select>
    </div>
  </header>
  <div class="meta">
    <span id="meta-provider">provider: —</span>
    <span id="meta-model">model: —</span>
    <button class="linkbtn" id="btn-pick-model" type="button">change model</button>
    <button class="linkbtn" id="btn-set-key" type="button">set API key</button>
    <button class="linkbtn" id="btn-clear" type="button">clear chat</button>
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
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const levelEl = document.getElementById('level');
    const metaProvider = document.getElementById('meta-provider');
    const metaModel = document.getElementById('meta-model');
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

    document.getElementById('btn-pick-model').addEventListener('click', () => {
      vscode.postMessage({ type: 'pickModel' });
    });
    document.getElementById('btn-set-key').addEventListener('click', () => {
      vscode.postMessage({ type: 'setApiKey' });
    });
    document.getElementById('btn-clear').addEventListener('click', () => {
      while (messagesEl.firstChild) messagesEl.removeChild(messagesEl.firstChild);
      messagesEl.appendChild(welcomeEl.cloneNode(true));
      // re-bind pill listeners on the new node
      document.querySelectorAll('.pill').forEach((p) => {
        p.addEventListener('click', () => send(p.getAttribute('data-prompt') || p.textContent));
      });
      vscode.postMessage({ type: 'clearChat' });
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
      } else if (msg.type === 'busy') {
        showTyping(!!msg.busy);
        sendBtn.disabled = !!msg.busy;
        input.disabled = !!msg.busy;
        if (!msg.busy) input.focus();
      } else if (msg.type === 'settings') {
        if (msg.helpLevel) levelEl.value = msg.helpLevel;
        if (msg.provider) metaProvider.textContent = 'provider: ' + msg.provider;
        if (msg.model) metaModel.textContent = 'model: ' + msg.model;
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
