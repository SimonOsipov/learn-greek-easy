/**
 * ReviewScreen — /decks/[deckId]/review (MOB-09).
 *
 * Full-screen SRS study loop: queue fetch → card front → tap-to-flip → card back
 * + rating row → next card → session summary. Empty queue shows "All caught up".
 *
 * Root-stack push (no tab bar). Uses the dedicated --practice-* slate palette
 * with its own in-flow theme toggle (independent of app theme).
 *
 * Data flow:
 *   1. GET /api/v1/study/queue/v2?deck_id={deckId} via useStudyQueue
 *   2. User flips card, rates → POST /api/v1/reviews/v2 via useSubmitReview
 *   3. Advance to next card; accumulate session stats client-side
 *   4. On queue complete → show SessionSummary
 *   5. On exit → invalidate deck/queue caches so deck-detail reflects new state
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useStudyQueue } from '@/hooks/use-study-queue';
import { useSubmitReview } from '@/hooks/use-submit-review';
import { track } from '@/lib/analytics';
import { mapRatingToQuality } from '@/types/review';
import type { UIRating, SessionStats, V2StudyQueueCard } from '@/types/review';

import { ProgressHeader } from '@/components/review/progress-header';
import { CardFront } from '@/components/review/card-front';
import { CardBack } from '@/components/review/card-back';
import { RatingRow } from '@/components/review/rating-row';
import { SessionSummary } from '@/components/review/session-summary';
import { AllCaughtUp } from '@/components/review/all-caught-up';
import { SkeletonCard } from '@/components/review/skeleton-card';
import { reviewPalette } from '@/lib/review/presentation';

// ── Screen state machine ──
type ReviewPhase =
  | 'loading'
  | 'error'
  | 'empty'    // all caught up
  | 'front'    // card front shown
  | 'back'     // card flipped, rating row visible
  | 'summary'; // session complete

const EMPTY_STATS: SessionStats = {
  reviewed: 0,
  total_time_seconds: 0,
  again_count: 0,
  hard_count: 0,
  good_count: 0,
  easy_count: 0,
};

export default function ReviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ── Data hooks ──
  const queueQuery = useStudyQueue(deckId);
  const submitMutation = useSubmitReview();

  // ── Review-screen-local theme (independent of app theme) ──
  const [isDark, setIsDark] = useState(true); // dark is product default
  const [locale, setLocale] = useState<'en' | 'ru'>('en');

  // ── Session state ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>('loading');
  const [sessionStats, setSessionStats] = useState<SessionStats>(EMPTY_STATS);

  // Cards from the queue (local copy — does not change during session)
  const [cards, setCards] = useState<V2StudyQueueCard[]>([]);

  // Time tracking: when the current card was first shown to the user (epoch ms)
  const cardShownAt = useRef<number>(0);

  // Whether the analytics start event has fired for this session
  const startFiredRef = useRef(false);

  // ── Initialise session once when the queue resolves ──
  // Note: phase starts as 'loading' and we only transition away from it when
  // we get a concrete result. Using a separate flag so we only run this once
  // (avoids re-initialising mid-session if a dependent query re-renders).
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    // #1/#19: guard against stale data present during refetch (isFetching is true
    // while refetch() is in-flight; data still holds the old queue from the last
    // successful fetch).  Wait until the fetch has actually settled.
    if (queueQuery.isFetching) return;
    if (queueQuery.isLoading || (!queueQuery.data && !queueQuery.isError)) return;

    initializedRef.current = true;

    const qCards = queueQuery.isError ? [] : (queueQuery.data?.cards ?? []);
    const nextPhase = queueQuery.isError ? 'error' : qCards.length === 0 ? 'empty' : 'front';

    if (nextPhase === 'front') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCards(qCards);
      setCurrentIndex(0);
      cardShownAt.current = Date.now();
      if (!startFiredRef.current) {
        startFiredRef.current = true;
        track('review_session_started', {
          deck_id: deckId,
          queue_size: qCards.length,
        });
      }
    }

    setPhase(nextPhase);
  }, [queueQuery.isFetching, queueQuery.isLoading, queueQuery.isError, queueQuery.data, deckId]);

  // ── Card flip ──
  const handleFlip = useCallback(() => {
    if (phase !== 'front') return;
    setPhase('back');
  }, [phase]);

  // ── Rating submission ──
  const handleRate = useCallback(
    (rating: UIRating) => {
      if (phase !== 'back') return;
      const card = cards[currentIndex];
      if (!card) return;

      const timeTaken = Math.min(
        Math.round((Date.now() - cardShownAt.current) / 1000),
        180,
      );

      submitMutation.mutate(
        {
          card_record_id: card.card_record_id,
          quality: mapRatingToQuality(rating),
          time_taken: timeTaken,
        },
        {
          onSettled: () => {
            // Advance regardless of network outcome (fire-and-forget pattern)
            track('review_card_rated', {
              rating,
              card_type: card.card_type,
            });

            const nextIndex = currentIndex + 1;
            const isLastCard = nextIndex >= cards.length;

            setSessionStats((prev) => {
              const next: SessionStats = {
                ...prev,
                reviewed: prev.reviewed + 1,
                total_time_seconds: prev.total_time_seconds + timeTaken,
                again_count: prev.again_count + (rating === 1 ? 1 : 0),
                hard_count:  prev.hard_count  + (rating === 2 ? 1 : 0),
                good_count:  prev.good_count  + (rating === 3 ? 1 : 0),
                easy_count:  prev.easy_count  + (rating === 4 ? 1 : 0),
              };
              if (isLastCard) {
                const goodAndEasy = next.good_count + next.easy_count;
                track('review_session_completed', {
                  deck_id: deckId,
                  cards_reviewed: next.reviewed,
                  accuracy: Math.round((goodAndEasy / next.reviewed) * 100),
                });
              }
              return next;
            });

            if (isLastCard) {
              setPhase('summary');
            } else {
              setCurrentIndex(nextIndex);
              setPhase('front');
              cardShownAt.current = Date.now();
            }
          },
        },
      );
    },
    [phase, cards, currentIndex, submitMutation, deckId],
  );

  // ── Exit: invalidate caches so deck-detail reflects changes ──
  const invalidateAndExit = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
    void queryClient.invalidateQueries({ queryKey: ['deck-word-mastery', deckId] });
    void queryClient.invalidateQueries({ queryKey: ['study-queue', deckId] });
    void queryClient.invalidateQueries({ queryKey: ['deck-progress'] });
    router.back();
  }, [queryClient, deckId, router]);

  const handleAbandon = useCallback(() => {
    track('review_session_abandoned', { deck_id: deckId });
    invalidateAndExit();
  }, [deckId, invalidateAndExit]);

  // ── Study more: refetch queue and restart ──
  const handleStudyMore = useCallback(() => {
    setSessionStats(EMPTY_STATS);
    setCurrentIndex(0);
    setPhase('loading');
    startFiredRef.current = false;
    // #1/#19: reset initializedRef so the init effect can re-run once the
    // refetch settles (without this the init effect early-returns and phase
    // stays 'loading' forever, leaving the user stuck on the SkeletonCard).
    initializedRef.current = false;
    void queueQuery.refetch();
  }, [queueQuery]);

  // ── Computed rating previews ──
  const currentCard = cards[currentIndex];
  const ratingPreviews = currentCard?.rating_previews?.reduce<Record<UIRating, string | undefined>>(
    (acc, p) => {
      const label = p.interval === 0
        ? '0m'
        : p.interval < 1
        ? `${Math.round(p.interval * 24 * 60)}m`
        : `${p.interval}d`;
      acc[p.rating as UIRating] = label;
      return acc;
    },
    {} as Record<UIRating, string | undefined>,
  );

  // ── Palette (applied as View bg) ──
  // #5/#25/#29: use explicit rgb constants keyed on isDark; hsl(var(...)) would also
  // work here since it is a screen-level inline style (not a className), but using
  // the presentation map keeps the source-of-truth in one place.
  const palette = reviewPalette(isDark);
  const bgColor = palette.screenBg;

  // ── Loading state ──
  if (phase === 'loading') {
    return (
      <View
        testID="review-loading"
        className="flex-1"
        style={{
          backgroundColor: bgColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ProgressHeader
          currentIndex={0}
          total={0}
          locale={locale}
          onLocaleChange={setLocale}
          isDark={isDark}
          onThemeToggle={() => setIsDark((d) => !d)}
          onClose={handleAbandon}
        />
        <View className="flex-1 px-4 pt-4">
          <SkeletonCard isDark={isDark} />
        </View>
      </View>
    );
  }

  // ── Error state (queue fetch failed) ──
  if (phase === 'error') {
    const errStatus = (queueQuery.error as { status?: number } | null)?.status;
    const is403 = errStatus === 403;

    return (
      <View
        testID="review-error"
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text
          testID="review-error-message"
          className="text-[17px] font-semibold text-center mb-3"
          style={{ fontFamily: 'InterTight_700Bold', color: palette.text }}
        >
          {is403 ? 'Premium required' : "Couldn't load cards"}
        </Text>
        <Text className="text-[14px] text-center mb-6" style={{ color: palette.textMuted }}>
          {is403
            ? 'This deck requires a premium subscription.'
            : 'Please check your connection and try again.'}
        </Text>
        {!is403 && (
          <Pressable
            testID="review-error-retry"
            onPress={() => queueQuery.refetch()}
            className="px-6 py-3 rounded-lg mb-3 active:opacity-70"
            style={{ borderWidth: 1, borderColor: palette.borderColor }}
          >
            <Text className="text-[14px] font-semibold" style={{ color: palette.accent }}>
              Retry
            </Text>
          </Pressable>
        )}
        <Pressable
          testID="review-error-back"
          onPress={() => router.back()}
          className="px-6 py-3 active:opacity-70"
        >
          <Text className="text-[14px]" style={{ color: palette.textMuted }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── All caught up ──
  if (phase === 'empty') {
    return (
      <View
        testID="review-screen-empty"
        className="flex-1"
        style={{ backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <ProgressHeader
          currentIndex={0}
          total={0}
          locale={locale}
          onLocaleChange={setLocale}
          isDark={isDark}
          onThemeToggle={() => setIsDark((d) => !d)}
          onClose={() => router.back()}
        />
        <AllCaughtUp isDark={isDark} onBackToDeck={() => router.back()} />
      </View>
    );
  }

  // ── Session summary ──
  if (phase === 'summary') {
    return (
      <View
        testID="review-screen-summary"
        className="flex-1"
        style={{ backgroundColor: bgColor, paddingTop: insets.top }}
      >
        <SessionSummary
          stats={sessionStats}
          isDark={isDark}
          onBackToDeck={invalidateAndExit}
          onStudyMore={handleStudyMore}
        />
      </View>
    );
  }

  // ── Active review (front / back) ──
  if (!currentCard) return null;

  return (
    <View
      testID="review-screen"
      className="flex-1"
      style={{ backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Progress header */}
      <ProgressHeader
        currentIndex={currentIndex}
        total={cards.length}
        locale={locale}
        onLocaleChange={setLocale}
        isDark={isDark}
        onThemeToggle={() => setIsDark((d) => !d)}
        onClose={handleAbandon}
      />

      {/* Card area — scrollable so large back content fits */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'front' ? (
          <CardFront
            card={currentCard}
            isDark={isDark}
            onFlip={handleFlip}
          />
        ) : (
          <CardBack
            card={currentCard}
            locale={locale}
            isDark={isDark}
          />
        )}
      </ScrollView>

      {/* Rating row or loading indicator — pinned to bottom */}
      <View
        className="px-4 pb-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {phase === 'back' ? (
          <RatingRow
            onRate={handleRate}
            isSubmitting={submitMutation.isPending}
            previews={ratingPreviews}
          />
        ) : (
          // Front state: show a subtle "tap card to reveal" reminder at bottom
          <View className="items-center py-2">
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
