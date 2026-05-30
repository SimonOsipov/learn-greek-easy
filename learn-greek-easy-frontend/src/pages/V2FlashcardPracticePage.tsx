// src/pages/V2FlashcardPracticePage.tsx

/**
 * V2 Flashcard Practice Page
 *
 * Full-screen practice experience using the v2PracticeStore (SM-2 v2 algorithm).
 * Supports card type filtering, inline session summary, and PostHog analytics.
 * Rendered outside AppLayout for an immersive full-screen experience.
 */

import { useEffect, useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/i18n';
import { PracticeHeader, SessionSummary } from '@/components/practice';
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
} from '@/features/practice/pf';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useDeck } from '@/hooks/useDeck';
import { usePracticeKeyboard } from '@/hooks/usePracticeKeyboard';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { formatDuration } from '@/lib/timeFormatUtils';
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
    startSession,
    rateCard,
    flipCard,
  } = useV2PracticeStore();

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

  // Audio: resolve URL from current cards card
  const currentQueueCard = cards[currentIndex] ?? null;
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
        <div className="flex flex-1 items-center justify-center">
          <SessionSummary
            title={t('v2Practice.sessionComplete', 'Session Complete')}
            stats={[
              {
                label: t('v2Practice.cardsReviewed', 'Cards Reviewed'),
                value: String(sessionSummary.cardsReviewed),
              },
              {
                label: t('v2Practice.totalTime', 'Total Time'),
                value: formatDuration(sessionSummary.totalTimeSeconds),
              },
              {
                label: t('v2Practice.avgPerCard', 'Avg/Card'),
                value: formatDuration(Math.round(sessionSummary.avgTimePerCard)),
              },
            ]}
            details={
              <div className="mb-4 rounded-lg border p-4">
                <p className="mb-2 text-sm font-medium">
                  {t('v2Practice.ratingBreakdown', 'Rating Breakdown')}
                </p>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <div className="font-bold text-practice-incorrect">
                      {sessionSummary.ratingBreakdown.again}
                    </div>
                    <div className="text-muted-foreground">{t('v2Practice.again', 'Again')}</div>
                  </div>
                  <div>
                    <div className="font-bold text-practice-hard">
                      {sessionSummary.ratingBreakdown.hard}
                    </div>
                    <div className="text-muted-foreground">{t('v2Practice.hard', 'Hard')}</div>
                  </div>
                  <div>
                    <div className="font-bold text-practice-correct">
                      {sessionSummary.ratingBreakdown.good}
                    </div>
                    <div className="text-muted-foreground">{t('v2Practice.good', 'Good')}</div>
                  </div>
                  <div>
                    <div className="font-bold text-practice-accent">
                      {sessionSummary.ratingBreakdown.easy}
                    </div>
                    <div className="text-muted-foreground">{t('v2Practice.easy', 'Easy')}</div>
                  </div>
                </div>
              </div>
            }
            actions={
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={() => backToDeck()}>
                  {t('v2Practice.backToDeck', 'Back to Deck')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    resetTracking();
                    if (deckId) startSession(deckId, cardType, wordId).catch(() => {});
                  }}
                >
                  {t('v2Practice.studyMore', 'Study More')}
                </Button>
              </div>
            }
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
      />

      {/* Content area */}
      <div className="mx-auto w-full max-w-lg px-4">
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

          if (cardType === 'meaning_el_to_en') {
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
                isFlipped={isFlipped}
                body={
                  <>
                    {headEl}
                    <TranslationElToEn
                      word={(front.main as string) ?? ''}
                      ipa={(front.sub as string | null | undefined) ?? null}
                      audioState={audioState ?? null}
                    />
                  </>
                }
                foot={
                  <PracticeCard
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
                }
              />
            );
          }

          if (cardType === 'meaning_en_to_el') {
            const prompt =
              (front.main as string | undefined) ?? (front.prompt as string | undefined) ?? '';
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
                isFlipped={isFlipped}
                body={
                  <>
                    {headEl}
                    <TranslationEnToEl prompt={prompt} />
                  </>
                }
                foot={
                  <PracticeCard
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
                }
              />
            );
          }

          if (cardType === 'article') {
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
                isFlipped={isFlipped}
                body={
                  <>
                    {headEl}
                    <GrammarArticle
                      wordWithArticle={(front.main as string) ?? ''}
                      prompt={(front.prompt as string | null | undefined) ?? null}
                    />
                  </>
                }
                foot={
                  <PracticeCard
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
                }
              />
            );
          }

          if (cardType === 'plural_form') {
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
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
                  </>
                }
                foot={
                  <PracticeCard
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
                }
              />
            );
          }

          if (cardType === 'sentence_translation') {
            const translatedPrompt = (front.prompt as string | null | undefined) ?? null;
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
                isFlipped={isFlipped}
                body={
                  <>
                    {headEl}
                    <Sentence
                      prompt={translatedPrompt}
                      main={(front.main as string) ?? ''}
                      audioState={audioState ?? null}
                    />
                  </>
                }
                foot={
                  <PracticeCard
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
                }
              />
            );
          }

          if (cardType === 'declension') {
            return (
              <PfCard
                key={currentCard.id}
                onClick={!isFlipped ? flipCard : undefined}
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
                    <PracticeCard
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
    </PracticeApp>
  );
}
