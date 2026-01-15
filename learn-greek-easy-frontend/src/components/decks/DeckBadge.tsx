import React from 'react';

import { BookText, Languages, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { getCEFRColor, getCEFRLabel, getCEFRTextColor } from '@/lib/cefrColors';
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
    icon: React.ComponentType<{ className?: string }>;
    labelKey: string;
    bgColor: string;
    textColor: string;
    darkBgColor: string;
    darkTextColor: string;
  }
> = {
  vocabulary: {
    icon: BookText,
    labelKey: 'card.categories.vocabulary',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-800',
    darkBgColor: 'dark:bg-cyan-900',
    darkTextColor: 'dark:text-cyan-200',
  },
  grammar: {
    icon: Languages,
    labelKey: 'card.categories.grammar',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    darkBgColor: 'dark:bg-orange-900',
    darkTextColor: 'dark:text-orange-200',
  },
  phrases: {
    icon: MessageSquare,
    labelKey: 'card.categories.phrases',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-800',
    darkBgColor: 'dark:bg-teal-900',
    darkTextColor: 'dark:text-teal-200',
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
    const bgColor = getCEFRColor(level);
    const textColor = getCEFRTextColor(level);
    const label = getCEFRLabel(level);
    return (
      <Badge
        className={`${bgColor} ${textColor} rounded px-2 py-1 text-xs font-semibold ${className}`}
        aria-label={`Level ${label}`}
      >
        {level}
      </Badge>
    );
  }

  if (type === 'status' && status) {
    const config = STATUS_CONFIG[status];
    const statusLabel = t(config.labelKey);
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.textColor} whitespace-nowrap rounded px-2 py-1 text-xs ${className}`}
        aria-label={`Status: ${statusLabel}`}
      >
        {statusLabel}
      </Badge>
    );
  }

  if (type === 'category' && category && category !== 'culture') {
    const config = CATEGORY_CONFIG[category];
    const categoryLabel = t(config.labelKey);
    const Icon = config.icon;
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.textColor} ${config.darkBgColor} ${config.darkTextColor} ${className}`}
        aria-label={`Category: ${categoryLabel}`}
        data-testid="deck-category-badge"
      >
        <Icon className="mr-1 h-3 w-3" />
        {categoryLabel}
      </Badge>
    );
  }

  return null;
};
