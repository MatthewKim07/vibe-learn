import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  LearningSession,
  clearCurrentSession,
  createSession,
  extractMilestonesFromRoadmap,
  formatSessionForPrompt,
  getCurrentSession,
  saveSession,
} from './learningSession';

// ── Minimal globalState stub ──────────────────────────────────────────────────

function makeContext(initial?: LearningSession) {
  let stored: LearningSession | undefined = initial;
  return {
    globalState: {
      get<T>(_key: string): T | undefined { return stored as unknown as T; },
      async update(_key: string, value: unknown) { stored = value as LearningSession | undefined; }
    }
  } as unknown as import('vscode').ExtensionContext;
}

// ── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with the correct shape', () => {
    const s = createSession('Weather App', 'Build a weather dashboard', ['Setup', 'Fetch API', 'Display']);
    assert.equal(s.projectName, 'Weather App');
    assert.equal(s.goal, 'Build a weather dashboard');
    assert.equal(s.milestones.length, 3);
    assert.equal(s.activeMilestoneIndex, 0);
    assert.ok(s.id.startsWith('session-'));
    assert.ok(s.createdAt.length > 0);
  });

  it('marks all milestones as not completed', () => {
    const s = createSession('App', 'Goal', ['M1', 'M2']);
    assert.ok(s.milestones.every((m) => !m.completed));
  });
});

// ── saveSession / getCurrentSession / clearCurrentSession ─────────────────────

describe('session persistence', () => {
  it('saves and retrieves a session', async () => {
    const ctx = makeContext();
    const s = createSession('Blog', 'Build a blog', ['Setup', 'Posts']);
    await saveSession(ctx, s);
    const retrieved = getCurrentSession(ctx);
    assert.equal(retrieved?.projectName, 'Blog');
    assert.equal(retrieved?.milestones.length, 2);
  });

  it('returns undefined when no session exists', () => {
    const ctx = makeContext();
    assert.equal(getCurrentSession(ctx), undefined);
  });

  it('clears the session', async () => {
    const ctx = makeContext(createSession('App', 'Goal', ['M1']));
    await clearCurrentSession(ctx);
    assert.equal(getCurrentSession(ctx), undefined);
  });
});

// ── formatSessionForPrompt ────────────────────────────────────────────────────

describe('formatSessionForPrompt', () => {
  it('includes project name and current milestone', () => {
    const s = createSession('Todo App', 'Build a todo list', ['Setup', 'Add items', 'Delete items']);
    const out = formatSessionForPrompt(s);
    assert.match(out, /Todo App/);
    assert.match(out, /Setup/);
  });

  it('lists completed milestones', () => {
    const s = createSession('App', 'Goal', ['M1', 'M2', 'M3']);
    s.milestones[0].completed = true;
    s.activeMilestoneIndex = 1;
    const out = formatSessionForPrompt(s);
    assert.match(out, /M1/);
    assert.match(out, /Completed Milestones/);
  });

  it('shows "All milestones completed" when done', () => {
    const s = createSession('App', 'Goal', ['M1']);
    s.milestones[0].completed = true;
    s.activeMilestoneIndex = 1;
    const out = formatSessionForPrompt(s);
    assert.match(out, /All milestones completed/);
  });

  it('includes the personalisation instruction', () => {
    const s = createSession('App', 'Goal', ['M1']);
    assert.match(formatSessionForPrompt(s), /current project/i);
  });
});

// ── extractMilestonesFromRoadmap ──────────────────────────────────────────────

describe('extractMilestonesFromRoadmap', () => {
  const SAMPLE_ROADMAP = `
# Project Roadmap: Weather App

## Goal
Build a weather dashboard.

## Milestones

### 1. Project Setup
- **What to build:** Create the project folder.

### 2. Fetch Weather Data
- **What to build:** Call the API.

### 3. Display Results
- **What to build:** Render the data.
`;

  it('extracts milestone titles from numbered headings', () => {
    const titles = extractMilestonesFromRoadmap(SAMPLE_ROADMAP);
    assert.equal(titles.length, 3);
    assert.equal(titles[0], 'Project Setup');
    assert.equal(titles[1], 'Fetch Weather Data');
    assert.equal(titles[2], 'Display Results');
  });

  it('returns empty array when no milestones found', () => {
    assert.deepEqual(extractMilestonesFromRoadmap('No milestones here.'), []);
  });
});
