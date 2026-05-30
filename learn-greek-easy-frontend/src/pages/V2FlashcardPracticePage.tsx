// src/pages/V2FlashcardPracticePage.tsx

/**
 * V2 Flashcard Practice Page
 *
 * Full-screen practice experience using the v2PracticeStore (SM-2 v2 algorithm).
 * Supports card type filtering, inline session summary, and PostHog analytics.
 * Rendered outside AppLayout for an immersive full-screen experience.
 */

import { useEffect, useCallback, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/i18n';
import { PracticeHeader } from '@/components/practice';
import { PracticeCard } from '@/components/shared/PracticeCard';
import { ThemeSwitcher } from '@/components/theme';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PracticeApp,
  TopBar,
  Card as PfCard,
  CardHead,
  TranslationElToEn,
  TranslationEnToEl,
  GrammarArticle,
  GrammarPlural,
  Sentence,
  Declension,
  Answer,
  RatingRow,
  Toast,
  TypedInput,
  resolveAnswerText,
  Done,
} from '@/features/practice/pf';
import type { Verdict } from '@/features/practice/pf';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useDeck } from '@/hooks/useDeck';
import { usePracticeKeyboard } from '@/hooks/usePracticeKeyboard';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import type { CardRecordType } from '@/services/wordEntryAPI';
import {
  useV2PracticeStore,
  v2QueueCardToCardRecord,
  resolveV2CardAudioUrl,
} from '@/stores/v2PracticeStore';
import { useXPStore } from '@/stores/xpStore';

// ============================================
// Main Component
// ============================================

