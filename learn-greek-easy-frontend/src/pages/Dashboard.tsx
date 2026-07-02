import React, { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { Feed } from '@/components/dashboard/Feed';
import { HeroEntries } from '@/components/dashboard/HeroEntries';
import { toDashboardDecks } from '@/components/dashboard/lib/summaryDeckAdapter';
import { mapSummaryFeed } from '@/components/dashboard/lib/summaryFeed';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { StarterView } from '@/components/dashboard/StarterView';
import { WhatsNewStrip } from '@/components/dashboard/WhatsNewStrip';
// The resume-hero cover stack renders DxCover, whose styles live in dx.css.
// dx.css must be imported by the route module (not the dx barrel — Vite doesn't
// reliably inject the barrel's CSS chunk), or the cover tiles render unstyled.
import '@/features/decks/dx/dx.css';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { useTourAutoTrigger } from '@/hooks/useTourAutoTrigger';
import { formatStudyTime } from '@/lib/timeFormatUtils';
import { useAuthStore } from '@/stores/authStore';

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

  // Dashboard summary (PERF-15) — SOLE data source for the page: greeting
  // stats, metric strip, week-heat, hero (resume/daily-goal ring), decks and
  // the unified feed. PERF-15-06 removed the last per-page fetches (the
  // deckStore warm + 4 feed-source queries below) — this is now the ONE
  // call the dashboard's cold load makes.
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary();

  useTourAutoTrigger();

  // Deck slices from the summary, adapted onto the legacy Deck shape that
  // HeroEntries and the nav handlers below consume.
  const summaryDecks = useMemo(() => toDashboardDecks(summary?.decks ?? []), [summary]);

  // Navigate to review session
  const handleStartReview = () => {
    // Navigate to first deck with due cards, or decks page
    const deckWithDue = summaryDecks.find(
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
    } else if (summaryDecks.length > 0) {
      const firstDeck = summaryDecks[0];
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
      const deck = summaryDecks.find((d) => d.id === deckId);
      // Culture decks go to /culture/{id}/practice, vocabulary decks go to /decks/{id}/practice
      const isCultureDeck = deck?.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${deckId}/practice`);
      } else {
        navigate(`/decks/${deckId}/practice`);
      }
    },
    [summaryDecks, navigate]
  );

  // ── Derived values ─────────────────────────────────────────────────────────

  // Summary must resolve before the page can render its final layout — it's
  // now the sole source for every metric tile, including MetricStrip's
  // all-time study-time tile (PERF-15-05 follow-up).
  const isLoading = summaryLoading;
  const userName = user?.name || user?.email?.split('@')[0] || 'Learner';
  const cardsDue = summary?.today?.cards_due ?? 0;
  const minutesToday = Math.round((summary?.today?.study_time_seconds ?? 0) / 60);
  const deckCount = summaryDecks.filter((d) => (d.progress?.dueToday ?? 0) > 0).length;
  const currentStreak = summary?.streak?.current_streak ?? 0;
  const longestStreak = summary?.streak?.longest_streak ?? 0;
  const mastered = summary?.mastered ?? 0;
  // "Recently added" strip count (DASH2-01-05) — was its own
  // situations-comprehension fetch; the summary DTO already carries it.
  const whatsNewCount = summary?.whats_new_count ?? 0;

  // New-user gate — server-authoritative (summary.is_new_user), false during
  // load (anti-flash guard). Decision: Feed is hidden entirely when isNew
  // because the server's compose_feed always emits a word_of_day item and
  // picks decks[0] at zero progress as resume, which would show a bogus
  // "Resume deck" card to a brand-new user.
  const isNew = !isLoading && !!summary && summary.is_new_user;

  // Unified feed — server-composed (dashboard_compose.py's compose_feed);
  // this only resolves deck_id references against summary.decks and
  // normalizes field names, it does NOT re-order or re-gate (PERF-15-06).
  const feedItems = useMemo(
    () => mapSummaryFeed(summary?.feed ?? [], summary?.decks ?? []),
    [summary]
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
            allTimeLabel={formatStudyTime(summary?.all_time_study_time_seconds ?? 0)}
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
          Hidden for new users (DASH2-01-07): compose_feed always emits a wordOfDay
          card and picks decks[0] at zero progress as resume → bogus
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
