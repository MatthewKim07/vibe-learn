import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { resolveModel } from './modelMatch';

const POOL = [
  'llama3.2:latest',
  'llama3.2:1b',
  'qwen2.5-coder:7b',
  'deepseek-coder:6.7b'
];

describe('resolveModel', () => {
  it('returns no match when nothing is installed', () => {
    const r = resolveModel('llama3.2', []);
    assert.equal(r.match, undefined);
    assert.deepEqual(r.suggestions, []);
  });

  it('matches an exact name', () => {
    const r = resolveModel('llama3.2:latest', POOL);
    assert.equal(r.match, 'llama3.2:latest');
  });

  it('is case-insensitive', () => {
    const r = resolveModel('LLAMA3.2:LATEST', POOL);
    assert.equal(r.match, 'llama3.2:latest');
  });

  it('ignores whitespace in the input', () => {
    const r = resolveModel('Llama 3.2', POOL);
    assert.equal(r.match, 'llama3.2:latest');
  });

  it('matches base name to :latest when both base and tagged exist', () => {
    const r = resolveModel('llama3.2', POOL);
    assert.equal(r.match, 'llama3.2:latest');
  });

  it('matches a unique substring', () => {
    const r = resolveModel('qwen', POOL);
    assert.equal(r.match, 'qwen2.5-coder:7b');
  });

  it('matches via Levenshtein for a small typo', () => {
    const r = resolveModel('llma3.2', POOL);
    assert.equal(r.match, 'llama3.2:latest');
  });

  it('returns suggestions when nothing is close', () => {
    const r = resolveModel('totally-unrelated-name', POOL);
    assert.equal(r.match, undefined);
    assert.ok(r.suggestions.length > 0);
    assert.ok(r.suggestions.length <= 3);
  });

  it('preserves the canonical tag in the result', () => {
    const r = resolveModel('qwen2.5-coder', POOL);
    assert.equal(r.match, 'qwen2.5-coder:7b');
  });
});
