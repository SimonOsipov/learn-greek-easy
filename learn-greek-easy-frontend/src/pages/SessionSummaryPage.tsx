import { useEffect, useRef } from 'react';

import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { SessionSummary } from '@/components/review/SessionSummary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import log from '@/lib/logger';
import { useReviewStore } from '@/stores/reviewStore';

/**
 * SessionSummaryPage Component
 *
 * Container page for displaying session summary after review completion.
 *
 * Route: /decks/:deckId/summary
 *
 * Features:
 * - Auto-redirect if no session summary available
 * - Loading skeleton while redirect processing
 * - Cleanup summary on unmount
 * - Error handling for missing deckId
 * - Integration with reviewStore
 * - Full-screen gray background
 * - Responsive container
 *
 * State Management:
 * - Reads reviewStore.sessionSummary
 * - Calls reviewStore.clearSessionSummary() on unmount
 * - No local state (all data from store)
 *
 * Navigation:
 * - Back to Deck: /decks/:deckId
 * - Review Again: /decks/:deckId/review
 * - Dashboard: /dashboard
 */
export function SessionSummaryPage() {
  const { t } = useTranslation('review');
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { sessionSummary, clearSessionSummary } = useReviewStore();
  const { track } = useTrackEvent();

  // Ref to prevent duplicate event tracking
  const hasTrackedComplete = useRef(false);

  // Redirect if no summary available
  useEffect(() => {
    if (!sessionSummary) {
      log.warn('No session summary available, redirecting to deck');
      navigate(`/decks/${deckId}`, { replace: true });
    }
  }, [sessionSummary, deckId, navigate]);

  // Track study_session_completed when summary is available
  useEffect(() => {
    if (sessionSummary && !hasTrackedComplete.current) {
      hasTrackedComplete.current = true;

      // Extract data from sessionSummary (handle both type shapes)
      // The store creates: stats.cardsReviewed, stats.totalTime, etc.
      // The type expects: cardsReviewed, totalTime directly
      const summary = sessionSummary as Record<string, unknown>;
      const stats = (summary.stats as Record<string, number>) ?? {};

      const cardsReviewed = (summary.cardsReviewed as number) ?? stats.cardsReviewed ?? 0;
      const totalTime = (summary.totalTime as number) ?? stats.totalTime ?? 0;
      const accuracy = (summary.accuracy as number) ?? stats.accuracy ?? 0;

      // Don't track empty sessions
      if (cardsReviewed === 0) {
        return;
      }

      // Get cards_mastered and cards_failed
      // The store uses stats.easyCount as approximation for mastered
      // and stats.againCount for failed (ratingBreakdown.again equivalent)
      const transitions = summary.transitions as Record<string, number> | undefined;
      const ratingBreakdown = summary.ratingBreakdown as Record<string, number> | undefined;

      const cardsMastered =
        transitions?.reviewToMastered ?? Math.floor((stats.easyCount ?? 0) * 0.5);
      const cardsFailed = ratingBreakdown?.again ?? stats.againCount ?? 0;

      try {
        track('study_session_completed', {
          deck_id: sessionSummary.deckId,
          session_id: sessionSummary.sessionId,
          cards_reviewed: cardsReviewed,
          duration_sec: Math.round(totalTime),
          accuracy: Math.round(Math.min(100, Math.max(0, accuracy))),
          cards_mastered: cardsMastered,
          cards_failed: cardsFailed,
        });
      } catch {
        // Silent failure - don't break session summary display
      }
    }
  }, [sessionSummary, track]);

  // Clean up summary when component unmounts
  useEffect(() => {
    return () => {
      clearSessionSummary();
    };
  }, [clearSessionSummary]);

  // Loading state (while redirect is processing)
  if (!sessionSummary) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="container mx-auto max-w-3xl space-y-6 px-4">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state (should not happen if redirect works)
  if (!deckId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="container mx-auto max-w-3xl px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('session.error')}</AlertTitle>
            <AlertDescription>{t('session.invalidDeckId')}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/dashboard')}>{t('session.goToDashboard')}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Navigation handlers
  const handleBackToDeck = () => {
    navigate(`/decks/${deckId}`);
  };

  const handleReviewAgain = () => {
    navigate(`/decks/${deckId}/review`);
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  // Main render
  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <SessionSummary
          summary={sessionSummary}
          onBackToDeck={handleBackToDeck}
          onReviewAgain={handleReviewAgain}
          onDashboard={handleDashboard}
        />
      </div>
    </div>
  );
}
