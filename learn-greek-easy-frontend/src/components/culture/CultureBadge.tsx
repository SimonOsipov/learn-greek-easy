import type { FC } from 'react';

import { useTranslation } from 'react-i18next';

export type CultureCategory =
  | 'history'
  | 'geography'
  | 'politics'
  | 'culture'
  | 'traditions'
  | 'practical'
  | 'news';

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
    text: 'text-white',
    bg: 'bg-indigo-600',
    border: 'border-indigo-700',
  },
  history: {
    dot: 'bg-amber-500',
    text: 'text-white',
    bg: 'bg-amber-600',
    border: 'border-amber-700',
  },
  traditions: {
    dot: 'bg-purple-500',
    text: 'text-white',
    bg: 'bg-purple-600',
    border: 'border-purple-700',
  },
  practical: {
    dot: 'bg-rose-500',
    text: 'text-white',
    bg: 'bg-rose-600',
    border: 'border-rose-700',
  },
  culture: {
    dot: 'bg-emerald-500',
    text: 'text-white',
    bg: 'bg-emerald-600',
    border: 'border-emerald-700',
  },
  geography: {
    dot: 'bg-teal-500',
    text: 'text-white',
    bg: 'bg-teal-600',
    border: 'border-teal-700',
  },
  news: {
    dot: 'bg-sky-500',
    text: 'text-white',
    bg: 'bg-sky-600',
    border: 'border-sky-700',
  },
};

const DEFAULT_COLOR: CategoryColorConfig = {
  dot: 'bg-slate-400',
  text: 'text-white',
  bg: 'bg-slate-500',
  border: 'border-slate-600',
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
