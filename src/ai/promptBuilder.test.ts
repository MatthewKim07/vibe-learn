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

describe('buildSystemPrompt — attempt-first', () => {
  it('does NOT add attempt-first section when attemptFirst is false', () => {
    for (const level of LEVELS) {
      const p = buildSystemPrompt(level, false, false);
      assert.ok(!p.includes('Attempt-First'), `${level}: unexpected Attempt-First section`);
    }
  });

  it('adds attempt-first section when attemptFirst=true and no attempt detected', () => {
    for (const level of LEVELS) {
      const p = buildSystemPrompt(level, true, false);
      assert.match(p, /Attempt-First/, `${level}: missing Attempt-First section`);
    }
  });

  it('does NOT add attempt-first section when user has already shown an attempt', () => {
    for (const level of LEVELS) {
      const p = buildSystemPrompt(level, true, true);
      assert.ok(!p.includes('Attempt-First'), `${level}: should not add section when attempt present`);
    }
  });

  it('strict attempt-first tells model not to provide code', () => {
    const p = buildSystemPrompt('strict', true, false);
    assert.match(p, /do not provide code|not provide code|NOT provide code/i);
  });

  it('guided attempt-first holds back code until user responds', () => {
    const p = buildSystemPrompt('guided', true, false);
    assert.match(p, /hold back|without|until/i);
  });

  it('full attempt-first still allows full answer if explicitly asked', () => {
    const p = buildSystemPrompt('full', true, false);
    assert.match(p, /explicitly ask/i);
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

  it('passes attemptFirst and userHasAttempt through to the system prompt', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'how do I sort?' }];

    const withAttemptFirst = buildMessages({ level: 'strict', history, attemptFirst: true, userHasAttempt: false });
    assert.match(withAttemptFirst[0].content, /Attempt-First/);

    const withoutAttemptFirst = buildMessages({ level: 'strict', history, attemptFirst: false });
    assert.ok(!withoutAttemptFirst[0].content.includes('Attempt-First'));
  });

  it('includes sessionContext in system prompt when provided', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const out = buildMessages({ level: 'guided', history, sessionContext: '## Current Learning Session\nProject: Blog' });
    assert.match(out[0].content, /Current Learning Session/);
    assert.match(out[0].content, /Blog/);
  });

  it('does not add session section when sessionContext is empty', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const out = buildMessages({ level: 'guided', history, sessionContext: '' });
    assert.ok(!out[0].content.includes('Current Learning Session'));
  });

  it('includes both profileContext and sessionContext when both provided', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const out = buildMessages({
      level: 'guided',
      history,
      profileContext: '## Learner Context\n- Concepts seen: loop',
      sessionContext: '## Current Learning Session\nProject: Todo App'
    });
    assert.match(out[0].content, /Learner Context/);
    assert.match(out[0].content, /Current Learning Session/);
  });
});
