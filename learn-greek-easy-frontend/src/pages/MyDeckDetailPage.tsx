// src/pages/MyDeckDetailPage.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, BookOpen, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { PageLoader } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trackMyDecksAccessDenied } from '@/lib/analytics/myDecksAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { APIRequestError } from '@/services/api';
import { deckAPI, type DeckDetailResponse } from '@/services/deckAPI';

export const MyDeckDetailPage: React.FC = () => {
  const { t } = useTranslation('deck');
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<DeckDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  const fetchDeck = useCallback(async () => {
    if (!deckId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await deckAPI.getById(deckId);
      setDeck(response);
    } catch (err) {
      // Handle 403 Forbidden specifically - show access denied dialog
      if (err instanceof APIRequestError && err.status === 403) {
        setShowAccessDenied(true);
        trackMyDecksAccessDenied({
          attempted_deck_id: deckId,
          redirect_destination: '/my-decks',
        });
        return;
      }

      // Handle other errors
      const errorMessage = err instanceof Error ? err.message : t('detail.error.description');
      setError(errorMessage);
      reportAPIError(err, { operation: 'fetchMyDeck', endpoint: `/decks/${deckId}` });
    } finally {
      setIsLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const handleAccessDeniedOk = () => {
    navigate('/my-decks', { replace: true });
  };

  const handleRetry = () => {
    setError(null);
    fetchDeck();
  };

  // Handle invalid deckId (not provided)
  if (!deckId) {
    return <NotFoundState />;
  }

  // Loading state
  if (isLoading) {
    return <PageLoader />;
  }

  // Error state (non-403 errors)
  if (error) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  // Not found state (deck doesn't exist)
  if (!deck && !showAccessDenied) {
    return <NotFoundState />;
  }

  return (
    <>
      {/* Access Denied Alert Dialog */}
      <AlertDialog
        open={showAccessDenied}
        onOpenChange={() => {}} // No-op for non-dismissible
        title={t('myDecks.accessDenied.title')}
        description={t('myDecks.accessDenied.message')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('myDecks.accessDenied.ok'),
            onClick: handleAccessDeniedOk,
            variant: 'default',
          },
        ]}
      />

      {/* Page Content - shown when deck is loaded successfully */}
      {deck && (
        <div data-testid="my-deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
          {/* Breadcrumb Navigation */}
          <nav
            data-testid="breadcrumb"
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              to="/my-decks"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('myDecks.title')}
            </Link>
            <span>/</span>
            <span className="truncate font-medium text-foreground">{deck.name}</span>
          </nav>

          {/* Deck Content Placeholder - actual deck detail implementation would go here */}
          <Card>
            <CardContent className="py-8 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h1 className="mb-2 text-xl font-semibold text-foreground">{deck.name}</h1>
              {deck.description && (
                <p className="text-sm text-muted-foreground">{deck.description}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t('detail.error.failedToLoad')}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">{error}</p>
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button onClick={() => navigate('/my-decks')}>{t('myDecks.title')}</Button>
        </CardContent>
      </Card>
    </div>
  );
};
