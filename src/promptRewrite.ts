interface Pattern {
  match: RegExp;
  rewrite: (subject: string) => string;
}

const PATTERNS: Pattern[] = [
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?(?:build|make|create)\s+(?:me\s+)?(?:an?\s+|the\s+)?(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Guide me through building ${withArticle(s)} step by step. Ask me what structure I would use first, give hints before code, and only show partial code after I try. Name the underlying concepts as we go.`
  },
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?write\s+(?:me\s+)?(?:an?\s+|the\s+)?(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Teach me how to write ${withArticle(s)}. Start by asking what I've already tried or how I'd approach it. Give one hint at a time. Show small code snippets only when I get stuck, and explain why each line is there.`
  },
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?(?:fix|debug|solve)\s+(?:this|my)?\s*(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Help me debug ${withArticle(s)} myself. First ask what I expected vs. what I see. Point me toward the underlying concept (scope, types, async, off-by-one, etc.) and suggest a small experiment to verify the cause before showing any fix.`
  },
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?explain\s+(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Explain ${stripArticles(s)} like a patient tutor. Use plain language and a small analogy. Name the concept, then show one short example. Finish with a question that checks I understood.`
  },
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?(?:optimize|refactor|improve|clean up)\s+(?:this|my)?\s*(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Coach me through improving ${withArticle(s)}. First ask me what I think could be better. Then call out one specific issue at a time — name the concept (complexity, coupling, naming, mutation, etc.) — and let me try the change before showing your version.`
  },
  {
    match: /^\s*(?:please\s+)?(?:can you\s+)?(?:show|give)\s+(?:me\s+)?(?:the\s+)?(?:code\s+for\s+|how\s+to\s+)?(.+?)\s*\.?\s*$/i,
    rewrite: (s) =>
      `Help me figure out how to ${stripVerbPrefix(s)} myself. Start with a question about my approach. Reveal pseudocode before real code. Only show full code if I'm clearly stuck.`
  },
  {
    match: /^\s*how\s+do\s+i\s+(.+?)\s*\??\s*$/i,
    rewrite: (s) =>
      `I want to learn how to ${s}. Don't give me the full answer up front. Ask what I've tried, give me a single hint, name the concept, and let me try before you show code.`
  }
];

export function rewritePrompt(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  for (const p of PATTERNS) {
    const m = trimmed.match(p.match);
    if (m && m[1]) {
      return p.rewrite(m[1].trim());
    }
  }

  return genericRewrite(trimmed);
}

function genericRewrite(input: string): string {
  return `I'm trying to learn while building. Here's what I want to do:\n\n"${input}"\n\nPlease teach me through this rather than handing me the finished answer. Ask me what I've tried first, give one hint at a time, name the underlying concept, and only show full code if I'm clearly stuck.`;
}

function withArticle(s: string): string {
  if (/^(a |an |the |my |this |that )/i.test(s)) return s;
  return `a ${s}`;
}

function stripArticles(s: string): string {
  return s.replace(/^(a |an |the )/i, '');
}

function stripVerbPrefix(s: string): string {
  return s.replace(/^(to\s+)/i, '');
}
