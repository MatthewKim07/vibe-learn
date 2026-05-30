import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { getOnboardingState, isConfigured } from './onboarding';

function makeSecrets(store: Record<string, string>) {
  return {
    async get(key: string) { return store[key]; }
  } as unknown as import('vscode').SecretStorage;
}

describe('getOnboardingState', () => {
  it('ollama is always configured regardless of stored keys', async () => {
    const state = await getOnboardingState(makeSecrets({}), 'ollama');
    assert.equal(state.configured, true);
    assert.equal(state.provider, 'ollama');
  });

  it('openai is configured when a key is stored', async () => {
    const state = await getOnboardingState(
      makeSecrets({ 'vibelearn.apiKey.openai': 'sk-test' }),
      'openai'
    );
    assert.equal(state.configured, true);
  });

  it('openai is not configured when no key is stored', async () => {
    const state = await getOnboardingState(makeSecrets({}), 'openai');
    assert.equal(state.configured, false);
  });

  it('anthropic is configured when a key is stored', async () => {
    const state = await getOnboardingState(
      makeSecrets({ 'vibelearn.apiKey.anthropic': 'sk-ant' }),
      'anthropic'
    );
    assert.equal(state.configured, true);
  });

  it('anthropic is not configured when no key is stored', async () => {
    const state = await getOnboardingState(makeSecrets({}), 'anthropic');
    assert.equal(state.configured, false);
  });
});

describe('isConfigured', () => {
  it('returns true when configured', () => {
    assert.equal(isConfigured({ configured: true, provider: 'openai' }), true);
  });

  it('returns false when not configured', () => {
    assert.equal(isConfigured({ configured: false, provider: 'openai' }), false);
  });
});
