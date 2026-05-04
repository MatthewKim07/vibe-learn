import * as vscode from 'vscode';
import { OllamaClient } from './ai/ollamaClient';
import { Provider } from './ai/types';

const CURATED: Record<Provider, Array<{ label: string; description: string }>> = {
  openai: [
    { label: 'gpt-4o-mini', description: 'fast, cheap, good default' },
    { label: 'gpt-4o', description: 'higher quality, more expensive' },
    { label: 'gpt-4-turbo', description: 'older flagship' },
    { label: 'o1-mini', description: 'reasoning model' }
  ],
  anthropic: [
    { label: 'claude-sonnet-4-6', description: 'balanced flagship' },
    { label: 'claude-opus-4-7', description: 'highest quality' },
    { label: 'claude-haiku-4-5', description: 'fast, cheap' }
  ],
  gemini: [
    { label: 'gemini-1.5-pro', description: 'flagship' },
    { label: 'gemini-1.5-flash', description: 'fast, cheap' }
  ],
  openrouter: [
    { label: 'openrouter/auto', description: 'router auto-pick' },
    { label: 'anthropic/claude-sonnet-4', description: 'via OpenRouter' },
    { label: 'openai/gpt-4o-mini', description: 'via OpenRouter' }
  ],
  ollama: []
};

export async function pickModel(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('vibelearn');
  const provider = cfg.get<Provider>('provider', 'openai');

  const items = await buildItems(provider);
  if (items.length === 0) {
    vscode.window.showInformationMessage(
      provider === 'ollama'
        ? 'No Ollama models installed locally. Pull one with `ollama pull llama3.2`.'
        : `No model suggestions available for "${provider}".`
    );
    return;
  }

  items.push({ label: '$(edit) Custom…', description: 'enter a model id manually' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Choose a ${provider} model (current: ${cfg.get<string>('model') ?? 'unset'})`,
    ignoreFocusOut: true,
    matchOnDescription: true
  });
  if (!picked) return;

  let modelId = picked.label;
  if (modelId.startsWith('$(edit)')) {
    const custom = await vscode.window.showInputBox({
      prompt: `Enter a ${provider} model id`,
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim().length === 0 ? 'Model id cannot be empty.' : null)
    });
    if (!custom) return;
    modelId = custom.trim();
  }

  await cfg.update('model', modelId, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`VibeLearn: model set to "${modelId}".`);
}

async function buildItems(provider: Provider): Promise<vscode.QuickPickItem[]> {
  if (provider === 'ollama') {
    try {
      const client = new OllamaClient();
      const installed = await client.listModels();
      return installed.map((name) => ({ label: name, description: 'installed locally' }));
    } catch (err) {
      vscode.window.showWarningMessage(
        err instanceof Error ? err.message : 'Could not list Ollama models.'
      );
      return [];
    }
  }
  return CURATED[provider].map((m) => ({ label: m.label, description: m.description }));
}
