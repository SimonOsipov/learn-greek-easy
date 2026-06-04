// src/features/practice/pf/CardHead.tsx
//
// Shared card header for the pf- practice redesign.
// Renders: family badge (.pf-fam) and EN/RU language switch (.pf-lang).

import { useTranslation } from 'react-i18next';

import { descriptorForCardType } from './families';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardHeadProps {
  /** card_type from StudyQueueCard / CardRecordResponse. */
  cardType: string;
  /** Current UI language. Drives lang switch highlight. */
  currentLang: 'en' | 'ru';
  /** Called when user taps EN or RU. */
  onLangChange: (lang: 'en' | 'ru') => void;
}

/**
 * CardHead — renders the top meta row of a practice card:
 *   [FamilyBadge] ... [EN | RU switch]
 *
 * Design-system compliance: all colours via CSS token classes / pf.css.
 * No raw hex or inline rgba.
 */
export function CardHead({ cardType, currentLang, onLangChange }: CardHeadProps) {
  const { t } = useTranslation('deck');
  const descriptor = descriptorForCardType(cardType);

  return (
    <div className="pf-head" data-testid="pf-card-head">
      {/* Left: family badge */}
      <div className="pf-head__left">
        {/* Family badge */}
        <span className="pf-fam" data-testid="pf-fam-badge">
          {descriptor.label}
        </span>
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