export function V2FlashcardPracticePage() {
  const { t, i18n } = useTranslation('deck');
  const { deckId, wordId } = useParams<{ deckId: string; wordId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cardType = (searchParams.get('cardType') ?? undefined) as CardRecordType | undefined;

  // Resolve deck name for TopBar label (PRACT2-1-02)
  const { deck } = useDeck(deckId ?? null);
  const deckName =
    deck?.name && typeof deck.name === 'string'
      ? deck.name
      : (deck?.name_en ?? deck?.name_el ?? null);

  const {
    cards,
    currentIndex,
    isFlipped,
    isLoading,
    error,
    sessionId,
    sessionSummary,
    totalNew,
    totalReview,
    streak,
    ratings,
    leaveDirection,
    toast,
    inputMode,
    startSession,
    rateCard,
    flipCard,
    clearLeaveDirection,
    clearToast,
    setInputMode,
  } = useV2PracticeStore();

  // ── Slide-out deferred remount (PRACT2-1-07) ─────────────────────────────
  //
  // The store advances currentIndex SYNCHRONOUSLY on rateCard (optimistic).
  // Without a delay, React would instantly remount the card via key={currentCard.id},
  // skipping the 320ms slide-out animation.
  //
  // Solution: displayIndex is the index actually rendered; it lags currentIndex
  // by 320ms when leaveDirection is set, giving data-leave time to animate.
  const [displayIndex, setDisplayIndex] = useState(currentIndex);
  // Type-mode verdict — set when user presses Enter in TypedInput; cleared on card advance
  const [typedResult, setTypedResult] = useState<Verdict | null>(null);

  useEffect(() => {
    if (leaveDirection) {
      // A rating was just submitted — play slide, then advance display
      const timer = window.setTimeout(() => {
        setDisplayIndex(currentIndex);
        clearLeaveDirection();
        setTypedResult(null); // clear verdict for new card
      }, 320);
      return () => window.clearTimeout(timer);
    } else {
      // No slide in progress (e.g., session start) — sync immediately
      setDisplayIndex(currentIndex);
      setTypedResult(null); // clear verdict on immediate advance
    }
  }, [currentIndex, leaveDirection, clearLeaveDirection]);

  const { resetTracking } = usePracticeSession({
    startEvent: 'study_session_started_v2',
    completeEvent: 'study_session_completed_v2',
    abandonEvent: 'study_session_abandoned_v2',
    isSessionActive: cards.length > 0 && !sessionSummary,
    isSessionComplete: Boolean(sessionSummary),
    getStartProps: useCallback(() => {
      if (cards.length === 0) return null;
      return {
        deck_id: deckId ?? null,
        card_type: cardType ?? null,
        card_count: cards.length,
      };
    }, [cards, deckId, cardType]),
    getCompleteProps: useCallback(
      (_durationSec: number) => {
        if (!sessionSummary) return null;
        return {
          deck_id: deckId ?? null,
          cards_reviewed: sessionSummary.cardsReviewed,
          total_time_seconds: sessionSummary.totalTimeSeconds,
          avg_time_per_card: sessionSummary.avgTimePerCard,
          again: sessionSummary.ratingBreakdown.again,
          hard: sessionSummary.ratingBreakdown.hard,
          good: sessionSummary.ratingBreakdown.good,
          easy: sessionSummary.ratingBreakdown.easy,
        };
      },
      [sessionSummary, deckId]
    ),
    getAbandonProps: useCallback(
      (durationSec: number) => {
        if (cards.length === 0 || sessionSummary) return null;
        return {
          deck_id: deckId ?? null,
          cards_reviewed: currentIndex,
          duration_sec: durationSec,
        };
      },
      [cards, sessionSummary, deckId, currentIndex]
    ),
    onCompleteTracked: useCallback(() => {
      useXPStore.getState().loadXPStats(true);
    }, []),
  });

  // Start session on mount
  useEffect(() => {
    if (deckId) {
      startSession(deckId, cardType, wordId).catch(() => {
        // Error is handled by the store
      });
    }
  }, [deckId, cardType, wordId, startSession]);

  // Invalidate analytics cache when session completes
  useEffect(() => {
    if (sessionSummary) {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  }, [sessionSummary, queryClient]);

  // Audio: resolve URL from current cards card.
  // displayIndex is used for rendering (lags 320ms for slide-out animation);
  // currentIndex is used for audio/session logic (always the latest).
  const currentQueueCard = cards[displayIndex] ?? null;
  const audioQueueCard = cards[currentIndex] ?? null;
  const audioUrl = audioQueueCard ? resolveV2CardAudioUrl(audioQueueCard) : null;
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

  // Current UI language — drives EN/RU switch in CardHead
  const currentLang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ru';
  const handleLangChange = (lang: 'en' | 'ru') => {
    i18n.changeLanguage(lang);
  };

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
  usePracticeKeyboard({
    keymap: {
      Space: () => {
        if (!isFlipped) flipCard();
      },
      ' ': () => {
        if (!isFlipped) flipCard();
      },
      a: () => {
        if (audioUrl) audioToggle();
      },
      A: () => {
        if (audioUrl) audioToggle();
      },
      '1': () => {
        if (isFlipped) handleRate(1);
      },
      '2': () => {
        if (isFlipped) handleRate(2);
      },
      '3': () => {
        if (isFlipped) handleRate(3);
      },
      '4': () => {
        if (isFlipped) handleRate(4);
      },
    },
    deps: [isFlipped, flipCard, audioUrl, audioToggle, handleRate],
  });

  const backToDeck = () =>
    navigate(wordId && deckId ? `/decks/${deckId}/words/${wordId}` : `/decks/${deckId}`);

  // ============================================
  // Render: Loading
  // ============================================
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-practice-bg">
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
      <div className="flex min-h-screen flex-col bg-practice-bg">
        <PracticeHeader
          onExit={() => backToDeck()}
          exitLabel="Exit"
          exitTestId="practice-close-button"
          rightSlot={
            <>
              <LanguageSwitcher variant="icon" />
              <ThemeSwitcher />
            </>
          }
        />
        <div className="mx-auto w-full max-w-lg px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => {
                if (deckId) startSession(deckId, cardType, wordId).catch(() => {});
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
  if (!isLoading && !error && cards.length === 0 && !sessionSummary) {
    return (
      <div className="flex min-h-screen flex-col bg-practice-bg">
        <PracticeHeader
          onExit={() => backToDeck()}
          exitLabel="Exit"
          exitTestId="practice-close-button"
          rightSlot={
            <>
              <LanguageSwitcher variant="icon" />
              <ThemeSwitcher />
            </>
          }
        />
        <div className="mx-auto w-full max-w-lg px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-practice-correct" />
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
    return (
      <div className="flex min-h-screen flex-col bg-practice-bg">
        <PracticeHeader
          onExit={() => backToDeck()}
          exitLabel="Exit"
          exitTestId="practice-close-button"
          rightSlot={
            <>
              <LanguageSwitcher variant="icon" />
              <ThemeSwitcher />
            </>
          }
        />
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <Done
            summary={sessionSummary}
            onBackToDeck={backToDeck}
            onPracticeAgain={() => {
              resetTracking();
              if (deckId) startSession(deckId, cardType, wordId).catch(() => {});
            }}
          />
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

  // Toast: only show if the toast belongs to the currently displayed card
  const activeToast =
    toast && currentQueueCard && toast.forCardId === currentQueueCard.card_record_id ? toast : null;

  // Shared pf foot — Answer + RatingRow + Toast (replaces PracticeCard answer section)
  // resolveAnswerText is used for consistency with judge's answer target
  const pfFoot = (
    <>
      {currentQueueCard && (
        <Answer
          answerText={resolveAnswerText(
            currentCard.card_type,
            currentCard.back_content as Record<string, unknown>
          )}
          cardType={currentCard.card_type}
          card={currentQueueCard}
          exampleAudioState={audioState}
          typedResult={typedResult}
        />
      )}
      <RatingRow onRate={handleRate} isFlipped={isFlipped} />
      {activeToast && <Toast interval={activeToast.interval} onDismiss={clearToast} />}
    </>
  );

  return (
    <PracticeApp cardType={currentQueueCard?.card_type ?? null}>
      {/* Top bar — replaces legacy PracticeHeader + ProgressIndicator (PRACT2-1-02) */}
      <TopBar
        onExit={backToDeck}
        deckName={deckName}
        cards={cards}
        currentIndex={currentIndex}
        totalNew={totalNew}
        totalReview={totalReview}
        streak={streak}
        ratings={ratings}
        showStreak={true}
        inputMode={inputMode}
        onToggleInputMode={() => setInputMode(inputMode === 'reveal' ? 'type' : 'reveal')}
      />

      {/* Content area */}
      <div className="mx-auto w-full max-w-lg px-4">
        {/* Slide-out wrapper — data-leave drives the 320ms rating-aware animation.
            The inner card key={currentCard.id} remounts after displayIndex advances
            (deferred 320ms by the useEffect above). */}
        <div
          className="pf-card-slide-wrapper"
          data-leave={leaveDirection ?? undefined}
          data-testid="pf-card-slide-wrapper"
        >
          {/* Practice card — pf renderers for covered types; PracticeCard fallback for others */}
          {(() => {
            const cardType = currentQueueCard?.card_type;
            const front = currentCard.front_content as Record<string, unknown>;
            const back = currentCard.back_content as Record<string, unknown>;

            // Shared card head props
            const headEl = (
              <CardHead
                cardType={cardType ?? ''}
                posLabel={(front.badge as string | null | undefined) ?? null}
                gender={(back.gender as string | null | undefined) ?? null}
                genderRu={(back.gender_ru as string | null | undefined) ?? null}
                currentLang={currentLang}
                onLangChange={handleLangChange}
              />
            );

            // Type-mode input — shared across all pf-backed card types
            // Only shown when inputMode === 'type' && !isFlipped
            const typedInputEl =
              inputMode === 'type' && !isFlipped ? (
                <TypedInput
                  key={`typed-${currentCard.id}`}
                  cardType={cardType}
                  backContent={back}
                  onFlip={flipCard}
                  onResult={(v) => setTypedResult(v)}
                />
              ) : null;

            if (cardType === 'meaning_el_to_en') {
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <TranslationElToEn
                        word={(front.main as string) ?? ''}
                        ipa={(front.sub as string | null | undefined) ?? null}
                        audioState={audioState ?? null}
                      />
                      {typedInputEl}
                    </>
                  }
                  foot={pfFoot}
                />
              );
            }

            if (cardType === 'meaning_en_to_el') {
              const prompt =
                (front.main as string | undefined) ?? (front.prompt as string | undefined) ?? '';
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <TranslationEnToEl prompt={prompt} />
                      {typedInputEl}
                    </>
                  }
                  foot={pfFoot}
                />
              );
            }

            if (cardType === 'article') {
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <GrammarArticle
                        wordWithArticle={(front.main as string) ?? ''}
                        prompt={(front.prompt as string | null | undefined) ?? null}
                      />
                      {typedInputEl}
                    </>
                  }
                  foot={pfFoot}
                />
              );
            }

            if (cardType === 'plural_form') {
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <GrammarPlural
                        stem={(front.main as string) ?? ''}
                        ipa={(front.sub as string | null | undefined) ?? null}
                        audioState={audioState ?? null}
                        prompt={(front.prompt as string | null | undefined) ?? null}
                      />
                      {typedInputEl}
                    </>
                  }
                  foot={pfFoot}
                />
              );
            }

            if (cardType === 'sentence_translation') {
              const translatedPrompt = (front.prompt as string | null | undefined) ?? null;
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <Sentence
                        prompt={translatedPrompt}
                        main={(front.main as string) ?? ''}
                        audioState={audioState ?? null}
                      />
                      {typedInputEl}
                    </>
                  }
                  foot={pfFoot}
                />
              );
            }

            if (cardType === 'declension') {
              return (
                <PfCard
                  key={currentCard.id}
                  onClick={!isFlipped && inputMode === 'reveal' ? flipCard : undefined}
                  isFlipped={isFlipped}
                  body={
                    <>
                      {headEl}
                      <Declension
                        card={{
                          back_content: currentCard.back_content as Record<string, unknown>,
                          front_content: currentCard.front_content as Record<string, unknown>,
                        }}
                        revealed={false}
                      />
                      {typedInputEl}
                    </>
                  }
                  foot={
                    <>
                      <Declension
                        card={{
                          back_content: currentCard.back_content as Record<string, unknown>,
                          front_content: currentCard.front_content as Record<string, unknown>,
                        }}
                        revealed={true}
                      />
                      {/* Answer suppressed for declension (DeclTable IS the answer) */}
                      {/* Typed-result chip for declension (Answer is suppressed) */}
                      {typedResult && (
                        <div className="pf-answer__type-slot" data-testid="pf-answer-type-slot">
                          <div
                            className={`pf-typed-result pf-typed-result--${typedResult}`}
                            data-testid="pf-typed-result"
                            data-verdict={typedResult}
                            role="status"
                          >
                            {typedResult === 'correct'
                              ? 'Correct'
                              : typedResult === 'lenient'
                                ? 'Close enough'
                                : 'Wrong'}
                          </div>
                        </div>
                      )}
                      <RatingRow onRate={handleRate} isFlipped={isFlipped} />
                      {activeToast && (
                        <Toast interval={activeToast.interval} onDismiss={clearToast} />
                      )}
                    </>
                  }
                />
              );
            }

            // Fallback: legacy PracticeCard for cloze, conjugation
            return (
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
            );
          })()}
        </div>
      </div>
    </PracticeApp>
  );
}
