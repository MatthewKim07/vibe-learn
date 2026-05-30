import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { hasAttempt } from './attemptDetector';

describe('hasAttempt', () => {
  it('returns true for messages with a code block', () => {
    assert.ok(hasAttempt('Here is what I have:\n```js\nconst x = 1;\n```'));
  });

  it('returns true for "I tried..."', () => {
    assert.ok(hasAttempt('I tried using a for loop but it broke'));
  });

  it('returns true for "here is my code"', () => {
    assert.ok(hasAttempt("Here is my code so far"));
  });

  it('returns true for "this is what I have"', () => {
    assert.ok(hasAttempt('This is what I have, not sure if it is right'));
  });

  it('returns true for "my approach is"', () => {
    assert.ok(hasAttempt('My approach is to use recursion'));
  });

  it('returns true for "I think I should"', () => {
    assert.ok(hasAttempt('I think I should use a map here'));
  });

  it('returns true for "I wrote"', () => {
    assert.ok(hasAttempt('I wrote a function but it returns undefined'));
  });

  it('returns false for a plain question with no attempt', () => {
    assert.ok(!hasAttempt('How do I reverse a string in JavaScript?'));
  });

  it('returns false for a vague request', () => {
    assert.ok(!hasAttempt('Build me a todo app'));
  });

  it('is case-insensitive', () => {
    assert.ok(hasAttempt('I TRIED using async/await'));
    assert.ok(hasAttempt('HERE IS MY CODE'));
  });
});
