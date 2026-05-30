import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  LearningProfile,
  ProfileUpdate,
  clearLearningProfile,
  extractProfileUpdate,
  formatLearningProfileForPrompt,
  getLearningProfile,
  updateLearningProfile,
} from './learningProfile';

// ── Minimal globalState stub ──────────────────────────────────────────────────

function makeContext(initial?: LearningProfile) {
  let stored: LearningProfile | undefined = initial;
  return {
    globalState: {
      get<T>(_key: string): T | undefined { return stored as unknown as T; },
      async update(_key: string, value: unknown) { stored = value as LearningProfile | undefined; }
    }
  } as unknown as import('vscode').ExtensionContext;
}

// ── formatLearningProfileForPrompt ───────────────────────────────────────────

describe('formatLearningProfileForPrompt', () => {
  it('returns empty string for an empty profile', () => {
    const profile: LearningProfile = { conceptsSeen: [], strengths: [], struggles: [], lastUpdated: '' };
    assert.equal(formatLearningProfileForPrompt(profile), '');
  });

  it('includes concepts when present', () => {
    const profile: LearningProfile = { conceptsSeen: ['array', 'loop'], strengths: [], struggles: [], lastUpdated: '' };
    const out = formatLearningProfileForPrompt(profile);
    assert.match(out, /array/);
    assert.match(out, /loop/);
  });

  it('includes strengths and struggles when present', () => {
    const profile: LearningProfile = {
      conceptsSeen: [],
      strengths: ['function (understood)'],
      struggles: ['async (needs practice)'],
      lastUpdated: ''
    };
    const out = formatLearningProfileForPrompt(profile);
    assert.match(out, /function \(understood\)/);
    assert.match(out, /async \(needs practice\)/);
  });

  it('includes personalise instruction when non-empty', () => {
    const profile: LearningProfile = { conceptsSeen: ['loop'], strengths: [], struggles: [], lastUpdated: '' };
    assert.match(formatLearningProfileForPrompt(profile), /personalise/i);
  });
});

// ── updateLearningProfile ─────────────────────────────────────────────────────

describe('updateLearningProfile', () => {
  it('adds new concepts', async () => {
    const ctx = makeContext();
    await updateLearningProfile(ctx, { conceptsSeen: ['array', 'loop'] });
    const profile = getLearningProfile(ctx);
    assert.deepEqual(profile.conceptsSeen, ['array', 'loop']);
  });

  it('prevents duplicates (case-insensitive)', async () => {
    const ctx = makeContext();
    await updateLearningProfile(ctx, { conceptsSeen: ['Array'] });
    await updateLearningProfile(ctx, { conceptsSeen: ['array', 'ARRAY'] });
    const profile = getLearningProfile(ctx);
    assert.equal(profile.conceptsSeen.length, 1);
  });

  it('caps conceptsSeen at 20 items', async () => {
    const ctx = makeContext();
    const items = Array.from({ length: 25 }, (_, i) => `concept${i}`);
    await updateLearningProfile(ctx, { conceptsSeen: items });
    const profile = getLearningProfile(ctx);
    assert.equal(profile.conceptsSeen.length, 20);
  });

  it('sets lastUpdated on each call', async () => {
    const ctx = makeContext();
    await updateLearningProfile(ctx, { conceptsSeen: ['loop'] });
    const profile = getLearningProfile(ctx);
    assert.ok(profile.lastUpdated.length > 0);
  });
});

// ── clearLearningProfile ──────────────────────────────────────────────────────

describe('clearLearningProfile', () => {
  it('resets the profile to empty defaults', async () => {
    const ctx = makeContext({ conceptsSeen: ['loop'], strengths: ['loop (understood)'], struggles: [], lastUpdated: '2024-01-01' });
    await clearLearningProfile(ctx);
    const profile = getLearningProfile(ctx);
    assert.deepEqual(profile.conceptsSeen, []);
    assert.deepEqual(profile.strengths, []);
    assert.deepEqual(profile.struggles, []);
  });
});

// ── extractProfileUpdate ──────────────────────────────────────────────────────

describe('extractProfileUpdate', () => {
  it('extracts known concepts from a response', () => {
    const update = extractProfileUpdate('Today we covered arrays and loops in JavaScript.');
    assert.ok(update.conceptsSeen?.includes('array'));
    assert.ok(update.conceptsSeen?.includes('loop'));
  });

  it('returns empty update for a response with no known concepts', () => {
    const update = extractProfileUpdate('Great question! Let me think about that.');
    assert.equal(update.conceptsSeen, undefined);
    assert.equal(update.strengths, undefined);
    assert.equal(update.struggles, undefined);
  });

  it('detects strength signals', () => {
    const update = extractProfileUpdate('You understand how arrays work — good job!');
    assert.ok(update.strengths && update.strengths.length > 0);
  });

  it('detects struggle signals', () => {
    const update = extractProfileUpdate('This is a common mistake with async/await — watch out for it.');
    assert.ok(update.struggles && update.struggles.length > 0);
  });

  it('uses canonical concept names', () => {
    const update = extractProfileUpdate('Arrays are ordered collections.');
    // "arrays" should canonicalise to "array"
    assert.ok(update.conceptsSeen?.includes('array'));
    assert.ok(!update.conceptsSeen?.includes('arrays'));
  });
});
