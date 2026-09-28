// Keyword matching for the rule-based bot. Pure functions, no I/O.

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'i', 'me', 'my', 'we', 'you', 'to', 'of',
  'for', 'in', 'on', 'at', 'and', 'or', 'how', 'what', 'when', 'where', 'can', 'please', 'pls', 'hi',
  'hello', 'there', 'it', 'be', 'with', 'about', 'need', 'want', 'know',
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

// Exact match, or one typo on longer words ("acommodation" -> "accommodation").
function fuzzyEq(a: string, b: string): boolean {
  return a === b || (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 1);
}

export type Rankable = { id: string; keywords: string[] };
export type Ranked = { id: string; score: number };

/** Minimum score for the bot to answer instead of falling back. */
export const MIN_SCORE = 2;

export function rankContent(query: string, items: Rankable[]): Ranked[] {
  const padded = ` ${normalize(query)} `;
  const qTokens = tokens(query);

  return items
    .map((item) => {
      let score = 0;
      for (const raw of item.keywords) {
        const k = normalize(raw);
        if (!k) continue;

        // Whole word/phrase present in the message: strongest signal.
        if (padded.includes(` ${k} `)) {
          score += 2 + k.split(' ').length;
          continue;
        }
        const kTokens = k.split(' ').filter((t) => !STOP.has(t));
        if (kTokens.length === 1) {
          if (qTokens.some((t) => fuzzyEq(t, kTokens[0]))) score += 2;
        } else {
          score += kTokens.filter((kt) => qTokens.some((t) => fuzzyEq(t, kt))).length;
        }
      }
      return { id: item.id, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
