import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildMessages, buildSystemPrompt } from './promptBuilder';
import { ChatMessage, HelpLevel } from './types';

const LEVELS: HelpLevel[] = ['strict', 'guided', 'assist', 'full'];

describe('buildSystemPrompt', () => {
  it('produces a non-empty prompt for every help level', () => {
    for (const level of LEVELS) {
      const prompt = buildSystemPrompt(level);
      assert.ok(prompt.length > 200, `prompt for ${level} too short`);
      assert.match(prompt, /VibeLearn/i, `${level} prompt missing identity`);
      assert.match(prompt, /tutor|teacher|teach|learn/i, `${level} prompt missing teaching framing`);
    }
  });

  it('strict mode forbids code by default', () => {
    const p = buildSystemPrompt('strict');
    assert.match(p, /STRICT/);
    assert.match(p, /not write code|no code|absolutely necessary/i);
  });

  it('guided mode avoids full solutions', () => {
    const p = buildSystemPrompt('guided');
    assert.match(p, /GUIDED/);
    assert.match(p, /full solution|just give me|show me the answer/i);
  });

  it('assist mode allows partial code', () => {
    const p = buildSystemPrompt('assist');
    assert.match(p, /ASSIST/);
    assert.match(p, /partial code|partial-code/i);
  });

  it('full mode allows complete answers but still teaches', () => {
    const p = buildSystemPrompt('full');
    assert.match(p, /FULL/);
    assert.match(p, /complete code|full solution/i);
    assert.match(p, /concept|why|explain/i);
  });

  it('every level mentions asking what the user has tried', () => {
    for (const level of LEVELS) {
      const p = buildSystemPrompt(level);
      assert.match(p, /tried|attempt/i, `${level} prompt missing "what have you tried"`);
    }
  });
});

describe('buildMessages', () => {
  it('prepends the system prompt to history', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'how do for loops work?' }
    ];
    const out = buildMessages({ level: 'guided', history });
    assert.equal(out.length, 2);
    assert.equal(out[0].role, 'system');
    assert.equal(out[1].role, 'user');
    assert.equal(out[1].content, 'how do for loops work?');
  });

  it('strips any pre-existing system messages from history', () => {
    const history: ChatMessage[] = [
      { role: 'system', content: 'old system' },
      { role: 'user', content: 'hi' }
    ];
    const out = buildMessages({ level: 'guided', history });
    assert.equal(out.length, 2);
    assert.equal(out[0].role, 'system');
    assert.notEqual(out[0].content, 'old system');
    assert.equal(out[1].role, 'user');
  });

  it('preserves user/assistant order', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' }
    ];
    const out = buildMessages({ level: 'full', history });
    assert.deepEqual(
      out.slice(1).map((m) => m.role),
      ['user', 'assistant', 'user']
    );
  });
});
