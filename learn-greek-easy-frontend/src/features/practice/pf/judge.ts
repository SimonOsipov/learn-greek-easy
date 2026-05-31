// src/features/practice/pf/judge.ts
//
// Client-side forgiving judge for practice type mode.
//
// All functions are pure — no side effects, no imports from React.
// Reuses the shared GREEK_TO_LATIN map from src/utils/greekToLatin.ts
// (do NOT duplicate the map here).

import { GREEK_TO_LATIN } from '@/utils/greekToLatin';

// ── Types ────────────────────────────────────────────────────────────────────

export type Verdict = 'correct' | 'lenient' | 'wrong';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Greek articles stripped in the article-skip leniency leg.
 * Covers definite articles (all cases/genders) plus common contracted forms.
 */
const GREEK_ARTICLES = new Set([
  'ο',
  'η',
  'το',
  'οι',
  'τα',
  'του',
  'της',
  'των',
  'τον',
  'την',
  'στο',
  'στη',
  'στον',
  'στην',
]);

// ── normalize ────────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison:
 *   1. Lowercase
 *   2. NFD → strip combining diacritics U+0300–U+036F
 *      (reduces Greek monotonic accents: ά→α, έ→ε, etc.)
 *   3. Strip punctuation including:
 *      - Greek middle-dot · (U+00B7)
 *      - ASCII semicolon ; (U+003B)
 *      - Greek question-mark/semicolon ⁏ (U+037E)
 *      - Standard punctuation .,!?:
 *   4. Collapse internal whitespace to single space and trim
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[.,!?;:·;]/g, ' ') // strip punctuation → spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

// ── transliterateGreek ───────────────────────────────────────────────────────

/**
 * Transliterate a (already-normalized, diacritic-stripped) Greek string to Latin
 * using the shared GREEK_TO_LATIN map.
 * Non-Greek characters are preserved as-is (so Latin input passes through).
 */
export function transliterateGreek(s: string): string {
  return s
    .split('')
    .map((c) => GREEK_TO_LATIN[c] ?? c)
    .join('');
}

// ── levenshtein ──────────────────────────────────────────────────────────────

/**
 * Iterative Levenshtein distance between two strings.
 * No external library — Simplicity-First (no import needed for this).
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Two-row rolling array
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ── stripLeadingArticle ──────────────────────────────────────────────────────

/**
 * Strip a leading Greek article from a normalized string.
 * Returns the stripped string (or original if no article prefix found).
 */
function stripLeadingArticle(s: string): string {
  const parts = s.split(' ');
  if (parts.length > 1 && GREEK_ARTICLES.has(parts[0]!)) {
    return parts.slice(1).join(' ');
  }
  return s;
}

// ── judgeCandidate ───────────────────────────────────────────────────────────

/**
 * Compare a normalized typed string against a single normalized candidate.
 * Returns 'correct', 'lenient', or 'wrong'.
 */
function judgeCandidate(normTyped: string, normCandidate: string): Verdict {
  // Guard: empty candidate after normalization → skip (avoid false positives)
  if (!normCandidate) return 'wrong';

  // 1. Exact match
  if (normTyped === normCandidate) return 'correct';

  // 2. Lenient — article-skip
  const typedNoArt = stripLeadingArticle(normTyped);
  const candNoArt = stripLeadingArticle(normCandidate);
  if (typedNoArt === candNoArt) return 'lenient';
  if (typedNoArt === normCandidate) return 'lenient';
  if (normTyped === candNoArt) return 'lenient';

  // 3. Lenient — Greeklish transliteration
  //    Transliterate the Greek candidate to Latin and compare against typed.
  const candTranslit = transliterateGreek(normCandidate);
  if (normTyped === candTranslit) return 'lenient';
  // Also try stripping article from transliterated candidate
  const candTranslitNoArt = stripLeadingArticle(candTranslit);
  if (normTyped === candTranslitNoArt) return 'lenient';

  // 4. Lenient — single-char typo (Levenshtein=1), only for strings ≤14 chars
  const longer = normTyped.length >= normCandidate.length ? normTyped : normCandidate;
  if (longer.length <= 14 && levenshtein(normTyped, normCandidate) === 1) return 'lenient';

  return 'wrong';
}

// ── judge ────────────────────────────────────────────────────────────────────

/**
 * Judge the typed input against the answer string.
 *
 * Supports comma-separated alternatives: splits answer on ',', normalizes
 * each candidate, and returns the best (most lenient-favourable) match.
 *
 * @param typed   - Raw string the user typed.
 * @param answer  - Raw answer string (may contain comma-separated alternatives).
 * @returns 'correct' | 'lenient' | 'wrong'
 */
export function judge(typed: string, answer: string): Verdict {
  const normTyped = normalize(typed);

  // Empty input → wrong (no-op guard in the component, but be safe)
  if (!normTyped) return 'wrong';

  const candidates = answer
    .split(',')
    .map(normalize)
    .filter((c) => c.length > 0);

  if (candidates.length === 0) return 'wrong';

  let best: Verdict = 'wrong';
  for (const candidate of candidates) {
    const v = judgeCandidate(normTyped, candidate);
    if (v === 'correct') return 'correct'; // short-circuit on best possible
    if (v === 'lenient') best = 'lenient';
  }
  return best;
}

// ── resolveAnswerText ────────────────────────────────────────────────────────

/**
 * Resolve the answer text to judge against for a given card's back_content.
 *
 * For non-declension cards: back_content.main ?? back_content.answer ?? ''
 * For declension cards: the highlighted cell form (highlight_singular → singular,
 *   highlight_plural → plural) from back_content.declension_table.rows[].
 *
 * This is the canonical answer resolver shared by Answer.tsx and TypedInput.tsx
 * so that the displayed answer == the judged target.
 */
export function resolveAnswerText(
  cardType: string | null | undefined,
  backContent: Record<string, unknown>,
  lang: 'en' | 'ru' = 'en'
): string {
  if (cardType === 'declension') {
    // Find the highlighted row in the declension table
    const table = backContent['declension_table'];
    if (!table || typeof table !== 'object') return '';
    const rows = (table as Record<string, unknown>)['rows'];
    if (!Array.isArray(rows)) return '';
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (r['highlight_singular'] === true && typeof r['singular'] === 'string') {
        return r['singular'] as string;
      }
      if (r['highlight_plural'] === true && typeof r['plural'] === 'string') {
        return r['plural'] as string;
      }
    }
    return '';
  }

  // When lang === 'ru', prefer _ru variant of the answer field when present.
  // Only sentence_translation carries answer_ru; plural_form carries answer_sub_ru.
  // Falls back to English when the _ru field is absent/empty.
  if (lang === 'ru') {
    if (cardType === 'sentence_translation') {
      const ruVal = backContent['answer_ru'];
      if (typeof ruVal === 'string' && ruVal.length > 0) return ruVal;
    }
    if (cardType === 'plural_form') {
      const ruVal = backContent['answer_sub_ru'];
      if (typeof ruVal === 'string' && ruVal.length > 0) return ruVal;
    }
  }

  // Non-declension: main first, then answer fallback
  return (
    (backContent['main'] as string | undefined) ??
    (backContent['answer'] as string | undefined) ??
    ''
  );
}
