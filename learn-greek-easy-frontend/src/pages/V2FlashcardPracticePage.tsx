// src/pages/V2FlashcardPracticePage.tsx

/**
 * V2 Flashcard Practice Page
 *
 * Full-screen practice experience using the v2PracticeStore (SM-2 v2 algorithm).
 * Supports card type filtering, inline session summary, and PostHog analytics.
 * Rendered outside AppLayout for an immersive full-screen experience.
 */

import { useEffect, useRef, useCallback } from 'react';

import { CheckCircle2, ChevronLeft, AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/i18n';
import { PracticeCard } from '@/components/shared/PracticeCard';
import { ThemeSwitcher } from '@/components/theme';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type { CardRecordType } from '@/services/wordEntryAPI';
import {
  useV2PracticeStore,
  v2QueueCardToCardRecord,
  resolveV2CardAudioUrl,
} from '@/stores/v2PracticeStore';
import { useXPStore } from '@/stores/xpStore';

// ============================================
// Helpers
// ============================================

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ============================================
// Main Component
// ============================================

export function V2FlashcardPracticePage() {
  const { t } = useTranslation('deck');
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const cardType = (searchParams.get('cardType') ?? undefined) as CardRecordType | undefined;

  const {
    queue,
    currentIndex,
    isFlipped,
    isLoading,
    error,
    sessionId,
    sessionStats,
    sessionSummary,
    startSession,
    rateCard,
    flipCard,
  } = useV2PracticeStore();

  // Track session start time for PostHog
  const sessionStartTimeRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);

  // Start session on mount
  useEffect(() => {
    if (deckId) {
      startSession(deckId, cardType).catch(() => {
        // Error is handled by the store
      });
    }
  }, [deckId, cardType, startSession]);

  // Track session started when queue loads (non-empty)
  useEffect(() => {
    if (!isLoading && queue.length > 0 && sessionId && !hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      sessionStartTimeRef.current = Date.now();
      try {
        posthog.capture('study_session_started_v2', {
          deck_id: deckId,
          session_id: sessionId,
          cards_due: queue.length,
          card_type_filter: cardType ?? null,
        });
      } catch {
        // Silent failure
      }
    }
  }, [isLoading, queue.length, sessionId, deckId, cardType]);

  // Track session completed + XP refresh when summary appears
  useEffect(() => {
    if (sessionSummary && !hasTrackedCompleteRef.current) {
      hasTrackedCompleteRef.current = true;
      const durationSec = sessionStartTimeRef.current
        ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        : sessionSummary.totalTimeSeconds;
      try {
        posthog.capture('study_session_completed_v2', {
          deck_id: deckId,
          session_id: sessionSummary.sessionId,
          cards_reviewed: sessionSummary.cardsReviewed,
          duration_sec: durationSec,
          cards_mastered: sessionSummary.cardsMastered,
          cards_failed: sessionSummary.ratingBreakdown.again,
        });
      } catch {
        // Silent failure
      }
      // Refresh XP
      useXPStore
        .getState()
        .loadXPStats(true)
        .catch(() => {});
    }
  }, [sessionSummary, deckId]);

  // Track session abandoned on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStats.cardsReviewed > 0 && !sessionSummary && sessionId) {
        const durationSec = sessionStartTimeRef.current
          ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
          : 0;
        try {
          posthog.capture('study_session_abandoned_v2', {
            deck_id: deckId,
            session_id: sessionId,
            cards_reviewed: sessionStats.cardsReviewed,
            duration_sec: durationSec,
          });
        } catch {
          // Silent failure
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionStats.cardsReviewed, sessionSummary, sessionId, deckId]);

  // Audio: resolve URL from current queue card
  const currentQueueCard = queue[currentIndex] ?? null;
  const audioUrl = currentQueueCard ? resolveV2CardAudioUrl(currentQueueCard) : null;
  const {
    isPlaying: audioIsPlaying,
    isLoading: audioIsLoading,
    error: audioError,
    toggle: audioToggle,
    speed: audioSpeed,
    setSpeed: audioSetSpeed,
  } = useAudioPlayer(audioUrl);

  const audioState = currentQueueCard
    ? {
        audioUrl,
        isPlaying: audioIsPlaying,
        isLoading: audioIsLoading,
        error: audioError,
        onToggle: audioToggle,
        speed: audioSpeed,
        setSpeed: audioSetSpeed,
      }
    : null;

  // Handle rating
  const handleRate = useCallback(
    (rating: number) => {
      if (!isFlipped || !currentQueueCard || !sessionId) return;
      const safeRating = rating as 1 | 2 | 3 | 4;
      try {
        posthog.capture('card_reviewed_v2', {
          deck_id: deckId,
          card_record_id: currentQueueCard.card_record_id,
          rating: safeRating,
          quality: [0, 0, 2, 4, 5][safeRating] ?? safeRating,
          card_type: currentQueueCard.card_type,
          card_status: currentQueueCard.status,
          session_id: sessionId,
        });
      } catch {
        // Silent failure
      }
      rateCard(safeRating);
    },
    [isFlipped, currentQueueCard, sessionId, deckId, rateCard]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!isFlipped) flipCard();
        return;
      }
      if ((e.key === 'a' || e.key === 'A') && audioUrl) {
        e.preventDefault();
        audioToggle();
        return;
      }
      if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(parseInt(e.key, 10));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, flipCard, audioUrl, audioToggle, handleRate]);

  const backToDeck = () => navigate(`/decks/${deckId}`);

  // ============================================
  // Render: Loading
  // ============================================
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-24" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="icon" />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg px-4">
          <Skeleton className="min-h-[280px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Error
  // ============================================
  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={backToDeck}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('v2Practice.backToDeck')}
          </Button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="icon" />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => {
                if (deckId) startSession(deckId, cardType).catch(() => {});
              }}
            >
              {t('v2Practice.retry')}
            </Button>
            <Button variant="secondary" onClick={backToDeck}>
              {t('v2Practice.backToDeck')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Empty (no cards due)
  // ============================================
  if (!isLoading && !error && queue.length === 0 && !sessionSummary) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={backToDeck}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('v2Practice.backToDeck')}
          </Button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="icon" />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-2xl font-bold">{t('v2Practice.allCaughtUp')}</h2>
          <p className="mb-6 text-muted-foreground">{t('v2Practice.allCaughtUpDescription')}</p>
          <Button onClick={backToDeck}>{t('v2Practice.backToDeck')}</Button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Summary (session complete)
  // ============================================
  if (sessionSummary) {
    const { cardsReviewed, totalTimeSeconds, ratingBreakdown } = sessionSummary;
    const accuracy =
      cardsReviewed > 0
        ? Math.round(((ratingBreakdown.good + ratingBreakdown.easy) / cardsReviewed) * 100)
        : 0;

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={backToDeck}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('v2Practice.backToDeck')}
          </Button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="icon" />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <h2 className="mb-6 text-center text-2xl font-bold">{t('v2Practice.sessionComplete')}</h2>

          {/* Stats grid */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold">{cardsReviewed}</div>
              <div className="text-sm text-muted-foreground">{t('v2Practice.cardsReviewed')}</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold">{formatDuration(totalTimeSeconds)}</div>
              <div className="text-sm text-muted-foreground">{t('v2Practice.timeSpent')}</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold">{accuracy}%</div>
              <div className="text-sm text-muted-foreground">{t('v2Practice.accuracy')}</div>
            </div>
          </div>

          {/* Rating breakdown */}
          <div className="mb-6 rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold">{t('v2Practice.ratingBreakdown')}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Again</span>
                <span className="font-medium">{ratingBreakdown.again}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hard</span>
                <span className="font-medium">{ratingBreakdown.hard}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Good</span>
                <span className="font-medium">{ratingBreakdown.good}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Easy</span>
                <span className="font-medium">{ratingBreakdown.easy}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                hasTrackedStartRef.current = false;
                hasTrackedCompleteRef.current = false;
                if (deckId) startSession(deckId, cardType).catch(() => {});
              }}
            >
              {t('v2Practice.studyMore')}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={backToDeck}>
              {t('v2Practice.backToDeck')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Active session
  // ============================================
  const currentCard = currentQueueCard ? v2QueueCardToCardRecord(currentQueueCard) : null;

  if (!currentCard) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="sm" onClick={backToDeck} data-testid="practice-close-button">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('v2Practice.exitSession')}
        </Button>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
      </div>

      {/* Content area */}
      <div className="mx-auto w-full max-w-lg px-4">
        {/* Progress counter */}
        <p className="mb-4 text-center text-sm text-muted-foreground">
          {t('v2Practice.progress', {
            current: Math.min(currentIndex + 1, queue.length),
            total: queue.length,
          })}
        </p>

        {/* Practice card */}
        <PracticeCard
          key={currentCard.id}
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={flipCard}
          translationRu={currentQueueCard?.translation_ru ?? null}
          translationRuPlural={currentQueueCard?.translation_ru_plural ?? null}
          sentenceRu={currentQueueCard?.sentence_ru ?? null}
          onRate={handleRate}
          audioState={audioState}
          wordEntryId={currentCard.word_entry_id}
          deckId={deckId}
        />
      </div>
    </div>
  );
}
