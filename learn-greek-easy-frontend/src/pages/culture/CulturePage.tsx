// src/pages/culture/CulturePage.tsx

import React, { useEffect, useState } from 'react';

import { AlertCircle, BookOpen, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { DecksGrid } from '@/components/decks/DecksGrid';
import { EmptyState } from '@/components/feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { transformCultureDeckResponse } from '@/lib/cultureDeckTransform';
import { reportAPIError } from '@/lib/errorReporting';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { Deck } from '@/types/deck';

export const CulturePage: React.FC = () => {
  const { t } = useTranslation('culture');
  const location = useLocation();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    cultureDeckAPI
      .getList()
      .then((res) => {
        if (cancelled) return;
        setDecks(res.decks.map(transformCultureDeckResponse));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        reportAPIError(err, { operation: 'fetchCultureDecks', endpoint: '/api/v1/culture/decks' });
        setError(err instanceof Error ? err.message : 'Failed to load culture decks.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location.key]); // refetch on nav-back, mirroring DecksPage

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="culture-title"
        >
          {t('list.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{t('list.subtitle')}</p>
      </div>

      {/* Mock-exam CTA — renders unconditionally above the deck grid */}
      <Card className="mb-6 sm:mb-8" data-testid="culture-mock-exam-cta">
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl">
                {t('page.mockExamCta.title', 'Take the mock exam')}
              </CardTitle>
              <CardDescription>
                {t(
                  'page.mockExamCta.description',
                  'Test yourself across all culture decks in one timed mock exam.'
                )}
              </CardDescription>
            </div>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto sm:shrink-0">
            <Link to="/practice/culture-exam">{t('page.mockExamCta.cta', 'Take mock exam')}</Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('list.errorLoading')}</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                cultureDeckAPI
                  .getList()
                  .then((res) => {
                    setDecks(res.decks.map(transformCultureDeckResponse));
                  })
                  .catch((err: unknown) => {
                    reportAPIError(err, {
                      operation: 'fetchCultureDecks',
                      endpoint: '/api/v1/culture/decks',
                    });
                    setError(err instanceof Error ? err.message : 'Failed to load culture decks.');
                  })
                  .finally(() => {
                    setIsLoading(false);
                  });
              }}
              className="mt-3 block"
            >
              {t('list.tryAgain')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && !error && <DeckGridSkeleton />}

      {/* Decks Grid */}
      {!isLoading && !error && decks.length > 0 && (
        <DecksGrid decks={decks} ariaLabel={t('list.ariaLabel')} />
      )}

      {/* Empty State */}
      {!isLoading && !error && decks.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
        />
      )}
    </div>
  );
};

// Loading skeleton components
const DeckCardSkeleton: React.FC = () => {
  const { t } = useTranslation('deck');
  return (
    <div
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      role="status"
      aria-label={t('skeleton.loadingCard')}
    >
      <Skeleton className="h-1 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
};

const DeckGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <DeckCardSkeleton key={i} />
    ))}
  </div>
);
