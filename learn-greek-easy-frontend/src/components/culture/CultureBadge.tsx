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
 * dot: Tailwind bg class for the status dot indicator (token-based).
 * modifier: CSS class modifier for `.b-*` badge coloring (e.g. 'b-violet').
 */
interface CategoryColorConfig {
  dot: string;
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
  politics: { dot: 'bg-primary', modifier: 'b-blue' },
  history: { dot: 'bg-warning', modifier: 'b-amber' },
  traditions: { dot: 'bg-practice-purple', modifier: 'b-violet' },
  practical: { dot: 'bg-danger', modifier: 'b-red' },
  culture: { dot: 'bg-practice-purple', modifier: 'b-violet' },
  geography: { dot: 'bg-success', modifier: 'b-green' },
  news: { dot: 'bg-primary', modifier: 'b-blue' },
};

const DEFAULT_COLOR: CategoryColorConfig = {
  dot: 'bg-fg3',
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
