import React, { useCallback, useEffect, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { Feed } from '@/components/dashboard/Feed';
import { HeroEntries } from '@/components/dashboard/HeroEntries';
import { composeFeed } from '@/components/dashboard/lib/composeFeed';
import { isNewUser } from '@/components/dashboard/lib/isNewUser';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { StarterView } from '@/components/dashboard/StarterView';
import { WhatsNewStrip } from '@/components/dashboard/WhatsNewStrip';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTourAutoTrigger } from '@/hooks/useTourAutoTrigger';
import { reportAPIError } from '@/lib/errorReporting';
import { masteredCount } from '@/lib/progressGlossary';
import { formatStudyTime } from '@/lib/timeFormatUtils';
import { adminAPI } from '@/services/adminAPI';
import { exerciseAPI } from '@/services/exerciseAPI';
import { situationAPI } from '@/services/situationAPI';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

/**
 * Dashboard Page
 *
 * Main user dashboard showing:
 * - Welcome section with streak and due cards
 * - Hero entry cards
 * - What's new strip
 * - Key metrics (due today, streak, mastered, time)
 * - Unified mixed feed (DASH2-01-06)
 */
export const Dashboard: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  // Auth state
  const user = useAuthStore((state) => state.user);

  // Analytics data (auto-loads on mount)
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError } = useAnalytics();

  // Deck data
  const decks = useDeckStore((state) => state.decks);
  const decksLoading = useDeckStore((state) => state.isLoading);
  const fetchDecks = useDeckStore((state) => state.fetchDecks);

  // Fetch decks on mount
  useEffect(() => {
    fetchDecks().catch((error) => {
      reportAPIError(error, { operation: 'fetchDecks', endpoint: '/decks' });
    });
  }, [fetchDecks]);

  useTourAutoTrigger();

  // Navigate to review session
  const handleStartReview = () => {
    // Navigate to first deck with due cards, or decks page
    const deckWithDue = decks.find(
      (d) => (d.progress?.cardsReview ?? 0) > 0 || d.progress?.status === 'in-progress'
    );
    if (deckWithDue) {
      // Culture decks go to /culture/{id}/practice, vocabulary decks go to /decks/{id}/practice
      const isCultureDeck = deckWithDue.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${deckWithDue.id}/practice`);
      } else {
        navigate(`/decks/${deckWithDue.id}/practice`);
      }
    } else if (decks.length > 0) {
      const firstDeck = decks[0];
      const isCultureDeck = firstDeck.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${firstDeck.id}/practice`);
      } else {
        navigate(`/decks/${firstDeck.id}/practice`);
      }
    } else {
      navigate('/decks');
    }
  };

  // Navigate to deck study - memoized for stable reference
  const handleContinueDeck = useCallback(
    (deckId: string) => {
      const deck = decks.find((d) => d.id === deckId);
      // Culture decks go to /culture/{id}/practice, vocabulary decks go to /decks/{id}/practice
      const isCultureDeck = deck?.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${deckId}/practice`);
      } else {
        navigate(`/decks/${deckId}/practice`);
      }
    },
    [decks, navigate]
  );

  // Situations comprehension — used for the "Recently added" strip (DASH2-01-05)
  const { data: comprehension } = useQuery({
    queryKey: ['situations-comprehension'],
    queryFn: () => situationAPI.getComprehension(),
    retry: false,
    staleTime: 60_000,
  });
  const whatsNewCount = comprehension?.whats_new_count ?? 0;

  // ── NEW queries for the unified feed (DASH2-01-06) ─────────────────────────

  // Dashboard news items (same source as removed NewsSection — 6 items for the feed)
  const { data: newsData } = useQuery({
    queryKey: ['dashboard-news'],
    queryFn: () => adminAPI.getNewsItems(1, 6),
    staleTime: 60_000,
    retry: false,
  });

  // Learner situations for feed situation card
  const { data: situationsData } = useQuery({
    queryKey: ['situations', 1, '', false],
    queryFn: () => situationAPI.getList({ page: 1, page_size: 6 }),
    staleTime: 60_000,
    retry: false,
  });

  // Exercise queue count for quick-practice card
  const { data: exerciseQueueData } = useQuery({
    queryKey: ['exercise-queue'],
    queryFn: () => exerciseAPI.getQueue({}),
    staleTime: 60_000,
    retry: false,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const isLoading = analyticsLoading || decksLoading;
  const userName = user?.name || user?.email?.split('@')[0] || 'Learner';
  const cardsDue = analyticsData?.today?.cardsDue ?? 0;
  const minutesToday = Math.round((analyticsData?.today?.studyTimeSeconds ?? 0) / 60);
  const deckCount = decks.filter((d) => (d.progress?.dueToday ?? 0) > 0).length;
  const currentStreak = analyticsData?.streak?.currentStreak ?? 0;
  const longestStreak = analyticsData?.streak?.longestStreak ?? 0;

  // Mastered count — lifted to top level so both isNewUser predicate and MetricStrip
  // share ONE derivation (prevents drift between the gate condition and the tile).
  const mastered = analyticsData
    ? masteredCount({
        new: analyticsData.wordStatus.new ?? 0,
        learning: analyticsData.wordStatus.learning,
        review: analyticsData.wordStatus.review,
        mastered: analyticsData.wordStatus.mastered,
      })
    : 0;

  // New-user gate — false during load or analytics error (anti-flash guard).
  // Decision: Feed is hidden entirely when isNew because composeFeed always emits
  // a wordOfDay card and pickResumeDeck returns decks[0] at zero progress,
  // which would show a bogus "Resume deck" card to a brand-new user.
  const isNew =
    !isLoading && !!analyticsData && isNewUser({ cardsDue, currentStreak, mastered, decks });

  // Unified feed — client-side composition in fixed priority order
  const feedItems = useMemo(
    () =>
      composeFeed({
        decks,
        cardsDue,
        currentStreak,
        longestStreak,
        news: newsData?.items ?? [],
        situations: situationsData?.items ?? [],
        queueCount: exerciseQueueData?.total_in_queue ?? 0,
      }),
    [decks, cardsDue, currentStreak, longestStreak, newsData, situationsData, exerciseQueueData]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8" data-testid="dashboard">
      {/* Greeting bar (DASH2-01-02) */}
      <DashboardGreeting
        userName={userName}
        cardsDue={cardsDue}
        deckCount={deckCount}
        minutesToday={minutesToday}
        recentActivity={analyticsData?.recentActivity ?? []}
      />

      {/* Hero entry cards (DASH2-01-03) OR new-user starter view (DASH2-01-07).
          Skeleton while loading: isNew is only known once analytics+decks resolve,
          so without this the page would render the returning layout (hero cards +
          feed) first and then swap a new user to StarterView — a visible redraw.
          Reserving the hero space with a skeleton until isLoading clears removes
          the swap (skeleton → correct final layout). */}
      {isLoading ? (
        <div className="db-hero" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-60 rounded-2xl" />
          ))}
        </div>
      ) : isNew ? (
        <StarterView />
      ) : (
        <HeroEntries
          decks={decks}
          cardsDue={cardsDue}
          deckCount={deckCount}
          minutesToday={minutesToday}
          streak={currentStreak}
          onResumeDeck={handleContinueDeck}
          onStartReview={handleStartReview}
          onBrowseDecks={() => navigate('/decks')}
        />
      )}

      {/* Recently added strip (DASH2-01-05) — only once loaded as a returning user
          (gated on !isLoading so it doesn't show-then-hide during the load window). */}
      {!isLoading && !isNew && <WhatsNewStrip whatsNewCount={whatsNewCount} />}

      {/* Metrics Grid — ALWAYS rendered (shows zeros for new users) */}
      <section data-testid="metrics-section">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : analyticsError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {t('dashboard.progress.error')}
          </div>
        ) : analyticsData ? (
          <MetricStrip
            dueToday={analyticsData.today?.cardsDue ?? 0}
            currentStreak={analyticsData.streak.currentStreak}
            longestStreak={analyticsData.streak.longestStreak}
            mastered={mastered}
            allTimeLabel={formatStudyTime(analyticsData.summary.totalTimeStudied)}
          />
        ) : (
          <div className="hairline rounded-lg border p-4 text-center text-muted-foreground">
            {t('dashboard.progress.empty')}
          </div>
        )}
      </section>

      {/* Unified feed (DASH2-01-06) — only once loaded as a returning user.
          Hidden for new users (DASH2-01-07): composeFeed always emits a wordOfDay
          card and pickResumeDeck returns decks[0] at zero progress → bogus
          "Resume deck". Gated on !isLoading too so it doesn't show-then-hide. */}
      {!isLoading && !isNew && (
        <Feed
          items={feedItems}
          onOpenDeck={handleContinueDeck}
          onStartReview={handleStartReview}
          onStartQuick={() => navigate('/practice/exercises')}
        />
      )}
    </div>
  );
};
