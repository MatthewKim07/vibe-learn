import * as vscode from 'vscode';
import { createClient } from './ai';
import { buildSystemPrompt } from './ai/systemPrompt';
import { ChatMessage, HelpLevel, LLMError, Provider } from './ai/types';
import { getApiKey } from './secrets';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibelearn.chatView';

  private history: ChatMessage[] = [];
  private webviewView?: vscode.WebviewView;

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
      }
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

      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(helpLevel) },
        ...this.history
      ];

      const reply = await client.complete({ model, messages });
      this.history.push({ role: 'assistant', content: reply });
      this.postAssistant(reply);
    } catch (err) {
      const message = err instanceof LLMError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error.';
      this.postError(message);
      // Roll back the user message so the next turn doesn't replay a failed exchange.
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
    body {
      margin: 0; padding: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex; flex-direction: column;
      height: 100vh;
    }
    header {
      padding: 10px 12px; font-weight: 600;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    #messages {
      flex: 1; overflow-y: auto;
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .msg {
      padding: 8px 10px; border-radius: 6px;
      max-width: 90%; line-height: 1.4;
      white-space: pre-wrap; word-wrap: break-word;
    }
    .msg.user {
      align-self: flex-end;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .msg.assistant {
      align-self: flex-start;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
    }
    .msg.error {
      align-self: stretch;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-foreground));
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic; text-align: center; margin-top: 20px;
    }
    .typing {
      align-self: flex-start;
      color: var(--vscode-descriptionForeground);
      font-style: italic; padding: 4px 10px;
    }
    form {
      display: flex; gap: 6px; padding: 8px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    #input {
      flex: 1; padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      font-family: inherit; font-size: inherit;
      outline: none;
    }
    #input:focus { border-color: var(--vscode-focusBorder); }
    button {
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; cursor: pointer;
      font-family: inherit;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <header>VibeLearn</header>
  <div id="messages">
    <div class="empty" id="empty">Ask a question to get started.</div>
  </div>
  <form id="form">
    <input id="input" type="text" placeholder="Type your question..." autocomplete="off" />
    <button id="send" type="submit">Send</button>
  </form>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const emptyEl = document.getElementById('empty');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    let typingEl = null;

    function clearEmpty() {
      if (emptyEl && emptyEl.parentNode) emptyEl.remove();
    }

    function append(text, role) {
      clearEmpty();
      const el = document.createElement('div');
      el.className = 'msg ' + role;
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping(on) {
      if (on && !typingEl) {
        clearEmpty();
        typingEl = document.createElement('div');
        typingEl.className = 'typing';
        typingEl.textContent = 'thinking…';
        messagesEl.appendChild(typingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else if (!on && typingEl) {
        typingEl.remove();
        typingEl = null;
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      append(text, 'user');
      vscode.postMessage({ type: 'userMessage', text });
      input.value = '';
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'assistantMessage') {
        append(msg.text, 'assistant');
      } else if (msg.type === 'errorMessage') {
        append(msg.text, 'error');
      } else if (msg.type === 'busy') {
        showTyping(!!msg.busy);
        sendBtn.disabled = !!msg.busy;
        input.disabled = !!msg.busy;
        if (!msg.busy) input.focus();
      }
    });
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
