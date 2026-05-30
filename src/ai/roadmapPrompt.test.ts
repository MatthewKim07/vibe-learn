import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildRoadmapMessages } from './roadmapPrompt';
import { HelpLevel } from './types';

const LEVELS: HelpLevel[] = ['strict', 'guided', 'assist', 'full'];

describe('buildRoadmapMessages', () => {
  it('returns exactly two messages: system then user', () => {
    const msgs = buildRoadmapMessages('a todo app', 'guided');
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[1].role, 'user');
  });

  it('user message contains the idea', () => {
    const msgs = buildRoadmapMessages('weather dashboard', 'guided');
    assert.match(msgs[1].content, /weather dashboard/i);
  });

  it('system prompt forbids full code generation', () => {
    const sys = buildRoadmapMessages('blog', 'guided')[0].content;
    assert.match(sys, /do not generate full code/i);
  });

  it('system prompt requires Try first prompts', () => {
    const sys = buildRoadmapMessages('blog', 'guided')[0].content;
    assert.match(sys, /try first/i);
  });

  it('system prompt includes the required output structure sections', () => {
    const sys = buildRoadmapMessages('blog', 'guided')[0].content;
    assert.match(sys, /## Goal/);
    assert.match(sys, /## Learning Outcomes/);
    assert.match(sys, /## Milestones/);
    assert.match(sys, /## First Step/);
  });

  it('strict and guided levels produce a teaching-focused level note', () => {
    for (const level of ['strict', 'guided'] as HelpLevel[]) {
      const sys = buildRoadmapMessages('app', level)[0].content;
      assert.match(sys, /teaching-focused/i, `${level}: missing teaching-focused note`);
    }
  });

  it('full level produces a more explicit hint note', () => {
    const sys = buildRoadmapMessages('app', 'full')[0].content;
    assert.match(sys, /explicit/i);
  });

  it('works for all help levels without throwing', () => {
    for (const level of LEVELS) {
      assert.doesNotThrow(() => buildRoadmapMessages('a project', level));
    }
  });
});
