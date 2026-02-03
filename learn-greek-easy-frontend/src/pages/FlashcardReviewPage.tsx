import { useEffect, useRef } from 'react';

import { AlertCircle, ChevronLeft } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/i18n';
import { FlashcardContainer } from '@/components/review/FlashcardContainer';
import { FlashcardSkeleton } from '@/components/review/FlashcardSkeleton';
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';
import { ThemeSwitcher } from '@/components/theme';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useDeckStore } from '@/stores/deckStore';
import { useReviewStore } from '@/stores/reviewStore';

export function FlashcardReviewPage() {
  const { t } = useTranslation('review');
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const {
    activeSession,
    currentCard,
    startSession,
    isLoading,
    error,
    sessionSummary,
    sessionStats,
  } = useReviewStore();
  const { decks } = useDeckStore();

  // Detect transition state: session just ended, navigating to summary
  const isTransitioningToSummary = !activeSession && sessionSummary !== null;
  const { track } = useTrackEvent();

  // Refs to prevent duplicate event tracking
  const hasTrackedStart = useRef(false);
  const sessionStartTime = useRef<number | null>(null);

  // Enable keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  // Start session on mount
  useEffect(() => {
    if (deckId && !activeSession) {
      // Catch errors - they're already handled by setting store error state
      startSession(deckId).catch(() => {
        // Error is handled by the store and displayed in UI
      });
    }
  }, [deckId, activeSession, startSession]);

  // Navigate to summary when session ends
  useEffect(() => {
    if (sessionSummary && deckId) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        navigate(`/decks/${deckId}/summary`);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sessionSummary, deckId, navigate]);

  // Track study_session_started when session becomes active
  useEffect(() => {
    if (activeSession && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      sessionStartTime.current = Date.now();

      try {
        const deck = decks.find((d) => d.id === activeSession.deckId);
        track('study_session_started', {
          deck_id: activeSession.deckId,
          deck_level: deck?.level ?? 'A1',
          cards_due: activeSession.cards.length,
          is_first_session: !deck?.progress?.lastStudied,
          session_id: activeSession.sessionId,
        });
      } catch {
        // Silent failure - don't break session flow
      }
    }
  }, [activeSession, decks, track]);

  // Track study_session_abandoned on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only track abandonment if:
      // 1. There's an active session
      // 2. Cards have been reviewed (not immediate exit)
      // 3. Session hasn't completed (no summary yet)
      if (activeSession && sessionStats.cardsReviewed > 0 && !sessionSummary) {
        const durationSec = sessionStartTime.current
          ? Math.round((Date.now() - sessionStartTime.current) / 1000)
          : 0;

        // Use sendBeacon for fire-and-forget on page unload
        if (typeof navigator?.sendBeacon === 'function' && typeof posthog?.capture === 'function') {
          try {
            // PostHog doesn't have a direct sendBeacon method, but we can try to capture
            // The PostHog SDK internally handles beforeunload, but we explicitly track abandonment
            posthog.capture('study_session_abandoned', {
              deck_id: activeSession.deckId,
              session_id: activeSession.sessionId,
              cards_reviewed: sessionStats.cardsReviewed,
              duration_sec: durationSec,
            });
          } catch {
            // Silent failure - fire-and-forget pattern
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeSession, sessionStats, sessionSummary]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <FlashcardSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <div className="mx-auto max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate(`/decks/${deckId}`)}
            className="mb-4 text-foreground hover:bg-muted"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('session.backToDeck')}
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('session.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => deckId && startSession(deckId)} variant="default">
              {t('session.retry')}
            </Button>
            <Button onClick={() => navigate(`/decks/${deckId}`)} variant="secondary">
              {t('session.backToDeck')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No cards due state - but NOT during session-to-summary transition or initial mount
  if (!currentCard && activeSession && !isTransitioningToSummary) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <div className="mx-auto max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate(`/decks/${deckId}`)}
            className="mb-4 text-foreground hover:bg-muted"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('session.backToDeck')}
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('session.noCardsDue')}</AlertTitle>
            <AlertDescription>{t('session.noCardsDueDescription')}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate(`/decks/${deckId}`)} variant="secondary">
              {t('session.backToDeck')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Transition state: show loading while navigating to summary
  if (isTransitioningToSummary) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <FlashcardSkeleton />
      </div>
    );
  }

  // Initial mount: show loading while session is being established
  if (!currentCard || !activeSession) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <FlashcardSkeleton />
      </div>
    );
  }

  // Main flashcard view
  return (
    <div className="min-h-screen bg-background p-10">
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <LanguageSwitcher variant="icon" />
        <ThemeSwitcher />
      </div>
      <div className="mx-auto mb-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/decks/${deckId}`)}
          className="text-foreground hover:bg-muted"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('session.exitReview')}
        </Button>
      </div>
      <FlashcardContainer card={currentCard} />
      <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
