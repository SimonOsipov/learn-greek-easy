// src/pages/AdminPage.tsx

import React, { useEffect, useState } from 'react';

import { AlertCircle, Database, Layers, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminAPI } from '@/services/adminAPI';
import type { ContentStatsResponse, DeckStats } from '@/services/adminAPI';

/**
 * CEFR level order for sorting decks
 */
const CEFR_LEVEL_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Get badge variant based on CEFR level
 * A1-B2: default (filled), C1-C2: outline
 */
function getLevelBadgeVariant(level: string): 'default' | 'secondary' | 'outline' {
  if (level === 'C1' || level === 'C2') {
    return 'outline';
  }
  if (level === 'A1' || level === 'A2') {
    return 'default';
  }
  return 'secondary';
}

/**
 * Loading skeleton for the admin page
 */
const AdminLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Summary Cards Skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Deck List Skeleton */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

/**
 * Error state component with retry button
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
  t: (key: string) => string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, isRetrying, t }) => (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{t('errors.loadingStats')}</AlertTitle>
    <AlertDescription className="mt-2">
      <p className="mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {t('actions.retrying')}
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('actions.retry')}
          </>
        )}
      </Button>
    </AlertDescription>
  </Alert>
);

/**
 * Summary card component for displaying a single stat
 */
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  testId?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, testId }) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </CardContent>
  </Card>
);

/**
 * Deck list item component
 */
interface DeckListItemProps {
  deck: DeckStats;
  t: (key: string, options?: { count: number }) => string;
}

const DeckListItem: React.FC<DeckListItemProps> = ({ deck, t }) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <div className="flex items-center gap-3">
      <Badge variant={getLevelBadgeVariant(deck.level)}>{deck.level}</Badge>
      <span className="font-medium">{deck.name}</span>
    </div>
    <span className="text-sm text-muted-foreground">
      {t('deck.cardCount', { count: deck.card_count })}
    </span>
  </div>
);

/**
 * Sort decks by CEFR level (A1 -> C2)
 */
function sortDecksByLevel(decks: DeckStats[]): DeckStats[] {
  return [...decks].sort((a, b) => {
    const levelA = CEFR_LEVEL_ORDER[a.level] ?? 99;
    const levelB = CEFR_LEVEL_ORDER[b.level] ?? 99;
    if (levelA !== levelB) {
      return levelA - levelB;
    }
    // Same level - sort by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Admin Page
 *
 * Displays content statistics for administrators:
 * - Summary cards with total decks and cards counts
 * - Deck list sorted by CEFR level with card counts
 *
 * Requires superuser authentication.
 */
const AdminPage: React.FC = () => {
  const { t } = useTranslation('admin');
  const [stats, setStats] = useState<ContentStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchStats = async () => {
    try {
      setError(null);
      const data = await adminAPI.getContentStats();
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setIsLoading(true);
    fetchStats();
  };

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-text-primary md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
        <AdminLoadingSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-text-primary md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
        <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} t={t} />
      </div>
    );
  }

  // Show empty state if no stats
  if (!stats) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-text-primary md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t('states.noStats')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedDecks = sortDecksByLevel(stats.decks);

  return (
    <div className="space-y-6 pb-8" data-testid="admin-page">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-text-primary md:text-3xl"
          data-testid="admin-title"
        >
          {t('page.title')}
        </h1>
        <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
          {t('page.subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          {t('sections.contentSummary')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title={t('stats.totalDecks')}
            value={stats.total_decks}
            icon={<Layers className="h-5 w-5 text-muted-foreground" />}
            testId="total-decks-card"
          />
          <SummaryCard
            title={t('stats.totalCards')}
            value={stats.total_cards}
            icon={<Database className="h-5 w-5 text-muted-foreground" />}
            testId="total-cards-card"
          />
        </div>
      </section>

      {/* Deck List */}
      <section aria-labelledby="decks-heading">
        <Card>
          <CardHeader>
            <CardTitle id="decks-heading" data-testid="decks-by-level-title">
              {t('sections.decksByLevel')}
            </CardTitle>
            <CardDescription data-testid="decks-by-level-description">
              {t('sections.decksByLevelDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedDecks.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">{t('states.noDecks')}</p>
            ) : (
              <div className="space-y-3">
                {sortedDecks.map((deck) => (
                  <DeckListItem key={deck.id} deck={deck} t={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AdminPage;
