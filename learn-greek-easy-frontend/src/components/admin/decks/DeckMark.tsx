// src/components/admin/decks/DeckMark.tsx
//
// Presentational atom for the Decks Drawer (ADMIN2-09 / DKDR-02).
// Renders a 3-letter uppercase code derived from a localized deck name
// inside a tinted square. Tone is driven by deck type with an isSystem override.

type DeckMarkProps = {
  name: string;
  type: 'vocabulary' | 'culture';
  isSystem?: boolean;
};

/**
 * Derive a 3-letter uppercase code from a deck name.
 *
 * Rules:
 * - Split on whitespace; filter empty segments.
 * - If >= 3 words: first character of first 3 words, uppercased.
 * - Else: first 3 characters of the first word, uppercased.
 * - Uppercase via toLocaleUpperCase('el-GR') so Greek deck names are
 *   cased correctly (e.g. lowercase sigma → uppercase Sigma).
 */
function deriveCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((w) => w.charAt(0).toLocaleUpperCase('el-GR'))
      .join('');
  }
  return (words[0] ?? '').slice(0, 3).toLocaleUpperCase('el-GR');
}

export function DeckMark({ name, type, isSystem }: DeckMarkProps) {
  const code = deriveCode(name);
  const tone = isSystem ? 'mk-amber' : type === 'culture' ? 'mk-cyan' : 'mk-violet';
  return <div className={`deck-mark ${tone}`}>{code}</div>;
}
