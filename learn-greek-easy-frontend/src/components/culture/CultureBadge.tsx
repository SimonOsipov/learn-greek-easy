import type { FC } from 'react';

import { useTranslation } from 'react-i18next';

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

export const CultureBadge: FC<CultureBadgeProps> = ({
  category,
  showLabel = true,
  className = '',
}) => {
  const { t } = useTranslation('deck');
  const colors = getCategoryColor(category);
  const labelKey = category ? `culture.categories.${category}` : 'culture.badge';
  const translatedLabel = t(labelKey);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${colors.bg} ${colors.border} ${className}`}
      data-testid="culture-badge"
      aria-label={translatedLabel}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
      {showLabel && <span className={colors.text}>{translatedLabel}</span>}
    </span>
  );
};
