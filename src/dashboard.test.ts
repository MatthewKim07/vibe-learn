import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildDashboardMarkdown } from './dashboard';
import { LearningProfile } from './learningProfile';
import { createSession } from './learningSession';

const EMPTY_PROFILE: LearningProfile = { conceptsSeen: [], strengths: [], struggles: [], lastUpdated: '' };

describe('buildDashboardMarkdown', () => {
  it('empty dashboard shows placeholder messages', () => {
    const out = buildDashboardMarkdown({ profile: EMPTY_PROFILE });
    assert.match(out, /Start a learning session/i);
    assert.match(out, /No learning data collected yet/i);
  });

  it('includes teaching mode section always', () => {
    const out = buildDashboardMarkdown({});
    assert.match(out, /Teaching Mode/);
    assert.match(out, /Help Level/);
    assert.match(out, /Socratic Mode/);
    assert.match(out, /Attempt First/);
  });

  it('dashboard with session shows project name and milestone', () => {
    const session = createSession('Weather App', 'Build a weather dashboard', ['Setup', 'Fetch API', 'Display']);
    const out = buildDashboardMarkdown({ session });
    assert.match(out, /Weather App/);
    assert.match(out, /Setup/);
  });

  it('dashboard with session shows progress count', () => {
    const session = createSession('App', 'Goal', ['M1', 'M2', 'M3']);
    session.milestones[0].completed = true;
    session.activeMilestoneIndex = 1;
    const out = buildDashboardMarkdown({ session });
    assert.match(out, /1 \/ 3 completed/);
  });

  it('dashboard with session shows milestone checkmarks', () => {
    const session = createSession('App', 'Goal', ['M1', 'M2']);
    session.milestones[0].completed = true;
    session.activeMilestoneIndex = 1;
    const out = buildDashboardMarkdown({ session });
    assert.match(out, /✓ M1/);
    assert.match(out, /○ M2/);
  });

  it('dashboard with profile shows concepts, strengths, struggles', () => {
    const profile: LearningProfile = {
      conceptsSeen: ['async', 'loop'],
      strengths: ['debugging'],
      struggles: ['recursion'],
      lastUpdated: ''
    };
    const out = buildDashboardMarkdown({ profile });
    assert.match(out, /async/);
    assert.match(out, /debugging/);
    assert.match(out, /recursion/);
  });

  it('dashboard with both session and profile shows all sections', () => {
    const session = createSession('Blog', 'Build a blog', ['Setup', 'Posts']);
    const profile: LearningProfile = { conceptsSeen: ['state'], strengths: [], struggles: [], lastUpdated: '' };
    const out = buildDashboardMarkdown({ session, profile });
    assert.match(out, /Blog/);
    assert.match(out, /state/);
    assert.match(out, /Teaching Mode/);
  });

  it('reflects teaching mode settings', () => {
    const out = buildDashboardMarkdown({ helpLevel: 'strict', socraticMode: true, attemptFirst: false });
    assert.match(out, /strict/);
    assert.match(out, /Socratic Mode:.*enabled/);
    assert.match(out, /Attempt First:.*disabled/);
  });

  it('shows all milestones completed message when done', () => {
    const session = createSession('App', 'Goal', ['M1']);
    session.milestones[0].completed = true;
    session.activeMilestoneIndex = 1;
    const out = buildDashboardMarkdown({ session });
    assert.match(out, /All milestones completed/);
  });
});
