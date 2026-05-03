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
