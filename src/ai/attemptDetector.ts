/**
 * Heuristic: does the user's message contain an attempt?
 * Returns true if the message looks like the user has already tried something.
 */
export function hasAttempt(message: string): boolean {
  // Code block present
  if (/```/.test(message)) return true;

  const lower = message.toLowerCase();

  const patterns = [
    /\bi tried\b/,
    /\bi've tried\b/,
    /\bhere('s| is) my (code|approach|solution|attempt)\b/,
    /\bthis is what i have\b/,
    /\bmy approach (is|was)\b/,
    /\bi think i should\b/,
    /\bi think i need\b/,
    /\bmy code\b/,
    /\bi wrote\b/,
    /\bi started\b/,
    /\bi have (this|the following|a)\b/,
    /\bso far i\b/,
    /\bwhat i have so far\b/,
  ];

  return patterns.some((re) => re.test(lower));
}
