import * as vscode from 'vscode';

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

const KEY_PREFIX = 'vibelearn.apiKey.';

function secretKey(provider: Provider): string {
  return `${KEY_PREFIX}${provider}`;
}

export async function getApiKey(
  secrets: vscode.SecretStorage,
  provider: Provider
): Promise<string | undefined> {
  return secrets.get(secretKey(provider));
}

export async function storeApiKey(
  secrets: vscode.SecretStorage,
  provider: Provider,
  value: string
): Promise<void> {
  await secrets.store(secretKey(provider), value);
}

export async function deleteApiKey(
  secrets: vscode.SecretStorage,
  provider: Provider
): Promise<void> {
  await secrets.delete(secretKey(provider));
}

export async function pickProvider(
  defaultProvider: Provider
): Promise<Provider | undefined> {
  const items: vscode.QuickPickItem[] = [
    { label: 'openai', description: 'OpenAI (GPT)' },
    { label: 'anthropic', description: 'Anthropic (Claude)' },
    { label: 'gemini', description: 'Google Gemini' },
    { label: 'ollama', description: 'Ollama (local, no key)' }
  ];
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Select provider (default: ${defaultProvider})`,
    ignoreFocusOut: true
  });
  return picked?.label as Provider | undefined;
}

export async function promptForApiKey(provider: Provider): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: `Enter ${provider} API key`,
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'API key — stored in VS Code SecretStorage',
    validateInput: (v) => (v.trim().length === 0 ? 'API key cannot be empty.' : null)
  });
}
