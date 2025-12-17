import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { DeckLevel, DeckStatus } from '@/types/deck';

export interface DeckBadgeProps {
  type: 'level' | 'status';
  level?: DeckLevel;
  status?: DeckStatus;
  className?: string;
}

const LEVEL_CONFIG = {
  A1: {
    label: 'A1 - Beginner',
    bgColor: 'bg-green-700',
    textColor: 'text-white',
  },
  A2: {
    label: 'A2 - Elementary',
    bgColor: 'bg-blue-700',
    textColor: 'text-white',
  },
  B1: {
    label: 'B1 - Intermediate',
    bgColor: 'bg-orange-700',
    textColor: 'text-white',
  },
  B2: {
    label: 'B2 - Upper-Intermediate',
    bgColor: 'bg-purple-700',
    textColor: 'text-white',
  },
  C1: {
    label: 'C1 - Advanced',
    bgColor: 'bg-red-700',
    textColor: 'text-white',
  },
  C2: {
    label: 'C2 - Mastery',
    bgColor: 'bg-gray-800',
    textColor: 'text-white',
  },
} as const;

const STATUS_CONFIG = {
  'not-started': {
    label: 'Not Started',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-700',
  },
  'in-progress': {
    label: 'In Progress',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
} as const;

export const DeckBadge: React.FC<DeckBadgeProps> = ({ type, level, status, className = '' }) => {
  if (type === 'level' && level) {
    const config = LEVEL_CONFIG[level];
    return (
      <Badge
        className={`${config.bgColor} ${config.textColor} rounded px-2 py-1 text-xs font-semibold ${className}`}
        aria-label={`Level ${config.label}`}
      >
        {level}
      </Badge>
    );
  }

  if (type === 'status' && status) {
    const config = STATUS_CONFIG[status];
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.textColor} rounded px-2 py-1 text-xs ${className}`}
        aria-label={`Status: ${config.label}`}
      >
        {config.label}
      </Badge>
    );
  }

  return null;
};
