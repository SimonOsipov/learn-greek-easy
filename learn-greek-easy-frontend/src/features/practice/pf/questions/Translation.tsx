// src/features/practice/pf/questions/Translation.tsx
//
// Question renderers for Translation family card types:
//   - meaning_el_to_en: huge Greek word (Noto Serif, lang="el", never italic)
//     + muted article + IPA (from front_content.sub) + audio chip
//   - meaning_en_to_el: Inter Tight 700 English prompt
//
// Field bindings (verified against PracticeCard.tsx:385-386 + live types):
//   front_content.main   → main Greek word OR English prompt
//   front_content.sub    → IPA (optional)
//   front_content.badge  → POS label
//   front_content.prompt → English prompt text
// For el_to_en, article is derived from back_content.gender via a map
// (only present on article cards; Translation el_to_en cards carry no article).

import { useTranslation } from 'react-i18next';

import { AudioChip } from '../AudioChip';

import type { AudioChipState } from '../AudioChip';

// ── Greek article map (for future: if article field lands on meaning cards) ──

const GENDER_ARTICLE: Record<string, string> = {
  masculine: 'ο',
  feminine: 'η',
  neuter: 'το',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TranslationElToEnProps {
  /** Greek word from front_content.main */
  word: string;
  /** IPA from front_content.sub — shown only when present */
  ipa?: string | null;
  /** Optional article derived from back_content.gender (not present on most meaning cards) */
  gender?: string | null;
  /** Lifted audio state */
  audioState?: AudioChipState | null;
  /** Current card language. No-op for Translation cards (no RU front data exists yet). */
  lang?: 'en' | 'ru';
  /** Direction subtitle from front_content.prompt (PRACT2-3-01). */
  prompt?: string | null;
}

export interface TranslationEnToElProps {
  /** English display word from front_content.main (PRACT2-3-01: renamed from prompt). */
  word: string;
  /** Direction subtitle from front_content.prompt (PRACT2-3-01). */
  prompt?: string | null;
  /** Current card language. No-op for Translation cards (no RU front data exists yet). */
  lang?: 'en' | 'ru';
}

// ── meaning_el_to_en renderer ─────────────────────────────────────────────────

/**
 * TranslationElToEn — question view for meaning_el_to_en cards.
 *
 * Greek text: Noto Serif, lang="el", never italic.
 * Article (if gender present): muted prefix via pf-translation-article.
 * IPA: shown only when front_content.sub exists.
 */
export function TranslationElToEn({
  word,
  ipa,
  gender,
  audioState,
  lang: _lang,
  prompt,
}: TranslationElToEnProps) {
  const { t } = useTranslation('deck');
  const article = gender ? (GENDER_ARTICLE[gender.toLowerCase()] ?? null) : null;

  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-translation-el-en">
      {/* Direction subtitle — "Greek → English · {prompt}" (RU: "Греческий → Русский") */}
      <p className="pf-prompt" data-testid="pf-direction-subtitle">
        {t('practice.directionElToNative')}
        {prompt ? ` · ${prompt}` : ''}
      </p>

      {/* Greek word with optional muted article prefix */}
      <p className="pf-translation-word" lang="el">
        {article && (
          <span className="pf-translation-article" lang="el" aria-hidden="true">
            {article}
          </span>
        )}
        {word}
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

// ── meaning_en_to_el renderer ─────────────────────────────────────────────────

/**
 * TranslationEnToEl — question view for meaning_en_to_el cards.
 *
 * Renders the English display word in Inter Tight 700 (not Greek Noto Serif).
 * PRACT2-3-01: `word` prop carries the display word (previously named `prompt`);
 *   `prompt` now carries the direction subtitle.
 */
export function TranslationEnToEl({ word, prompt, lang: _lang }: TranslationEnToElProps) {
  const { t } = useTranslation('deck');
  return (
    <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-translation-en-el">
      {/* Direction subtitle — "English → Greek · {prompt}" (RU: "Русский → Греческий") */}
      <p className="pf-prompt" data-testid="pf-direction-subtitle">
        {t('practice.directionNativeToEl')}
        {prompt ? ` · ${prompt}` : ''}
      </p>

      {/* English display word — Inter Tight 700 */}
      <p className="pf-en-prompt">{word}</p>
    </div>
  );
}
