import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { rewritePrompt } from './promptRewrite';

describe('rewritePrompt', () => {
  it('returns empty string for empty input', () => {
    assert.equal(rewritePrompt(''), '');
    assert.equal(rewritePrompt('   '), '');
  });

  it('rewrites "build me X" into a step-by-step learning prompt', () => {
    const out = rewritePrompt('Build me a React login page');
    assert.match(out, /step by step/i);
    assert.match(out, /react login page/i);
    assert.match(out, /hint|ask|try/i);
    assert.doesNotMatch(out, /^Build me/i);
  });

  it('rewrites "write me X" into a teaching-focused prompt', () => {
    const out = rewritePrompt('Write me a function that sorts an array');
    assert.match(out, /teach|tried|hint/i);
    assert.match(out, /function that sorts/i);
  });

  it('rewrites "fix this bug" into a debugging guide', () => {
    const out = rewritePrompt('Fix this bug in my code');
    assert.match(out, /debug|expected|concept/i);
  });

  it('rewrites "explain X" into a tutor-style explainer', () => {
    const out = rewritePrompt('Explain closures in JavaScript');
    assert.match(out, /closures in javascript/i);
    assert.match(out, /tutor|analogy|concept/i);
  });

  it('rewrites "optimize this" into improvement coaching', () => {
    const out = rewritePrompt('Optimize this function');
    assert.match(out, /improve|coach|concept/i);
  });

  it('rewrites "how do I X" into a learning prompt', () => {
    const out = rewritePrompt('How do I parse JSON in Python');
    assert.match(out, /tried|hint|concept/i);
    assert.match(out, /parse json in python/i);
  });

  it('falls back to a generic teaching wrapper for unmatched prompts', () => {
    const input = 'gimme code that uploads files to s3';
    const out = rewritePrompt(input);
    assert.match(out, /teach|hint|concept|tried/i);
    assert.ok(out.includes(input), 'generic rewrite should preserve original');
  });

  it('preserves the user\'s subject in the rewrite', () => {
    const out = rewritePrompt('Build me an authentication system');
    assert.match(out, /authentication system/i);
  });
});
