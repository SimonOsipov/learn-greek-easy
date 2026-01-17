// src/pages/MyDeckDetailPage.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, BookOpen, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { UserDeckEditModal } from '@/components/decks';
import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { PageLoader } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  trackMyDecksAccessDenied,
  trackMyDecksEditDeckClicked,
  trackMyDecksDeleteDeckClicked,
  trackMyDecksDeckDeleted,
  trackUserDeckDeleteStarted,
  trackUserDeckDeleteCancelled,
} from '@/lib/analytics/myDecksAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { APIRequestError } from '@/services/api';
import { deckAPI, type DeckDetailResponse, type DeckLevel } from '@/services/deckAPI';

export const MyDeckDetailPage: React.FC = () => {
  const { t } = useTranslation('deck');
  const { toast } = useToast();
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<DeckDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Edit deck handlers
  const handleEditClick = () => {
    if (!deck) return;
    trackMyDecksEditDeckClicked({
      deck_id: deck.id,
      deck_name: deck.name,
    });
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
  };

  const handleDeckUpdated = () => {
    fetchDeck();
    setIsEditModalOpen(false);
  };

  // Delete deck handlers
  const handleDeleteClick = () => {
    if (!deck) return;
    trackMyDecksDeleteDeckClicked({
      deck_id: deck.id,
      deck_name: deck.name,
    });
    trackUserDeckDeleteStarted({
      deck_id: deck.id,
      deck_name: deck.name,
      source: 'detail_page',
    });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deck) return;

    setIsDeleting(true);
    try {
      await deckAPI.deleteMyDeck(deck.id);
      trackMyDecksDeckDeleted({
        deck_id: deck.id,
        deck_name: deck.name,
      });
      toast({
        title: t('myDecks.deleteSuccess'),
      });
      navigate('/my-decks', { replace: true });
    } catch (err) {
      reportAPIError(err, { operation: 'deleteMyDeck', endpoint: `/decks/${deck.id}` });
      toast({
        title: t('myDecks.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (deck) {
      trackUserDeckDeleteCancelled({
        deck_id: deck.id,
        deck_name: deck.name,
        source: 'detail_page',
      });
    }
    setIsDeleteDialogOpen(false);
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
          <Card className="relative">
            {/* Action Buttons */}
            <div className="absolute right-4 top-4 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditClick}
                aria-label={t('myDecks.editDeck')}
                data-testid="deck-detail-edit-button"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                aria-label={t('myDecks.deleteDeck')}
                data-testid="deck-detail-delete-button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

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

      {/* Edit Deck Modal */}
      {deck && (
        <UserDeckEditModal
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          mode="edit"
          source="detail_page"
          deck={{
            id: deck.id,
            name: deck.name,
            description: deck.description,
            level: deck.level as DeckLevel,
          }}
          onSuccess={handleDeckUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        title={t('myDecks.delete.title')}
        description={t('myDecks.delete.message', { deckName: deck?.name })}
        confirmText={t('myDecks.delete.confirm')}
        cancelText={t('myDecks.delete.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="destructive"
        loading={isDeleting}
      />
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
