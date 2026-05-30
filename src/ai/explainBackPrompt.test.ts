import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildExplainBackMessages, buildExplainPrompt } from './explainBackPrompt';

describe('buildExplainPrompt', () => {
  it('includes the concept name', () => {
    assert.match(buildExplainPrompt('async/await'), /async\/await/);
  });

  it('asks for own words explanation', () => {
    assert.match(buildExplainPrompt('recursion'), /own words/i);
  });

  it('mentions sentence count guidance', () => {
    assert.match(buildExplainPrompt('closures'), /sentence/i);
  });
});

describe('buildExplainBackMessages', () => {
  it('returns system then user messages', () => {
    const msgs = buildExplainBackMessages({ concept: 'async/await', explanation: 'It lets you write async code that looks sync.' });
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[1].role, 'user');
  });

  it('user message contains the concept', () => {
    const msgs = buildExplainBackMessages({ concept: 'recursion', explanation: 'A function that calls itself.' });
    assert.match(msgs[1].content, /recursion/i);
  });

  it('user message contains the explanation', () => {
    const msgs = buildExplainBackMessages({ concept: 'closures', explanation: 'A function that remembers its outer scope.' });
    assert.match(msgs[1].content, /remembers its outer scope/);
  });

  it('includes profileContext when provided', () => {
    const msgs = buildExplainBackMessages({
      concept: 'state',
      explanation: 'Data that changes over time.',
      profileContext: '## Learner Context\n- Concepts seen: loop'
    });
    assert.match(msgs[1].content, /Learner Context/);
  });

  it('omits profileContext when not provided', () => {
    const msgs = buildExplainBackMessages({ concept: 'state', explanation: 'Data that changes.' });
    assert.ok(!msgs[1].content.includes('Learner Context'));
  });

  it('system prompt forbids grading and scoring', () => {
    const sys = buildExplainBackMessages({ concept: 'x', explanation: 'y' })[0].content;
    assert.match(sys, /grade|score|pass\/fail/i);
  });

  it('system prompt requires the three output sections', () => {
    const sys = buildExplainBackMessages({ concept: 'x', explanation: 'y' })[0].content;
    assert.match(sys, /What You Understand Well/);
    assert.match(sys, /What Could Be Clearer/);
    assert.match(sys, /One Thing To Think About/);
  });

  it('system prompt requires encouraging tone', () => {
    const sys = buildExplainBackMessages({ concept: 'x', explanation: 'y' })[0].content;
    assert.match(sys, /encouraging/i);
  });
});
