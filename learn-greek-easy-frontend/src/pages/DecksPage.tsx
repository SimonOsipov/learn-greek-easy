// /src/pages/DecksPage.tsx

import React, { useEffect } from 'react';

import { AlertCircle, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { DeckFilters } from '@/components/decks/DeckFilters';
import { DecksGrid } from '@/components/decks/DecksGrid';
import type { DeckType } from '@/components/decks/DeckTypeFilter';
import { CardSkeleton, EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { reportAPIError } from '@/lib/errorReporting';
import { useDeckStore } from '@/stores/deckStore';

export const DecksPage: React.FC = () => {
  const { t, i18n } = useTranslation('deck');
  const {
    decks,
    totalDecks,
    filters,
    isLoading,
    error,
    fetchDecks,
    setFilters,
    clearFilters,
    clearError,
  } = useDeckStore();
  const location = useLocation();

  // Fetch decks on mount, when navigating back from detail page, or when language changes
  useEffect(() => {
    fetchDecks().catch((err) => {
      reportAPIError(err, { operation: 'fetchDecks', endpoint: '/decks' });
    });
  }, [fetchDecks, location.key, i18n.language]);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="decks-title"
        >
          {t('list.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{t('list.subtitle')}</p>
      </div>

      {/* Filters */}
      <DeckFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        totalDecks={totalDecks}
        filteredDecks={decks.length}
        deckType={filters.deckType}
        onDeckTypeChange={(type: DeckType) => setFilters({ deckType: type })}
      />

      {/* Error State */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900">{t('list.errorLoading')}</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearError();
                  fetchDecks();
                }}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                {t('list.tryAgain')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && <DeckGridSkeleton />}

      {/* Decks Grid */}
      {!isLoading && !error && decks.length > 0 && <DecksGrid decks={decks} />}

      {/* Empty State */}
      {!isLoading && !error && decks.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t('list.noDecksFound')}
          description={t('list.noDecksDescription')}
          action={{
            label: t('list.clearFilters'),
            onClick: clearFilters,
            variant: 'secondary',
          }}
        />
      )}
    </div>
  );
};

// Loading skeleton component
const DeckGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
