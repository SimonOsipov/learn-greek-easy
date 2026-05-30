// src/features/practice/pf/questions/Grammar.tsx
//
// Question renderers for Grammar/Declension family card types:
//   - article: fill-in where article is blanked (word_with_article stored in
//     front_content.main; derive blank by replacing leading article with "???")
//   - plural_form / singular: given-form stem + IPA + audio chip
//
// Field bindings (verified against card_generator_service.py:99-119,
// PracticeCard.tsx:385-389):
//   front_content.main  → word_with_article (article cards) or stem
//   front_content.sub   → IPA (optional)
//   back_content.answer → correct answer (article fill or plural/singular form)
//   back_content.gender → gender string (article cards only)
//
// Article blank derivation:
//   The generator stores the FULL word with article in front_content.main
//   (e.g. "ο άντρας"). The renderer splits off the leading token (article)
//   and replaces it with the blank placeholder "???".
//   Split heuristic: first whitespace-separated token ≤ 4 chars = article.
//   Fallback: if no short leading token, show the whole word without a blank.

import { AudioChip } from '../AudioChip';

import type { AudioChipState } from '../AudioChip';

// ── Article blank derivation ──────────────────────────────────────────────────

const GREEK_ARTICLES = new Set(['ο', 'η', 'το', 'Ο', 'Η', 'Το']);

/**
 * Given a word_with_article string (e.g. "ο άντρας"),
 * returns { stem: "άντρας", hasArticle: true }.
 * Falls back to { stem: wordWithArticle, hasArticle: false } when no
 * recognisable article prefix is found.
 */
function deriveArticleStem(wordWithArticle: string): { stem: string; hasArticle: boolean } {
  const parts = wordWithArticle.trim().split(/\s+/);
  if (parts.length >= 2 && GREEK_ARTICLES.has(parts[0])) {
    return { stem: parts.slice(1).join(' '), hasArticle: true };
  }
  // Fallback: first short token as possible article
  if (parts.length >= 2 && parts[0].length <= 4) {
    return { stem: parts.slice(1).join(' '), hasArticle: true };
  }
  return { stem: wordWithArticle, hasArticle: false };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GrammarArticleProps {
  /**
   * word_with_article from front_content.main (e.g. "ο άντρας").
   * Renderer blanks the leading article → "??? άντρας".
   */
  wordWithArticle: string;
  /** Prompt text from front_content.prompt (e.g. "What article?") */
  prompt?: string | null;
}

export interface GrammarPluralProps {
  /** Given form (singular or plural stem) from front_content.main */
  stem: string;
  /** IPA from front_content.sub — shown only when present */
  ipa?: string | null;
  /** Lifted audio state */
  audioState?: AudioChipState | null;
  /** Prompt text from front_content.prompt */
  prompt?: string | null;
}

// ── article renderer ──────────────────────────────────────────────────────────

/**
 * GrammarArticle — question view for article card type.
 *
 * Shows the stem with an article blank ("???") in place of the leading article.
 * The blank is rendered via .pf-grammar-blank (amber/warning tinted).
 */
export function GrammarArticle({ wordWithArticle, prompt }: GrammarArticleProps) {
  const { stem, hasArticle } = deriveArticleStem(wordWithArticle);

  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-grammar-article">
      {prompt && <p className="text-center text-sm text-fg2">{prompt}</p>}
      <p className="pf-grammar-stem" lang="el">
        {hasArticle && (
          <span
            className="pf-grammar-blank"
            data-testid="pf-article-blank"
            aria-label="article blank"
          >
            ???
          </span>
        )}
        {stem}
      </p>
    </div>
  );
}

// ── plural_form / singular renderer ──────────────────────────────────────────

/**
 * GrammarPlural — question view for plural_form and singular card types.
 *
 * Shows the given-form stem (Noto Serif, lang="el") + optional IPA + audio chip.
 */
export function GrammarPlural({ stem, ipa, audioState, prompt }: GrammarPluralProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-grammar-plural">
      {prompt && <p className="text-center text-sm text-fg2">{prompt}</p>}
      <p className="pf-grammar-stem" lang="el">
        {stem}
      </p>

      {/* IPA — only when present */}
      {ipa && (
        <p className="pf-ipa" data-testid="pf-ipa">
          {ipa}
        </p>
      )}

      {/* Audio chip */}
      {audioState && <AudioChip audioState={audioState} />}
    </div>
  );
}
