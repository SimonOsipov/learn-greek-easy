import React from 'react';

import { BookOpen, Heart, Landmark, Map, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

export type CultureCategory = 'history' | 'geography' | 'politics' | 'culture' | 'traditions';

export interface CultureBadgeProps {
  category?: CultureCategory;
  showLabel?: boolean;
  className?: string;
}

const CATEGORY_CONFIG: Record<
  CultureCategory,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
    darkBgColor: string;
    darkTextColor: string;
    labelKey: string;
  }
> = {
  history: {
    icon: BookOpen,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    darkBgColor: 'dark:bg-amber-900',
    darkTextColor: 'dark:text-amber-200',
    labelKey: 'culture.categories.history',
  },
  geography: {
    icon: Map,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    darkBgColor: 'dark:bg-emerald-900',
    darkTextColor: 'dark:text-emerald-200',
    labelKey: 'culture.categories.geography',
  },
  politics: {
    icon: Landmark,
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
    darkBgColor: 'dark:bg-indigo-900',
    darkTextColor: 'dark:text-indigo-200',
    labelKey: 'culture.categories.politics',
  },
  culture: {
    icon: Heart,
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-800',
    darkBgColor: 'dark:bg-rose-900',
    darkTextColor: 'dark:text-rose-200',
    labelKey: 'culture.categories.culture',
  },
  traditions: {
    icon: Sparkles,
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    darkBgColor: 'dark:bg-purple-900',
    darkTextColor: 'dark:text-purple-200',
    labelKey: 'culture.categories.traditions',
  },
};

export const CultureBadge: React.FC<CultureBadgeProps> = ({
  category,
  showLabel = true,
  className = '',
}) => {
  const { t } = useTranslation('deck');

  // Generic culture badge when no category specified
  if (!category) {
    return (
      <Badge
        variant="outline"
        className={`bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ${className}`}
        data-testid="culture-badge"
        aria-label={t('culture.badge')}
      >
        <BookOpen className="mr-1 h-3 w-3" />
        {showLabel && t('culture.badge')}
      </Badge>
    );
  }

  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.bgColor} ${config.textColor} ${config.darkBgColor} ${config.darkTextColor} ${className}`}
      data-testid="culture-badge"
      aria-label={t(config.labelKey)}
    >
      <Icon className="mr-1 h-3 w-3" />
      {showLabel && t(config.labelKey)}
    </Badge>
  );
};
