import type * as vscode from 'vscode';

const KEY = 'vibelearn.currentSession';

export interface SessionMilestone {
  title: string;
  completed: boolean;
}

export interface LearningSession {
  id: string;
  projectName: string;
  goal: string;
  milestones: SessionMilestone[];
  activeMilestoneIndex: number;
  createdAt: string;
  updatedAt: string;
}

export function getCurrentSession(context: vscode.ExtensionContext): LearningSession | undefined {
  return context.globalState.get<LearningSession>(KEY);
}

export async function saveSession(
  context: vscode.ExtensionContext,
  session: LearningSession
): Promise<void> {
  await context.globalState.update(KEY, session);
}

export async function clearCurrentSession(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(KEY, undefined);
}

export function formatSessionForPrompt(session: LearningSession): string {
  const active = session.milestones[session.activeMilestoneIndex];
  const completed = session.milestones.filter((m) => m.completed);

  const lines = [
    '## Current Learning Session',
    `Project: ${session.projectName}`,
    `Current Milestone: ${active ? active.title : 'All milestones completed'}`,
  ];

  if (completed.length > 0) {
    lines.push(`Completed Milestones: ${completed.map((m) => m.title).join(', ')}`);
  }

  lines.push(
    '',
    '## Teaching Guidance',
    'Use the current milestone as the primary focus.',
    'Prefer helping the learner make progress on the current milestone before introducing future concepts.',
    'Do not overwhelm the learner with information from later milestones unless explicitly requested.',
    'Connect explanations to the current project whenever possible.'
  );

  return lines.join('\n');
}

/**
 * Extract milestone titles from a roadmap response.
 * Looks for "### N. Title" or "## Milestones" list items.
 */
export function extractMilestonesFromRoadmap(roadmap: string): string[] {
  const titles: string[] = [];

  // Match "### 1. Milestone Title" pattern
  const numbered = roadmap.matchAll(/^###\s+\d+\.\s+(.+)$/gm);
  for (const m of numbered) {
    titles.push(m[1].trim());
  }

  return titles;
}

export function createSession(projectName: string, goal: string, milestones: string[]): LearningSession {
  const now = new Date().toISOString();
  return {
    id: `session-${Date.now()}`,
    projectName,
    goal,
    milestones: milestones.map((title) => ({ title, completed: false })),
    activeMilestoneIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}
