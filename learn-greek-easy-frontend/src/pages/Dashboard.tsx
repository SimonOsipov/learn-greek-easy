import React, { useCallback, useEffect, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { Feed } from '@/components/dashboard/Feed';
import { HeroEntries } from '@/components/dashboard/HeroEntries';
import { composeFeed } from '@/components/dashboard/lib/composeFeed';
import { toDashboardDecks } from '@/components/dashboard/lib/summaryDeckAdapter';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { StarterView } from '@/components/dashboard/StarterView';
import { WhatsNewStrip } from '@/components/dashboard/WhatsNewStrip';
// The resume-hero cover stack renders DxCover, whose styles live in dx.css.
// dx.css must be imported by the route module (not the dx barrel — Vite doesn't
// reliably inject the barrel's CSS chunk), or the cover tiles render unstyled.
import '@/features/decks/dx/dx.css';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { useTourAutoTrigger } from '@/hooks/useTourAutoTrigger';
import { reportAPIError } from '@/lib/errorReporting';
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

  // Dashboard summary (PERF-15) — single-call source for greeting stats,
  // metric strip, week-heat, hero (resume/daily-goal ring) and deck data.
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary();

  // Analytics — kept ONLY for MetricStrip's all-time study-time tile
  // (analyticsData.summary.totalTimeStudied — a genuine DTO gap: it is NOT
  // one of the 5 documented "unwired null" slots on DashboardSummaryResponse,
  // it's simply absent) and for useTourAutoTrigger's readiness signal.
  // PERF-15-06 says it removes this call from the dashboard entirely — that
  // requires either extending the summary DTO with a lifetime-time-studied
  // field first, or accepting the all-time tile stays on `useAnalytics`.
  const { data: analyticsData, loading: analyticsLoading } = useAnalytics();

  // Deck data — deckStore is still warmed/read here for the resume/open-deck
  // navigation handlers below (culture vs vocabulary routing); rendering
  // (greeting/metrics/hero/feed) now reads `summary.decks` instead. Removing
  // this store dependency + the ensureDecksFresh() warm is PERF-15-06.
  const decks = useDeckStore((state) => state.decks);
  const ensureDecksFresh = useDeckStore((state) => state.ensureDecksFresh);

  // Warm/refresh decks on mount. ensureDecksFresh de-dupes with the app-init
  // warm (ProtectedRoute) and paints instantly from the persisted cover cache.
  useEffect(() => {
    ensureDecksFresh().catch((error) => {
      reportAPIError(error, { operation: 'ensureDecksFresh', endpoint: '/decks' });
    });
  }, [ensureDecksFresh]);

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

  // Summary must resolve before the page can render its final layout;
  // analytics is also awaited since MetricStrip's all-time tile still reads
  // it (see the `useAnalytics` comment above).
  const isLoading = summaryLoading || analyticsLoading;
  const userName = user?.name || user?.email?.split('@')[0] || 'Learner';
  const cardsDue = summary?.today?.cards_due ?? 0;
  const minutesToday = Math.round((summary?.today?.study_time_seconds ?? 0) / 60);
  // Deck slices from the summary, adapted onto the legacy Deck shape that
  // HeroEntries/composeFeed consume (PERF-15-06 removes this adapter).
  const summaryDecks = useMemo(() => toDashboardDecks(summary?.decks ?? []), [summary]);
  const deckCount = summaryDecks.filter((d) => (d.progress?.dueToday ?? 0) > 0).length;
  const currentStreak = summary?.streak?.current_streak ?? 0;
  const longestStreak = summary?.streak?.longest_streak ?? 0;
  const mastered = summary?.mastered ?? 0;

  // New-user gate — server-authoritative (summary.is_new_user), false during
  // load (anti-flash guard). Decision: Feed is hidden entirely when isNew
  // because composeFeed always emits a wordOfDay card and pickResumeDeck
  // returns decks[0] at zero progress, which would show a bogus "Resume
  // deck" card to a brand-new user.
  const isNew = !isLoading && !!summary && summary.is_new_user;

  // Unified feed — client-side composition in fixed priority order, fed from
  // the summary's deck slices (PERF-15-06 replaces this with summary.feed).
  const feedItems = useMemo(
    () =>
      composeFeed({
        decks: summaryDecks,
        cardsDue,
        currentStreak,
        longestStreak,
        news: newsData?.items ?? [],
        situations: situationsData?.items ?? [],
        queueCount: exerciseQueueData?.total_in_queue ?? 0,
      }),
    [
      summaryDecks,
      cardsDue,
      currentStreak,
      longestStreak,
      newsData,
      situationsData,
      exerciseQueueData,
    ]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8" data-testid="dashboard">
      {/* Greeting bar (DASH2-01-02) */}
      <DashboardGreeting
        userName={userName}
        cardsDue={cardsDue}
        deckCount={deckCount}
        minutesToday={minutesToday}
        weekHeat={summary?.week_heat}
        isLoading={isLoading}
      />

      {/* Hero entry cards (DASH2-01-03) OR new-user starter view (DASH2-01-07).
          Skeleton while loading: isNew is only known once the summary resolves,
          so without this the page would render the returning layout (hero cards +
          feed) first and then swap a new user to StarterView — a visible redraw.
          Reserving the hero space with a skeleton until isLoading clears removes
          the swap (skeleton → correct final layout). */}
      {isLoading ? (
        <div className="db-hero" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="db-skel is-entry" />
          ))}
        </div>
      ) : isNew ? (
        <StarterView />
      ) : (
        <HeroEntries
          decks={summaryDecks}
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="db-skel is-metric" />
            ))}
          </div>
        ) : summaryError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {t('dashboard.progress.error')}
          </div>
        ) : summary ? (
          <MetricStrip
            dueToday={cardsDue}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            mastered={mastered}
            allTimeLabel={formatStudyTime(analyticsData?.summary.totalTimeStudied ?? 0)}
          />
        ) : (
          <div className="hairline rounded-lg border p-4 text-center text-muted-foreground">
            {t('dashboard.progress.empty')}
          </div>
        )}
      </section>

      {/* Feed skeleton (loading) — outline cards for the WHOLE feed so the full
          page reads as loading, not just hero + metrics. Mirrors the real 12-col
          feed: 1 hero (span-12) + side/compact cells (span-4). Only the border
          pulses (see .db-skel in index.css). */}
      {isLoading && (
        <section aria-hidden="true" data-testid="feed-skeleton">
          <div className="db-feed">
            <div className="db-skel is-hero" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="db-skel is-cell" />
            ))}
          </div>
        </section>
      )}

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
