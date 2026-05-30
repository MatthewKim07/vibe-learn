import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildReflectionMessagesForCode,
  buildReflectionMessagesForSession
} from './reflectionPrompt';

describe('buildReflectionMessagesForCode', () => {
  it('returns system then user messages', () => {
    const msgs = buildReflectionMessagesForCode({ code: 'const x = 1;', language: 'typescript' });
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[1].role, 'user');
  });

  it('user message contains the code', () => {
    const msgs = buildReflectionMessagesForCode({ code: 'function add(a, b) { return a + b; }', language: 'javascript' });
    assert.match(msgs[1].content, /function add/);
  });

  it('user message includes the language', () => {
    const msgs = buildReflectionMessagesForCode({ code: 'x = 1', language: 'python' });
    assert.match(msgs[1].content, /python/i);
  });

  it('system prompt asks questions only and forbids code', () => {
    const sys = buildReflectionMessagesForCode({ code: 'x', language: 'js' })[0].content;
    assert.match(sys, /ask.*question|question.*only/i);
    assert.match(sys, /never generate code/i);
  });

  it('system prompt requires numbered questions', () => {
    const sys = buildReflectionMessagesForCode({ code: 'x', language: 'js' })[0].content;
    assert.match(sys, /1\.|2\.|3\./);
  });
});

describe('buildReflectionMessagesForSession', () => {
  it('returns system then user messages', () => {
    const msgs = buildReflectionMessagesForSession({
      projectName: 'Todo App',
      currentMilestone: 'Setup project'
    });
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[1].role, 'user');
  });

  it('user message contains project name and milestone', () => {
    const msgs = buildReflectionMessagesForSession({
      projectName: 'Weather App',
      currentMilestone: 'Fetch API data'
    });
    assert.match(msgs[1].content, /Weather App/);
    assert.match(msgs[1].content, /Fetch API data/);
  });

  it('includes profileContext when provided', () => {
    const msgs = buildReflectionMessagesForSession({
      projectName: 'App',
      currentMilestone: 'M1',
      profileContext: '## Learner Context\n- Concepts seen: loop'
    });
    assert.match(msgs[1].content, /Learner Context/);
  });

  it('omits profileContext section when not provided', () => {
    const msgs = buildReflectionMessagesForSession({
      projectName: 'App',
      currentMilestone: 'M1'
    });
    assert.ok(!msgs[1].content.includes('Learner Context'));
  });

  it('shares the same system prompt as the code flow', () => {
    const codeSys = buildReflectionMessagesForCode({ code: 'x', language: 'js' })[0].content;
    const sessionSys = buildReflectionMessagesForSession({ projectName: 'A', currentMilestone: 'B' })[0].content;
    assert.equal(codeSys, sessionSys);
  });
});
