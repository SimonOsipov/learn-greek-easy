import React, { useCallback, useEffect, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { HeroEntries } from '@/components/dashboard/HeroEntries';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { NewsSection } from '@/components/dashboard/NewsSection';
import { WhatsNewStrip } from '@/components/dashboard/WhatsNewStrip';
import { DeckCard } from '@/components/display/DeckCard';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTourAutoTrigger } from '@/hooks/useTourAutoTrigger';
import { getLocalizedDeckDescription, getLocalizedDeckName } from '@/lib/deckLocale';
import { reportAPIError } from '@/lib/errorReporting';
import { masteredCount } from '@/lib/progressGlossary';
import { formatStudyTime } from '@/lib/timeFormatUtils';
import { situationAPI } from '@/services/situationAPI';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

/**
 * Dashboard Page
 *
 * Main user dashboard showing:
 * - Welcome section with streak and due cards
 * - Key metrics (due today, streak, mastered, time)
 * - Progress charts (line, area, bar, pie)
 * - Active decks
 *
 * Uses real backend API data via useAnalytics() and deckStore.
 */
export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation('common');
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

  // Get active decks (in-progress or with progress) - memoized
  const activeDecks = useMemo(
    () =>
      decks.filter(
        (deck) => deck.progress?.status === 'in-progress' || (deck.progress?.cardsReview ?? 0) > 0
      ),
    [decks]
  );

  // Memoize deck card data transformation to avoid inline objects in render
  const deckCardsData = useMemo(
    () =>
      activeDecks.map((deck) => ({
        id: deck.id,
        title: getLocalizedDeckName(deck, i18n.language),
        description: getLocalizedDeckDescription(deck, i18n.language) || deck.description,
        status: deck.progress?.status ?? 'not-started',
        level: deck.level,
        progress: {
          current: (deck.progress?.cardsLearning ?? 0) + (deck.progress?.cardsMastered ?? 0),
          total: deck.cardCount,
          percentage:
            deck.progress && deck.progress.cardsTotal > 0
              ? Math.round(
                  ((deck.progress.cardsLearning + deck.progress.cardsMastered) /
                    deck.progress.cardsTotal) *
                    100
                )
              : 0,
        },
        stats: {
          due: deck.progress?.dueToday ?? 0,
          mastered: deck.progress?.cardsMastered ?? 0,
          learning: deck.progress?.cardsLearning ?? 0,
        },
        lastStudied: deck.progress?.lastStudied,
        isCulture: deck.category === 'culture',
        coverImageUrl: deck.coverImageUrl,
      })),
    [activeDecks, i18n.language]
  );

  // Loading state
  const isLoading = analyticsLoading || decksLoading;

  // Get user display name
  const userName = user?.name || user?.email?.split('@')[0] || 'Learner';

  // Greeting bar derived values from analytics.today (may be undefined if data not loaded)
  const cardsDue = analyticsData?.today?.cardsDue ?? 0;
  const minutesToday = Math.round((analyticsData?.today?.studyTimeSeconds ?? 0) / 60);

  // Number of decks with at least one card due today
  const deckCount = decks.filter((d) => (d.progress?.dueToday ?? 0) > 0).length;

  // Current streak (real data from analytics)
  const streak = analyticsData?.streak?.currentStreak ?? 0;

  // Situations comprehension — used for the "Recently added" strip (DASH2-01-05)
  const { data: comprehension } = useQuery({
    queryKey: ['situations-comprehension'],
    queryFn: () => situationAPI.getComprehension(),
    retry: false,
    staleTime: 60_000,
  });
  const whatsNewCount = comprehension?.whats_new_count ?? 0;

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

      {/* Hero entry cards (DASH2-01-03) */}
      <HeroEntries
        decks={decks}
        cardsDue={cardsDue}
        deckCount={deckCount}
        minutesToday={minutesToday}
        streak={streak}
        onResumeDeck={handleContinueDeck}
        onStartReview={handleStartReview}
        onBrowseDecks={() => navigate('/decks')}
      />

      {/* Recently added strip (DASH2-01-05) */}
      <WhatsNewStrip whatsNewCount={whatsNewCount} />

      {/* Metrics Grid */}
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
            mastered={masteredCount({
              new: analyticsData.wordStatus.new ?? 0,
              learning: analyticsData.wordStatus.learning,
              review: analyticsData.wordStatus.review,
              mastered: analyticsData.wordStatus.mastered,
            })}
            allTimeLabel={formatStudyTime(analyticsData.summary.totalTimeStudied)}
          />
        ) : (
          <div className="hairline rounded-lg border p-4 text-center text-muted-foreground">
            {t('dashboard.progress.empty')}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* News Section */}
      <NewsSection />

      {/* Active Decks Section */}
      <section>
        <p className="kicker mb-2">{t('dashboard.activeDecks.kicker')}</p>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('dashboard.activeDecks.title')}
          </h2>
          <Link to="/decks" className="text-sm text-primary hover:underline">
            {t('dashboard.activeDecks.viewAll')} →
          </Link>
        </div>
        {decksLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : deckCardsData.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deckCardsData.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onContinue={() => handleContinueDeck(deck.id)} />
            ))}
          </div>
        ) : (
          <div className="hairline rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">{t('dashboard.activeDecks.empty')}</p>
            <Link to="/decks" className="mt-4 inline-block text-sm text-primary hover:underline">
              {t('dashboard.activeDecks.browseDecks')} →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};
