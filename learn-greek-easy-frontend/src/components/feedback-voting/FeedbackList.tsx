// src/components/feedback-voting/FeedbackList.tsx

import React from 'react';

import { ChevronLeft, ChevronRight, MessageSquarePlus, Plus, SearchX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeedbackStore } from '@/stores/feedbackStore';

import { FeedbackCard } from './FeedbackCard';

interface FeedbackListProps {
  onOpenSubmitDialog?: () => void;
}

export const FeedbackList: React.FC<FeedbackListProps> = ({ onOpenSubmitDialog }) => {
  const { t } = useTranslation('feedback');
  const { feedbackList, isLoading, page, totalPages, setPage, filters, clearFilters } =
    useFeedbackStore();
  const hasActiveFilters = !!(filters.category || filters.status);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (feedbackList.length === 0 && hasActiveFilters) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-testid="feedback-no-results"
      >
        <SearchX className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="mb-4 text-muted-foreground">{t('list.noResults.message')}</p>
        <Button
          variant="outline"
          onClick={clearFilters}
          data-testid="no-results-clear-filters-button"
        >
          <X className="mr-2 h-4 w-4" />
          {t('list.noResults.clearFilters')}
        </Button>
      </div>
    );
  }

  if (feedbackList.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-testid="feedback-empty-state"
      >
        <MessageSquarePlus className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="mb-4 text-muted-foreground">{t('list.emptyState.message')}</p>
        {onOpenSubmitDialog && (
          <Button
            variant="hero"
            onClick={onOpenSubmitDialog}
            data-testid="empty-state-submit-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('list.emptyState.cta')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="feedback-list">
      {feedbackList.map((feedback) => (
        <FeedbackCard key={feedback.id} feedback={feedback} />
      ))}

      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 pt-4"
          data-testid="feedback-pagination"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            data-testid="pagination-prev"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('pagination.previous')}
          </Button>
          <span
            className="text-sm text-muted-foreground"
            data-testid="pagination-info"
            aria-live="polite"
            role="status"
          >
            {t('pagination.pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            data-testid="pagination-next"
          >
            {t('pagination.next')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
