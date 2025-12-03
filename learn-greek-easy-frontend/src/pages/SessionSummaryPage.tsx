import { useEffect } from 'react';

import { AlertCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

import { SessionSummary } from '@/components/review/SessionSummary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { sessionSummary, clearSessionSummary } = useReviewStore();

  // Redirect if no summary available
  useEffect(() => {
    if (!sessionSummary) {
      console.warn('No session summary available, redirecting to deck');
      navigate(`/decks/${deckId}`, { replace: true });
    }
  }, [sessionSummary, deckId, navigate]);

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
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Invalid deck ID. Please return to the dashboard.</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
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
