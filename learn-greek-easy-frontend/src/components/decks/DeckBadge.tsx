import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { getCEFRBg, getCEFRBorder, getCEFRDot, getCEFRText } from '@/lib/cefrColors';
import type { DeckCategory, DeckLevel, DeckStatus } from '@/types/deck';

export interface DeckBadgeProps {
  type: 'level' | 'status' | 'category';
  level?: DeckLevel;
  status?: DeckStatus;
  category?: DeckCategory;
  className?: string;
}

const STATUS_CONFIG = {
  'not-started': {
    labelKey: 'card.status.notStarted',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
  },
  'in-progress': {
    labelKey: 'card.status.inProgress',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  completed: {
    labelKey: 'card.status.completed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
} as const;

const CATEGORY_CONFIG: Record<
  Exclude<DeckCategory, 'culture'>,
  {
    labelKey: string;
    dot: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  vocabulary: {
    labelKey: 'card.categories.vocabulary',
    dot: 'bg-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  grammar: {
    labelKey: 'card.categories.grammar',
    dot: 'bg-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
  },
  phrases: {
    labelKey: 'card.categories.phrases',
    dot: 'bg-teal-500',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    text: 'text-teal-700 dark:text-teal-300',
  },
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
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${getCEFRBg(level)} ${getCEFRBorder(level)} ${className}`}
        aria-label={`Level ${level}`}
      >
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${getCEFRDot(level)}`}
          aria-hidden="true"
        />
        <span className={getCEFRText(level)}>{level}</span>
      </span>
    );
  }

  if (type === 'status' && status) {
    const config = STATUS_CONFIG[status];
    const statusLabel = t(config.labelKey);
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.textColor} whitespace-nowrap border-0 px-2 py-1 ${className}`}
        aria-label={`Status: ${statusLabel}`}
      >
        {statusLabel}
      </Badge>
    );
  }

  if (type === 'category' && category && category !== 'culture') {
    const config = CATEGORY_CONFIG[category];
    const categoryLabel = t(config.labelKey);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${config.bg} ${config.border} ${className}`}
        aria-label={`Category: ${categoryLabel}`}
        data-testid="deck-category-badge"
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${config.dot}`} aria-hidden="true" />
        <span className={config.text}>{categoryLabel}</span>
      </span>
    );
  }

  return null;
};
