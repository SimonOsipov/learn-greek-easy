// src/components/situations/SituationExerciseToolbar.tsx
//
// SIT-27-07: toolbar above the situation-detail exercise grid — text search +
// status-filter chips with live counts (All / Mastered / In review / New) +
// a "showing X of Y" count + the EL/EN/RU QuestionLanguageSelector (reused, not
// forked). All filtering is client-side over the cached exercises list.

import React from 'react';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { QuestionLanguageSelector } from '@/components/shared/QuestionLanguageSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tDynamic } from '@/i18n/tDynamic';
import type { CultureLanguage } from '@/types/culture';

import type { ExerciseStatusFilter, StatusFilterCounts } from './exerciseGridHelpers';

export interface SituationExerciseToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeStatus: ExerciseStatusFilter;
  onStatusChange: (status: ExerciseStatusFilter) => void;
  counts: StatusFilterCounts;
  /** Filtered count shown ("showing X of Y"). */
  shown: number;
  /** Total count shown ("showing X of Y"). */
  total: number;
  language: CultureLanguage;
  onLanguageChange: (lang: CultureLanguage) => void;
}

const STATUS_OPTIONS: { value: ExerciseStatusFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'situations.detail.exercises.filterAll' },
  { value: 'mastered', labelKey: 'situations.detail.exercises.filterMastered' },
  { value: 'review', labelKey: 'situations.detail.exercises.filterReview' },
  { value: 'new', labelKey: 'situations.detail.exercises.filterNew' },
];

export const SituationExerciseToolbar: React.FC<SituationExerciseToolbarProps> = ({
  searchValue,
  onSearchChange,
  activeStatus,
  onStatusChange,
  counts,
  shown,
  total,
  language,
  onLanguageChange,
}) => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-4" data-testid="situation-exercise-toolbar">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('situations.detail.exercises.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
          aria-label={t('situations.detail.exercises.searchPlaceholder')}
          data-testid="situation-exercise-search"
        />
        {searchValue.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t('situations.detail.exercises.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status filters + count + language selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('situations.detail.exercises.statusFilterGroup')}
          data-testid="situation-status-filters"
        >
          {STATUS_OPTIONS.map(({ value, labelKey }) => {
            const count = counts[value];
            const isActive = activeStatus === value;
            const isDisabled = count === 0 && value !== 'all';
            return (
              <Button
                key={value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStatusChange(value)}
                disabled={isDisabled}
                aria-pressed={isActive}
              >
                {tDynamic(t, labelKey)} ({count})
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" data-testid="situation-exercise-showing">
            {t('situations.detail.exercises.showing', { shown, total })}
          </p>
          <QuestionLanguageSelector
            value={language}
            onChange={onLanguageChange}
            variant="pill"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
};

SituationExerciseToolbar.displayName = 'SituationExerciseToolbar';
