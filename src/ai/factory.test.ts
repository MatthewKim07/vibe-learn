import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createClient } from './index';
import { AIError, Provider } from './types';

describe('createClient factory', () => {
  it('returns an OpenAI client when provider=openai with a key', () => {
    const client = createClient({ provider: 'openai', apiKey: 'sk-test' });
    assert.equal(client.provider, 'openai');
    assert.equal(typeof client.complete, 'function');
  });

  it('throws AIError when provider=openai without a key', () => {
    assert.throws(
      () => createClient({ provider: 'openai' }),
      (err: unknown) => err instanceof AIError && /API key/i.test(err.message)
    );
  });

  const stubs: Provider[] = ['anthropic', 'gemini', 'openrouter'];

  for (const p of stubs) {
    it(`returns a placeholder client for ${p}`, async () => {
      const client = createClient({ provider: p, apiKey: 'irrelevant' });
      assert.equal(client.provider, p);

      await assert.rejects(
        client.complete({ model: 'x', messages: [] }),
        (err: unknown) =>
          err instanceof AIError && /not implemented yet/i.test(err.message)
      );
    });
  }

  it('returns a real Ollama client (no API key required)', () => {
    const client = createClient({ provider: 'ollama' });
    assert.equal(client.provider, 'ollama');
    assert.equal(typeof client.complete, 'function');
  });
});
