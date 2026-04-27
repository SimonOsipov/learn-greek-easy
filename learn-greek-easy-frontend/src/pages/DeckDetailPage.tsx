// src/pages/DeckDetailPage.tsx

import React, { useEffect, useState } from 'react';

import { AlertCircle, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { V2DeckPage } from '@/features/decks/components/V2DeckPage';
import { reportAPIError } from '@/lib/errorReporting';
import { useDeckStore } from '@/stores/deckStore';

export const DeckDetailPage: React.FC = () => {
  const { id: deckId } = useParams<{ id: string }>();

  const { selectedDeck, isLoading, error, selectDeck } = useDeckStore();

  // Track whether we've initiated a fetch for this deck
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch deck on mount and when deckId changes
  useEffect(() => {
    if (deckId) {
      setHasFetched(false);
      selectDeck(deckId)
        .catch((err) => {
          reportAPIError(err, { operation: 'loadDeck', endpoint: `/decks/${deckId}` });
        })
        .finally(() => {
          setHasFetched(true);
        });
    }

    // NOTE: Cleanup (clearSelection) is intentionally NOT included here.
    // V2DeckPage reuses the same deck from the store and handles its own cleanup.
  }, [deckId, selectDeck]);

  // Handle invalid deckId (not provided)
  if (!deckId) {
    return <NotFoundState />;
  }

  // Loading state - show skeleton until we've fetched AND loading is complete
  if (isLoading || !hasFetched) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => selectDeck(deckId)} />;
  }

  // Not found state (deck doesn't exist - only show after we've actually fetched)
  if (!selectedDeck) {
    return <NotFoundState />;
  }

  // All decks are V2 — render V2DeckPage
  return <V2DeckPage deckId={deckId} />;
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-32" />
      </div>
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </Card>
    </div>
  );
};

// Error State Component
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useTranslation('deck');

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('detail.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
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

// Not Found State Component
const NotFoundState: React.FC = () => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button onClick={() => navigate('/decks')}>{t('detail.browseAll')}</Button>
        </CardContent>
      </Card>
    </div>
  );
};
