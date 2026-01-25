import React, { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { NewsSection } from '@/components/dashboard/NewsSection';
import { DeckCard } from '@/components/display/DeckCard';
import { MetricCard } from '@/components/display/MetricCard';
import { WelcomeSection } from '@/components/display/WelcomeSection';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { formatStudyTime } from '@/lib/timeFormatUtils';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';
import type { Metric } from '@/types/dashboard';

/**
 * Dashboard Page
 *
 * Main user dashboard showing:
 * - Welcome section with streak and due cards
 * - Key metrics (due today, streak, mastered, accuracy, time)
 * - Progress charts (line, area, bar, pie)
 * - Active decks
 *
 * Uses real backend API data via analyticsStore and deckStore.
 */
export const Dashboard: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  // Auth state
  const user = useAuthStore((state) => state.user);

  // Analytics data (auto-loads on mount)
  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
  } = useAnalytics(true);

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

  // Memoized navigation handler for decks page
  const handleNavigateToDecks = useCallback(() => {
    navigate('/decks');
  }, [navigate]);

  // Navigate to review session
  const handleStartReview = () => {
    // Navigate to first deck with due cards, or decks page
    const deckWithDue = decks.find(
      (d) => (d.progress?.cardsReview ?? 0) > 0 || d.progress?.status === 'in-progress'
    );
    if (deckWithDue) {
      // Culture decks go to /culture/{id}/practice, vocabulary decks go to /decks/{id}/review
      const isCultureDeck = deckWithDue.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${deckWithDue.id}/practice`);
      } else {
        navigate(`/decks/${deckWithDue.id}/review`);
      }
    } else if (decks.length > 0) {
      const firstDeck = decks[0];
      const isCultureDeck = firstDeck.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${firstDeck.id}/practice`);
      } else {
        navigate(`/decks/${firstDeck.id}/review`);
      }
    } else {
      navigate('/decks');
    }
  };

  // Navigate to deck study - memoized for stable reference
  const handleContinueDeck = useCallback(
    (deckId: string) => {
      const deck = decks.find((d) => d.id === deckId);
      // Culture decks go to /culture/{id}/practice, vocabulary decks go to /decks/{id}/review
      const isCultureDeck = deck?.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/${deckId}/practice`);
      } else {
        navigate(`/decks/${deckId}/review`);
      }
    },
    [decks, navigate]
  );

  // Build metrics from analytics data (memoized)
  const metrics = useMemo((): Metric[] => {
    if (!analyticsData) {
      return [];
    }

    const { summary, streak, wordStatus } = analyticsData;

    // Calculate due cards from word status
    const dueToday = wordStatus.learning + wordStatus.review;

    return [
      {
        id: '1',
        label: t('dashboard.metrics.dueToday'),
        value: dueToday,
        sublabel: t('dashboard.metrics.cardsToReview'),
        color: 'primary',
        icon: '📚',
      },
      {
        id: '2',
        label: t('dashboard.metrics.currentStreak'),
        value: streak.currentStreak,
        sublabel: t('dashboard.metrics.days'),
        color: 'orange',
        icon: '🔥',
      },
      {
        id: '3',
        label: t('dashboard.metrics.mastered'),
        value: wordStatus.mastered,
        sublabel: t('dashboard.metrics.wordsTotal'),
        color: 'green',
        icon: '✅',
      },
      {
        id: '4',
        label: t('dashboard.metrics.accuracy'),
        value: `${Math.round(summary.averageAccuracy)}%`,
        sublabel: analyticsData.dateRange.label.toLowerCase(),
        color: 'blue',
        icon: '🎯',
      },
      {
        id: '5',
        label: t('dashboard.metrics.totalTime'),
        value: formatStudyTime(summary.totalTimeStudied),
        sublabel: t('dashboard.metrics.allTime'),
        color: 'muted',
        icon: '⏱️',
      },
    ];
  }, [analyticsData, t]);

  // formatStudyTime is now imported from '@/lib/timeFormatUtils' with day support

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
        title: deck.titleGreek || deck.title,
        description: deck.description,
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
      })),
    [activeDecks]
  );

  // Loading state
  const isLoading = analyticsLoading || decksLoading;

  // Get user display name
  const userName = user?.name || user?.email?.split('@')[0] || 'Learner';

  // Get due count for welcome section
  const dueCount = analyticsData
    ? analyticsData.wordStatus.learning + analyticsData.wordStatus.review
    : 0;

  // Get streak for welcome section
  const currentStreak = analyticsData?.streak.currentStreak || 0;

  return (
    <div className="space-y-6 pb-8" data-testid="dashboard">
      {/* Page Title - visible for accessibility and E2E tests */}
      <h1
        className="text-2xl font-semibold text-foreground md:text-3xl"
        data-testid="dashboard-title"
      >
        {t('dashboard.title')}
      </h1>

      {/* Welcome Section */}
      <WelcomeSection
        userName={userName}
        dueCount={dueCount}
        streak={currentStreak}
        onStartReview={handleStartReview}
      />

      {/* Metrics Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('dashboard.progress.title')}
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : analyticsError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {t('dashboard.progress.error')}
          </div>
        ) : metrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                {...metric}
                tooltip={t('dashboard.metrics.tooltip', { label: metric.label.toLowerCase() })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-muted p-4 text-center text-muted-foreground">
            {t('dashboard.progress.empty')}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* News Section */}
      <NewsSection />

      {/* Active Decks Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('dashboard.activeDecks.title')}
          </h2>
          <button className="text-sm text-primary hover:underline" onClick={handleNavigateToDecks}>
            {t('dashboard.activeDecks.viewAll')} →
          </button>
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
          <div className="rounded-lg border border-muted p-8 text-center">
            <p className="text-muted-foreground">{t('dashboard.activeDecks.empty')}</p>
            <button
              className="mt-4 text-sm text-primary hover:underline"
              onClick={handleNavigateToDecks}
            >
              {t('dashboard.activeDecks.browseDecks')} →
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
