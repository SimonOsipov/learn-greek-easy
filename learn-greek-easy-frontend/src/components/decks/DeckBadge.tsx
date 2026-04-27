import React from 'react';

import { useTranslation } from 'react-i18next';

import { getCEFRBadgeClass } from '@/lib/cefrColors';
import type { DeckCategory, DeckLevel, DeckStatus } from '@/types/deck';

export interface DeckBadgeProps {
  type: 'level' | 'status' | 'category';
  level?: DeckLevel;
  status?: DeckStatus;
  category?: DeckCategory;
  className?: string;
}

// Status → badge slot mapping
const STATUS_CONFIG: Record<DeckStatus, { labelKey: string; badgeSlot: string }> = {
  'not-started': { labelKey: 'card.status.notStarted', badgeSlot: 'b-gray' },
  'in-progress': { labelKey: 'card.status.inProgress', badgeSlot: 'b-blue' },
  completed: { labelKey: 'card.status.completed', badgeSlot: 'b-green' },
} as const;

// Category → badge slot mapping (culture is owned by CultureBadge / RESKIN-01-08)
const CATEGORY_CONFIG: Record<
  Exclude<DeckCategory, 'culture'>,
  { labelKey: string; badgeSlot: string }
> = {
  vocabulary: { labelKey: 'card.categories.vocabulary', badgeSlot: 'b-blue' },
  grammar: { labelKey: 'card.categories.grammar', badgeSlot: 'b-amber' },
  phrases: { labelKey: 'card.categories.phrases', badgeSlot: 'b-green' },
};

export const DeckBadge: React.FC<DeckBadgeProps> = ({
  type,
  level,
  status,
  category,
  className = '',
}) => {
  const { t } = useTranslation('deck');

  if (type === 'level' && level) {
    return (
      <span
        className={`badge ${getCEFRBadgeClass(level)} ${className}`}
        aria-label={`Level ${level}`}
        data-testid="deck-level-badge"
      >
        {level}
      </span>
    );
  }

  if (type === 'status' && status) {
    const config = STATUS_CONFIG[status];
    const statusLabel = t(config.labelKey);
    return (
      <span
        className={`badge ${config.badgeSlot} ${className}`}
        aria-label={`Status: ${statusLabel}`}
      >
        {statusLabel}
      </span>
    );
  }

  if (type === 'category' && category && category !== 'culture') {
    const config = CATEGORY_CONFIG[category];
    const categoryLabel = t(config.labelKey);
    return (
      <span
        className={`badge ${config.badgeSlot} ${className}`}
        aria-label={`Category: ${categoryLabel}`}
        data-testid="deck-category-badge"
      >
        {categoryLabel}
      </span>
    );
  }

  return null;
};
