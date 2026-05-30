import { LearningProfile } from './learningProfile';
import { LearningSession } from './learningSession';

export interface DashboardArgs {
  session?: LearningSession;
  profile?: LearningProfile;
  helpLevel?: string;
  socraticMode?: boolean;
  attemptFirst?: boolean;
}

export function buildDashboardMarkdown(args: DashboardArgs): string {
  const { session, profile, helpLevel = 'guided', socraticMode = false, attemptFirst = true } = args;
  const lines: string[] = ['# VibeLearn Dashboard', ''];

  // ── Current Project ──────────────────────────────────────────────────────
  lines.push('## Current Project', '');
  if (session) {
    const active = session.milestones[session.activeMilestoneIndex];
    const done = session.milestones.filter((m) => m.completed).length;
    lines.push(
      `**Project:** ${session.projectName}`,
      '',
      `**Current Milestone:** ${active ? active.title : '🎉 All milestones completed!'}`,
      '',
      `**Progress:** ${done} / ${session.milestones.length} completed`,
      ''
    );

    // ── Milestones ──────────────────────────────────────────────────────────
    lines.push('## Milestones', '');
    for (const m of session.milestones) {
      lines.push(`${m.completed ? '✓' : '○'} ${m.title}`);
    }
    lines.push('');
  } else {
    lines.push('_Start a learning session to track project progress._', '');
  }

  // ── Learning Profile ──────────────────────────────────────────────────────
  lines.push('## Learning Profile', '');
  const hasProfile = profile && (
    profile.conceptsSeen.length > 0 ||
    profile.strengths.length > 0 ||
    profile.struggles.length > 0
  );

  if (hasProfile && profile) {
    if (profile.conceptsSeen.length > 0) {
      lines.push('**Concepts Seen:**');
      profile.conceptsSeen.forEach((c) => lines.push(`- ${c}`));
      lines.push('');
    }
    if (profile.strengths.length > 0) {
      lines.push('**Strengths:**');
      profile.strengths.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }
    if (profile.struggles.length > 0) {
      lines.push('**Struggles:**');
      profile.struggles.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }
  } else {
    lines.push('_No learning data collected yet._', '');
  }

  // ── Teaching Mode ─────────────────────────────────────────────────────────
  lines.push('## Teaching Mode', '');
  lines.push(
    `**Help Level:** ${helpLevel}`,
    '',
    `**Socratic Mode:** ${socraticMode ? 'enabled' : 'disabled'}`,
    '',
    `**Attempt First:** ${attemptFirst ? 'enabled' : 'disabled'}`
  );

  return lines.join('\n');
}
