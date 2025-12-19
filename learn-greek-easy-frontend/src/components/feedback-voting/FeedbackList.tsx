// src/components/feedback-voting/FeedbackList.tsx

import React from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeedbackStore } from '@/stores/feedbackStore';

import { FeedbackCard } from './FeedbackCard';

export const FeedbackList: React.FC = () => {
  const { t } = useTranslation('feedback');
  const { feedbackList, isLoading, page, totalPages, setPage } = useFeedbackStore();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (feedbackList.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground" data-testid="feedback-empty-state">
        {t('list.empty')}
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
          <span className="text-sm text-muted-foreground" data-testid="pagination-info">
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
