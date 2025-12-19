import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { getCEFRColor, getCEFRLabel, getCEFRTextColor } from '@/lib/cefrColors';
import type { DeckLevel, DeckStatus } from '@/types/deck';

export interface DeckBadgeProps {
  type: 'level' | 'status';
  level?: DeckLevel;
  status?: DeckStatus;
  className?: string;
}

const STATUS_CONFIG = {
  'not-started': {
    labelKey: 'card.status.notStarted',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-700',
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

export const DeckBadge: React.FC<DeckBadgeProps> = ({ type, level, status, className = '' }) => {
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
        className={`${config.bgColor} ${config.textColor} rounded px-2 py-1 text-xs ${className}`}
        aria-label={`Status: ${statusLabel}`}
      >
        {statusLabel}
      </Badge>
    );
  }

  return null;
};
