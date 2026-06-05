// src/features/practice/pf/CardHead.tsx
//
// Shared card header for the pf- practice redesign.
// Renders: family badge (.pf-fam).

import { useTranslation } from 'react-i18next';

import { descriptorForCardType } from './families';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardHeadProps {
  /** card_type from StudyQueueCard / CardRecordResponse. */
  cardType: string;
}

/**
 * CardHead — renders the top meta row of a practice card:
 *   [FamilyBadge]
 *
 * Design-system compliance: all colours via CSS token classes / pf.css.
 * No raw hex or inline rgba.
 */
export function CardHead({ cardType }: CardHeadProps) {
  const { t } = useTranslation('deck');
  const descriptor = descriptorForCardType(cardType);

  return (
    <div className="pf-head" data-testid="pf-card-head">
      {/* Left: family badge */}
      <div className="pf-head__left">
        {/* Family badge — translated label, English descriptor.label as fallback */}
        <span className="pf-fam" data-testid="pf-fam-badge">
          {t(`practice.cardFamily.${descriptor.family}`, { defaultValue: descriptor.label })}
        </span>
      </div>
    </div>
  );
}
