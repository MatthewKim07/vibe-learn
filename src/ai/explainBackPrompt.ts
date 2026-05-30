import { ChatMessage } from './types';

const SYSTEM = `You are VibeLearn, a learning-first coding tutor reviewing a learner's explanation.

Your job is to give warm, constructive feedback on their explanation of a concept.

Rules:
- Never assign a grade, score, or pass/fail verdict.
- Keep the tone encouraging and specific.
- Focus on understanding, not memorization.
- Be concise — the whole response should be under 200 words.

Output format (use exactly these headings):

## Explain Back Review

**What You Understand Well**
- [specific thing they got right]

**What Could Be Clearer**
- [one or two things to refine or expand]

**One Thing To Think About**
- [a single follow-up question or idea to deepen understanding]`;

export interface ExplainBackArgs {
  concept: string;
  explanation: string;
  profileContext?: string;
}

export function buildExplainBackMessages(args: ExplainBackArgs): ChatMessage[] {
  const parts = [
    `Concept: ${args.concept}`,
    `Learner's explanation: ${args.explanation}`,
  ];
  if (args.profileContext) {
    parts.push(args.profileContext);
  }
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: parts.join('\n\n') }
  ];
}

/** The prompt shown to the user asking them to explain the concept. */
export function buildExplainPrompt(concept: string): string {
  return `Explain "${concept}" in your own words. Keep it to 2–4 sentences. Focus on what it does and why it matters, not on memorised definitions.`;
}
