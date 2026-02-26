// src/pages/FeedbackPage.tsx

import React, { useEffect, useRef } from 'react';

import { AlertCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { FeedbackList, FeedbackFilters, FeedbackSubmitDialog } from '@/components/feedback-voting';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFeedbackStore } from '@/stores/feedbackStore';

export const FeedbackPage: React.FC = () => {
  const { t } = useTranslation('feedback');
  const location = useLocation();
  const { fetchFeedbackList, feedbackList, error, total } = useFeedbackStore();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false);

  // Track which feedback ID has been highlighted to prevent re-triggering
  const highlightedRef = useRef<string | null>(null);

  // Extract highlight query parameter
  const highlightId = new URLSearchParams(location.search).get('highlight');

  useEffect(() => {
    fetchFeedbackList();
  }, [fetchFeedbackList]);

  // Handle highlighting and scrolling to specific feedback
  useEffect(() => {
    if (highlightId && highlightedRef.current !== highlightId) {
      const element = document.getElementById(`feedback-${highlightId}`);
      if (element) {
        highlightedRef.current = highlightId;
        // Small delay to ensure the element is rendered
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-animation');
          // Remove the animation class after it completes
          setTimeout(() => element.classList.remove('highlight-animation'), 2000);
        }, 100);
      }
    }
  }, [highlightId, feedbackList]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="feedback-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground" data-testid="feedback-page-title">
              {t('page.title')}
            </h1>
            {total > 0 && (
              <Badge variant="secondary" data-testid="feedback-count-badge">
                {t('page.count', { count: total })}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <Button
          variant="hero"
          onClick={() => setIsSubmitDialogOpen(true)}
          data-testid="open-submit-dialog-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('page.submitButton')}
        </Button>
      </div>

      <FeedbackFilters />

      {error && (
        <Alert variant="destructive" data-testid="feedback-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FeedbackList onOpenSubmitDialog={() => setIsSubmitDialogOpen(true)} />

      <FeedbackSubmitDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen} />
    </div>
  );
};
