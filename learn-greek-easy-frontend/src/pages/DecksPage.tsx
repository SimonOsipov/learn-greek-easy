// /src/pages/DecksPage.tsx

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDeckStore } from '@/stores/deckStore';
import { DecksGrid } from '@/components/decks/DecksGrid';
import { DeckFilters } from '@/components/decks/DeckFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, BookOpen } from 'lucide-react';

export const DecksPage: React.FC = () => {
  const {
    decks,
    filters,
    isLoading,
    error,
    fetchDecks,
    setFilters,
    clearFilters,
    clearError,
  } = useDeckStore();
  const location = useLocation();

  // Fetch decks on mount and when navigating back from detail page
  useEffect(() => {
    fetchDecks().catch((err) => {
      console.error('Failed to fetch decks:', err);
    });
  }, [fetchDecks, location.key]); // location.key changes on navigation

  // Calculate total decks (would come from API in real implementation)
  const totalDecks = 6; // Mock value - in production, fetch from API

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      {/* Page Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">
          Available Decks
        </h1>
        <p className="mt-2 text-sm text-gray-600 md:text-base">
          Choose a deck to start learning Greek vocabulary
        </p>
      </div>

      {/* Filters */}
      <DeckFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        totalDecks={totalDecks}
        filteredDecks={decks.length}
      />

      {/* Error State */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900">Error Loading Decks</h3>
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
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && <DeckGridSkeleton />}

      {/* Decks Grid */}
      {!isLoading && !error && decks.length > 0 && (
        <DecksGrid decks={decks} />
      )}

      {/* Empty State */}
      {!isLoading && !error && decks.length === 0 && (
        <EmptyState onClearFilters={clearFilters} />
      )}
    </div>
  );
};

// Loading skeleton component
const DeckGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Card key={i} className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2 pt-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

// Empty state component
interface EmptyStateProps {
  onClearFilters: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onClearFilters }) => (
  <Card className="mx-auto max-w-md p-8 text-center">
    <div className="flex justify-center">
      <BookOpen className="h-16 w-16 text-gray-400" />
    </div>
    <h3 className="mt-4 text-lg font-semibold text-gray-900">
      No Decks Found
    </h3>
    <p className="mt-2 text-sm text-gray-600">
      No decks match your current filters. Try adjusting your search or
      clearing filters.
    </p>
    <Button variant="secondary" onClick={onClearFilters} className="mt-4">
      Clear All Filters
    </Button>
  </Card>
);
