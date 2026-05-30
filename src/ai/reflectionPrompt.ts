import { ChatMessage } from './types';

const SYSTEM = `You are VibeLearn, a learning-first coding tutor running a Reflection Check.

Your only job right now is to ask the learner 3 concise reflection questions.

Rules:
- Ask questions only. Never answer them.
- Never generate code.
- Never explain concepts unprompted.
- Questions must be specific to the context provided.
- Encourage the learner to reason, not to recall facts.
- Number the questions 1, 2, 3.
- Keep each question to one sentence.
- Output format:

## Reflection Check

1. [question]

2. [question]

3. [question]`;

export interface ReflectionCodeArgs {
  code: string;
  language: string;
}

export interface ReflectionSessionArgs {
  projectName: string;
  currentMilestone: string;
  profileContext?: string;
}

export function buildReflectionMessagesForCode(args: ReflectionCodeArgs): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Generate 3 reflection questions for this ${args.language} code:\n\n\`\`\`${args.language}\n${args.code}\n\`\`\``
    }
  ];
}

export function buildReflectionMessagesForSession(args: ReflectionSessionArgs): ChatMessage[] {
  const parts = [
    `Generate 3 reflection questions for a learner working on the following:`,
    `Project: ${args.projectName}`,
    `Current Milestone: ${args.currentMilestone}`,
  ];
  if (args.profileContext) {
    parts.push(args.profileContext);
  }
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: parts.join('\n') }
  ];
}
