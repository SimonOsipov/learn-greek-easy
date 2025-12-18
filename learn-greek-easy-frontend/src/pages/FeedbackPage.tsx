// src/pages/FeedbackPage.tsx

import React, { useEffect } from 'react';

import { Plus } from 'lucide-react';

import { FeedbackList, FeedbackFilters, FeedbackSubmitDialog } from '@/components/feedback-voting';
import { Button } from '@/components/ui/button';
import { useFeedbackStore } from '@/stores/feedbackStore';

export const FeedbackPage: React.FC = () => {
  const { fetchFeedbackList, error } = useFeedbackStore();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false);

  useEffect(() => {
    fetchFeedbackList();
  }, [fetchFeedbackList]);

  return (
    <div className="space-y-6" data-testid="feedback-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="feedback-page-title">
            Feedback & Ideas
          </h1>
          <p className="mt-2 text-muted-foreground">
            Share your ideas, report bugs, and vote on suggestions
          </p>
        </div>
        <Button onClick={() => setIsSubmitDialogOpen(true)} data-testid="open-submit-dialog-button">
          <Plus className="mr-2 h-4 w-4" />
          Submit Feedback
        </Button>
      </div>

      <FeedbackFilters />

      {error && (
        <div
          className="bg-destructive/10 text-destructive rounded-md p-4"
          data-testid="feedback-error"
        >
          {error}
        </div>
      )}

      <FeedbackList />

      <FeedbackSubmitDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen} />
    </div>
  );
};
