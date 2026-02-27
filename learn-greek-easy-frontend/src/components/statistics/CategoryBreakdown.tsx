import React, { useEffect, useRef } from 'react';

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn } from '@/lib/utils';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

function getReadinessColor(percentage: number): string {
  if (percentage >= 85) return 'bg-emerald-500 dark:bg-emerald-400';
  if (percentage >= 60) return 'bg-green-500 dark:bg-green-400';
  if (percentage >= 40) return 'bg-orange-500 dark:bg-orange-400';
  return 'bg-red-500 dark:bg-red-400';
}

function getAccuracyColor(accuracy: number | null): string {
  if (accuracy === null) return 'text-muted-foreground';
  if (accuracy >= 70) return 'text-green-600 dark:text-green-400';
  if (accuracy >= 50) return 'text-orange-500 dark:text-orange-400';
  return 'text-red-500 dark:text-red-400';
}

export interface CategoryBreakdownProps {
  categories: CategoryReadiness[];
  isLoading: boolean;
}

export function CategoryBreakdown({ categories, isLoading }: CategoryBreakdownProps) {
  const { t } = useTranslation('statistics');
  const navigate = useNavigate();
  const { track } = useTrackEvent();
  const hasFiredAccuracy = useRef(false);
  const seenReinforcement = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasFiredAccuracy.current && categories.some((c) => c.accuracy_percentage !== null)) {
      hasFiredAccuracy.current = true;
      track('culture_accuracy_viewed', {
        categories_with_accuracy: categories.filter((c) => c.accuracy_percentage !== null).length,
      });
    }
    categories
      .filter((c) => c.needs_reinforcement)
      .forEach((c) => {
        if (!seenReinforcement.current.has(c.category)) {
          seenReinforcement.current.add(c.category);
          track('culture_reinforcement_badge_seen', { category: c.category });
        }
      });
  }, [categories, track]);

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
          <div className="flex w-16 shrink-0 flex-col items-end">
            <span className="text-right text-sm text-muted-foreground">
              {Math.round(cat.readiness_percentage)}%
            </span>
            {/* Accuracy label */}
            <p className={cn('text-xs', getAccuracyColor(cat.accuracy_percentage))}>
              {cat.accuracy_percentage !== null
                ? t('cultureReadiness.categoryBreakdown.accuracy', {
                    value: cat.accuracy_percentage,
                  })
                : t('cultureReadiness.categoryBreakdown.accuracyNA')}
            </p>
            {/* Needs reinforcement badge */}
            {cat.needs_reinforcement && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                      aria-label={t('cultureReadiness.categoryBreakdown.needsReinforcementTooltip')}
                    >
                      <AlertTriangle size={10} />
                      {t('cultureReadiness.categoryBreakdown.needsReinforcement')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('cultureReadiness.categoryBreakdown.needsReinforcementTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
