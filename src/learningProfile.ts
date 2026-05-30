import type * as vscode from 'vscode';

const KEY = 'vibelearn.learningProfile';
const CAP = 20;

export interface LearningProfile {
  conceptsSeen: string[];
  strengths: string[];
  struggles: string[];
  lastUpdated: string;
}

export interface ProfileUpdate {
  conceptsSeen?: string[];
  strengths?: string[];
  struggles?: string[];
}

const EMPTY: LearningProfile = {
  conceptsSeen: [],
  strengths: [],
  struggles: [],
  lastUpdated: ''
};

export function getLearningProfile(context: vscode.ExtensionContext): LearningProfile {
  return context.globalState.get<LearningProfile>(KEY) ?? { ...EMPTY };
}

export async function updateLearningProfile(
  context: vscode.ExtensionContext,
  update: ProfileUpdate
): Promise<void> {
  const stored = getLearningProfile(context);
  const profile: LearningProfile = {
    conceptsSeen: [...stored.conceptsSeen],
    strengths: [...stored.strengths],
    struggles: [...stored.struggles],
    lastUpdated: stored.lastUpdated
  };

  function merge(existing: string[], incoming: string[] = []): string[] {
    const set = new Set(existing.map((s) => s.toLowerCase()));
    for (const item of incoming) {
      const norm = item.trim();
      if (norm && !set.has(norm.toLowerCase())) {
        existing.push(norm);
        set.add(norm.toLowerCase());
      }
    }
    return existing.slice(-CAP);
  }

  profile.conceptsSeen = merge(profile.conceptsSeen, update.conceptsSeen);
  profile.strengths = merge(profile.strengths, update.strengths);
  profile.struggles = merge(profile.struggles, update.struggles);
  profile.lastUpdated = new Date().toISOString();

  await context.globalState.update(KEY, profile);
}

export async function clearLearningProfile(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(KEY, undefined);
}

export function formatLearningProfileForPrompt(profile: LearningProfile): string {
  if (
    profile.conceptsSeen.length === 0 &&
    profile.strengths.length === 0 &&
    profile.struggles.length === 0
  ) {
    return '';
  }

  const lines: string[] = ['## Learner Context (from prior sessions)'];
  if (profile.conceptsSeen.length > 0) {
    lines.push(`- **Concepts seen:** ${profile.conceptsSeen.join(', ')}`);
  }
  if (profile.strengths.length > 0) {
    lines.push(`- **Strengths:** ${profile.strengths.join(', ')}`);
  }
  if (profile.struggles.length > 0) {
    lines.push(`- **Struggles:** ${profile.struggles.join(', ')}`);
  }
  lines.push(
    '\nUse this context to personalise your teaching. Do not repeat concepts the learner already understands well unless they ask.'
  );
  return lines.join('\n');
}

// ── Response heuristic ────────────────────────────────────────────────────────

const CONCEPT_PATTERNS: RegExp[] = [
  /\b(array|arrays)\b/i,
  /\b(loop|loops|for loop|while loop)\b/i,
  /\b(function|functions)\b/i,
  /\b(state)\b/i,
  /\b(component|components)\b/i,
  /\b(api|apis)\b/i,
  /\b(async|await)\b/i,
  /\b(promise|promises)\b/i,
  /\b(database|databases)\b/i,
  /\b(sql)\b/i,
  /\b(recursion|recursive)\b/i,
  /\b(authentication|auth)\b/i,
  /\b(closure|closures)\b/i,
  /\b(class|classes)\b/i,
  /\b(object|objects)\b/i,
  /\b(type|types|typescript)\b/i,
  /\b(scope)\b/i,
  /\b(callback|callbacks)\b/i,
  /\b(event|events)\b/i,
  /\b(hook|hooks)\b/i,
];

const CANONICAL: Record<string, string> = {
  arrays: 'array', 'for loop': 'loop', 'while loop': 'loop', loops: 'loop',
  functions: 'function', components: 'component', apis: 'api',
  promises: 'promise', databases: 'database', recursive: 'recursion',
  auth: 'authentication', closures: 'closure', classes: 'class',
  objects: 'object', types: 'type', typescript: 'type', callbacks: 'callback',
  events: 'event', hooks: 'hook',
};

const STRENGTH_PATTERNS = [
  /you (understand|understood)\b/i,
  /good job\b/i,
  /you correctly\b/i,
  /you('ve| have) got(ten)? (it|this)\b/i,
  /well done\b/i,
  /that('s| is) correct\b/i,
  /exactly right\b/i,
];

const STRUGGLE_PATTERNS = [
  /you (seem|are) stuck\b/i,
  /common mistake\b/i,
  /\bconfusing\b/i,
  /watch out\b/i,
  /easy to (mix up|confuse|forget)\b/i,
  /tricky (part|concept|bit)\b/i,
];

export function extractProfileUpdate(response: string): ProfileUpdate {
  const update: ProfileUpdate = {};

  // Concepts
  const concepts: string[] = [];
  for (const re of CONCEPT_PATTERNS) {
    const m = response.match(re);
    if (m) {
      const raw = m[1].toLowerCase();
      concepts.push(CANONICAL[raw] ?? raw);
    }
  }
  if (concepts.length > 0) update.conceptsSeen = concepts;

  // Strengths — extract the concept mentioned near the praise phrase
  const strengthMatches = STRENGTH_PATTERNS.some((re) => re.test(response));
  if (strengthMatches) {
    // Find the first concept mentioned in the response to label the strength
    const firstConcept = update.conceptsSeen?.[0];
    update.strengths = firstConcept ? [`${firstConcept} (understood)`] : ['general understanding'];
  }

  // Struggles
  const struggleMatches = STRUGGLE_PATTERNS.some((re) => re.test(response));
  if (struggleMatches) {
    const firstConcept = update.conceptsSeen?.[0];
    update.struggles = firstConcept ? [`${firstConcept} (needs practice)`] : ['general concept'];
  }

  return update;
}
