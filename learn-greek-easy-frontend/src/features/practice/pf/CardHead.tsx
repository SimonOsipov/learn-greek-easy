// src/features/practice/pf/CardHead.tsx
//
// Shared card header for the pf- practice redesign.
// Renders: family badge (.pf-fam).

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
    </div>
  );
}
