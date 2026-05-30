import type * as vscode from 'vscode';

export interface OnboardingState {
  configured: boolean;
  provider: string;
}

/**
 * A user is considered configured if:
 * - provider is 'ollama' (no key needed), OR
 * - provider is anything else AND an API key is stored for it
 */
export async function getOnboardingState(
  secrets: vscode.SecretStorage,
  provider: string
): Promise<OnboardingState> {
  if (provider === 'ollama') {
    return { configured: true, provider };
  }
  const key = await secrets.get(`vibelearn.apiKey.${provider}`);
  return { configured: !!key, provider };
}

export function isConfigured(state: OnboardingState): boolean {
  return state.configured;
}
