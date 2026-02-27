import React from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn } from '@/lib/utils';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

function getReadinessColor(percentage: number): string {
  if (percentage >= 85) return 'bg-emerald-500 dark:bg-emerald-400';
  if (percentage >= 60) return 'bg-green-500 dark:bg-green-400';
  if (percentage >= 40) return 'bg-orange-500 dark:bg-orange-400';
  return 'bg-red-500 dark:bg-red-400';
}

export interface CategoryBreakdownProps {
  categories: CategoryReadiness[];
  isLoading: boolean;
}

export function CategoryBreakdown({ categories, isLoading }: CategoryBreakdownProps) {
  const { t } = useTranslation('statistics');
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  const handleRowClick = (cat: CategoryReadiness) => {
    track('culture_category_clicked', {
      category: cat.category,
      readiness_percentage: cat.readiness_percentage,
      questions_mastered: cat.questions_mastered,
      questions_total: cat.questions_total,
    });
    if (cat.deck_ids.length > 0) {
      navigate(`/culture/decks/${cat.deck_ids[0]}`);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        {t('cultureReadiness.categoryBreakdown.title')}
      </p>
      {categories.map((cat) => (
        <button
          key={cat.category}
          type="button"
          onClick={() => handleRowClick(cat)}
          className="flex w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
          data-testid={`category-row-${cat.category}`}
        >
          <span className="w-20 shrink-0 text-sm capitalize">
            {t(`cultureReadiness.categoryBreakdown.categories.${cat.category}`)}
          </span>
          <div
            role="progressbar"
            aria-valuenow={cat.readiness_percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn('h-full rounded-full', getReadinessColor(cat.readiness_percentage))}
              style={{ width: `${cat.readiness_percentage}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">
            {Math.round(cat.readiness_percentage)}%
          </span>
        </button>
      ))}
    </div>
  );
}
