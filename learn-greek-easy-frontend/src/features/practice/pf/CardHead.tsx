// src/features/practice/pf/CardHead.tsx
//
// Shared card header for the pf- practice redesign.
// Renders: family badge (.pf-fam), POS chip (.pf-pos) with gender-tinted
// article, and EN/RU language switch (.pf-lang).
//
// When back_content.gender is absent (non-article cards), the article-tint
// slot uses UnwiredDot tone="amber" as a register placeholder.
//
// dx.css must be imported in this module because UnwiredDot uses .dx-unwired-dot
// classes from that stylesheet (self-import not done by the atom).
// Pattern confirmed at src/features/words/components/WordHero.tsx:21.

import { useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx/atoms/UnwiredDot';
import '@/features/decks/dx/dx.css';

import { descriptorForCardType } from './families';

// ── Gender → Greek article map ────────────────────────────────────────────────

const GENDER_ARTICLE: Record<string, string> = {
  masculine: 'ο',
  feminine: 'η',
  neuter: 'το',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardHeadProps {
  /** card_type from StudyQueueCard / CardRecordResponse. */
  cardType: string;
  /** POS label from front_content.badge (e.g. "Noun", "Verb"). Null → no POS chip. */
  posLabel?: string | null;
  /** Gender from back_content.gender (only present on article cards). */
  gender?: string | null;
  /** Russian gender label from back_content.gender_ru. */
  genderRu?: string | null;
  /** Current UI language. Drives lang switch highlight. */
  currentLang: 'en' | 'ru';
  /** Called when user taps EN or RU. */
  onLangChange: (lang: 'en' | 'ru') => void;
}

/**
 * CardHead — renders the top meta row of a practice card:
 *   [FamilyBadge] [POS chip with article] ... [EN | RU switch]
 *
 * Design-system compliance: all colours via CSS token classes / pf.css.
 * No raw hex or inline rgba.
 */
export function CardHead({
  cardType,
  posLabel,
  gender,
  genderRu,
  currentLang,
  onLangChange,
}: CardHeadProps) {
  const { t } = useTranslation('deck');
  const descriptor = descriptorForCardType(cardType);

  // When lang is RU and genderRu is available, show it in the chip; otherwise English gender.
  const activeGender = currentLang === 'ru' && genderRu ? genderRu : gender;

  // Determine the article to show based on gender (only for article derivation, use English gender)
  const article = gender ? (GENDER_ARTICLE[gender.toLowerCase()] ?? null) : null;
  const normalizedGender = gender?.toLowerCase() ?? null;

  // Is this a noun? (POS chip with article applies to nouns)
  const isNoun = posLabel?.toLowerCase() === 'noun';

  return (
    <div className="pf-head" data-testid="pf-card-head">
      {/* Left: family badge + POS chip */}
      <div className="pf-head__left">
        {/* Family badge */}
        <span className="pf-fam" data-testid="pf-fam-badge">
          {descriptor.label}
        </span>

        {/* POS chip — only when posLabel is present */}
        {posLabel && (
          <span className="pf-pos" data-testid="pf-pos-chip">
            {/* Article — gender-tinted when gender present, amber dot when absent */}
            {isNoun && (
              <>
                {article && normalizedGender ? (
                  <span
                    className="pf-pos__article"
                    data-gender={normalizedGender}
                    data-testid="pf-article"
                    lang="el"
                  >
                    {article}
                  </span>
                ) : (
                  <UnwiredDot tone="amber" aria-label="Gender not available for this card type" />
                )}
              </>
            )}
            {posLabel}
            {/* Gender label — shown when gender is present; switches to RU label when available */}
            {activeGender && (
              <span className="pf-pos__gender" data-testid="pf-gender-label">
                {activeGender}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Right: EN/RU language switch */}
      <div
        className="pf-lang"
        role="group"
        aria-label="Language toggle"
        data-testid="pf-lang-switch"
      >
        <button
          type="button"
          className="pf-lang__btn"
          aria-pressed={currentLang === 'en'}
          data-testid="pf-lang-en"
          onClick={(e) => {
            e.stopPropagation();
            onLangChange('en');
          }}
        >
          {t('practice.langEn', 'EN')}
        </button>
        <button
          type="button"
          className="pf-lang__btn"
          aria-pressed={currentLang === 'ru'}
          data-testid="pf-lang-ru"
          onClick={(e) => {
            e.stopPropagation();
            onLangChange('ru');
          }}
        >
          {t('practice.langRu', 'RU')}
        </button>
      </div>
    </div>
  );
}
