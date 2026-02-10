import React from 'react';

import { BookOpen, Briefcase, Heart, Landmark, Map, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

export type CultureCategory =
  | 'history'
  | 'geography'
  | 'politics'
  | 'culture'
  | 'traditions'
  | 'practical';

export interface CultureBadgeProps {
  category?: CultureCategory;
  showLabel?: boolean;
  className?: string;
}

/** Color configuration for a category badge with opacity-based Tailwind classes */
interface CategoryColorConfig {
  /** Solid dot/indicator color, e.g. "bg-indigo-500" */
  dot: string;
  /** Text color class with dark mode variant */
  text: string;
  /** Background with 10% opacity */
  bg: string;
  /** Border with 20% opacity */
  border: string;
}

const CATEGORY_COLORS: Record<CultureCategory, CategoryColorConfig> = {
  politics: {
    dot: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  history: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  traditions: {
    dot: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  practical: {
    dot: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  culture: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  geography: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
};

const DEFAULT_COLOR: CategoryColorConfig = {
  dot: 'bg-slate-400',
  text: 'text-slate-600 dark:text-slate-300',
  bg: 'bg-slate-500/10',
  border: 'border-slate-500/20',
};

export function getCategoryColor(category?: CultureCategory): CategoryColorConfig {
  if (!category) return DEFAULT_COLOR;
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
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
  practical: {
    icon: Briefcase,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    darkBgColor: 'dark:bg-orange-900',
    darkTextColor: 'dark:text-orange-200',
    labelKey: 'culture.categories.practical',
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
