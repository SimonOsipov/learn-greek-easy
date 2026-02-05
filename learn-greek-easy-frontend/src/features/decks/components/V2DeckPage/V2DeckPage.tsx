// src/features/decks/components/V2DeckPage/V2DeckPage.tsx

import React, { useEffect } from 'react';

import { AlertCircle, BookOpen, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { reportAPIError } from '@/lib/errorReporting';
import { useDeckStore } from '@/stores/deckStore';

import { V2DeckHeader } from './V2DeckHeader';
import { WordBrowser } from './WordBrowser';

/**
 * Props for V2DeckPage component.
 */
interface V2DeckPageProps {
  deckId: string;
}

/**
 * V2DeckPage Component
 *
 * Main page component for V2 decks (decks with word entries).
 * Displays deck header with metadata and a word entries browser.
 * Handles loading, error, and not found states.
 */
export const V2DeckPage: React.FC<V2DeckPageProps> = ({ deckId }) => {
  const { t } = useTranslation('deck');
  const { selectedDeck, isLoading, error, selectDeck, clearSelection } = useDeckStore();

  // Fetch deck on mount and when deckId changes
  useEffect(() => {
    if (deckId) {
      selectDeck(deckId).catch((err) => {
        reportAPIError(err, { operation: 'loadDeck', endpoint: `/decks/${deckId}` });
      });
    }

    // Cleanup: clear selection when component unmounts
    return () => {
      clearSelection();
    };
  }, [deckId, selectDeck, clearSelection]);

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => selectDeck(deckId)} />;
  }

  // Not found state (deck doesn't exist)
  if (!selectedDeck) {
    return <NotFoundState />;
  }

  return (
    <div data-testid="v2-deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Breadcrumb Navigation */}
      <nav
        data-testid="breadcrumb"
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <Link
          to="/decks"
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('detail.breadcrumb')}
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-foreground">{selectedDeck.titleGreek}</span>
      </nav>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <V2DeckHeader deck={selectedDeck} />

        {/* Word Browser Section */}
        <WordBrowser deckId={deckId} />
      </div>
    </div>
  );
};

/**
 * Loading Skeleton Component
 *
 * Displays a loading skeleton while deck data is being fetched.
 */
const LoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Breadcrumb Skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="mt-6 h-12 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Word Browser Skeleton */}
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center">
            <Skeleton className="mb-4 h-12 w-12 rounded-full" />
            <Skeleton className="mb-2 h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Error State Component
 *
 * Displays an error message with retry option.
 */
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useTranslation('deck');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('detail.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t('detail.error.failedToLoad')}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.error.description')}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              {t('detail.goBack')}
            </Button>
            <Button onClick={onRetry}>{t('detail.tryAgain')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Not Found State Component
 *
 * Displays a message when the deck doesn't exist.
 */
const NotFoundState: React.FC = () => {
  const { t } = useTranslation('deck');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button asChild>
            <Link to="/decks">{t('detail.browseAll')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
