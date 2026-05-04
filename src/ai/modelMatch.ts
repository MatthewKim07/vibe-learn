export interface ResolveResult {
  match?: string;
  suggestions: string[];
}

export function resolveModel(input: string, available: string[]): ResolveResult {
  if (available.length === 0) return { suggestions: [] };

  const want = normalize(input);
  const wantBase = baseName(want);

  for (const m of available) {
    if (normalize(m) === want) return { match: m, suggestions: [] };
  }

  const baseMatches = available.filter((m) => baseName(normalize(m)) === wantBase);
  if (baseMatches.length === 1) return { match: baseMatches[0], suggestions: [] };
  if (baseMatches.length > 1) {
    const latest = baseMatches.find((m) => /:latest$/.test(m));
    return { match: latest ?? baseMatches[0], suggestions: [] };
  }

  const contains = available.filter(
    (m) => normalize(m).includes(want) || want.includes(baseName(normalize(m)))
  );
  if (contains.length === 1) return { match: contains[0], suggestions: [] };

  const ranked = available
    .map((m) => ({ m, d: levenshtein(baseName(normalize(m)), wantBase) }))
    .sort((a, b) => a.d - b.d);

  if (ranked[0] && ranked[0].d <= Math.max(2, Math.floor(wantBase.length / 4))) {
    return { match: ranked[0].m, suggestions: [] };
  }

  return { suggestions: ranked.slice(0, 3).map((r) => r.m) };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

function baseName(normalized: string): string {
  const idx = normalized.indexOf(':');
  return idx === -1 ? normalized : normalized.slice(0, idx);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}
