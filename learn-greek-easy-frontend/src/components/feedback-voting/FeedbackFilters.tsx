// src/components/feedback-voting/FeedbackFilters.tsx

import React from 'react';

import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFeedbackStore } from '@/stores/feedbackStore';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSortField,
  type SortOrder,
} from '@/types/feedback';

export const FeedbackFilters: React.FC = () => {
  const { t } = useTranslation('feedback');
  const { filters, setFilters, clearFilters } = useFeedbackStore();

  const hasActiveFilters = filters.category || filters.status;

  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="feedback-filters">
      <Select
        value={filters.category || 'all'}
        onValueChange={(v) =>
          setFilters({ category: v === 'all' ? null : (v as FeedbackCategory) })
        }
      >
        <SelectTrigger className="w-[260px]" data-testid="category-filter">
          <SelectValue placeholder={t('filters.category')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
          {FEEDBACK_CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {t(`categories.${cat.value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => setFilters({ status: v === 'all' ? null : (v as FeedbackStatus) })}
      >
        <SelectTrigger className="w-[200px]" data-testid="status-filter">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
          {FEEDBACK_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {t(`status.${status.value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${filters.sort}-${filters.order}`}
        onValueChange={(v) => {
          // QA Correction: Use `order` not `sort_order`
          const [sort, order] = v.split('-') as [FeedbackSortField, SortOrder];
          setFilters({ sort, order });
        }}
      >
        <SelectTrigger className="w-[200px]" data-testid="sort-filter">
          <SelectValue placeholder={t('filters.sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="votes-desc">{t('filters.mostVotes')}</SelectItem>
          <SelectItem value="votes-asc">{t('filters.leastVotes')}</SelectItem>
          <SelectItem value="created_at-desc">{t('filters.newest')}</SelectItem>
          <SelectItem value="created_at-asc">{t('filters.oldest')}</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters-button">
          <X className="mr-2 h-4 w-4" />
          {t('filters.clear')}
        </Button>
      )}
    </div>
  );
};
