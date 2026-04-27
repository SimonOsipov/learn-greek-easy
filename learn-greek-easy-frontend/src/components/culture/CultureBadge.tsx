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

/**
 * Color configuration for a category badge using the v2.4 badge system.
 * dot: Tailwind bg class for the status dot indicator.
 * modifier: CSS class modifier for `.b-*` badge coloring (e.g. 'b-violet').
 */
interface CategoryColorConfig {
  /** Dot color using .b-* modifier convention (CSS var based) */
  dot: string;
  /** Text color class with dark mode variant — kept for getCategoryColor API compat */
  text: string;
  /** Background — kept for getCategoryColor API compat; visual now driven by .b-* */
  bg: string;
  /** Border — kept for getCategoryColor API compat; visual now driven by .b-* */
  border: string;
  /** The .b-* modifier class from the v2.4 badge system */
  modifier: string;
}

/**
 * Category → badge color mapping.
 * Visual palette per design-system v2.4:
 *   culture & traditions → b-violet  (--practice-purple identity)
 *   history              → b-amber
 *   politics & news      → b-blue
 *   geography            → b-green
 *   practical            → b-red
 */
const CATEGORY_COLORS: Record<CultureCategory, CategoryColorConfig> = {
  politics: {
    dot: 'bg-[hsl(var(--primary))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-blue',
  },
  history: {
    dot: 'bg-[hsl(var(--warning))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-amber',
  },
  traditions: {
    dot: 'bg-[hsl(var(--practice-purple))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-violet',
  },
  practical: {
    dot: 'bg-[hsl(var(--danger))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-red',
  },
  culture: {
    dot: 'bg-[hsl(var(--practice-purple))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-violet',
  },
  geography: {
    dot: 'bg-[hsl(var(--success))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-green',
  },
  news: {
    dot: 'bg-[hsl(var(--primary))]',
    text: 'text-white',
    bg: '',
    border: '',
    modifier: 'b-blue',
  },
};

const DEFAULT_COLOR: CategoryColorConfig = {
  dot: 'bg-[hsl(var(--fg-3))]',
  text: 'text-white',
  bg: '',
  border: '',
  modifier: 'b-gray',
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
      className={`badge ${colors.modifier} inline-flex items-center gap-1.5 ${className}`}
      data-testid="culture-badge"
      aria-label={translatedLabel}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
      {showLabel && <span>{translatedLabel}</span>}
    </span>
  );
};
