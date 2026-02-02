// src/pages/MyDeckDetailPage.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, BookOpen, ChevronLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { UserDeckEditModal } from '@/components/decks';
import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { PageLoader } from '@/components/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserVocabularyCardCreateModal,
  UserVocabularyCardEditModal,
} from '@/components/vocabulary';
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
import { cardAPI, type CardResponse } from '@/services/cardAPI';
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

  // Create card modal state
  const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);

  // Cards list state
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // Edit card modal state
  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Delete card dialog state
  const [isDeleteCardDialogOpen, setIsDeleteCardDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CardResponse | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);

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

  const fetchCards = useCallback(async () => {
    if (!deckId) return;
    setIsLoadingCards(true);
    try {
      const response = await cardAPI.listByDeck({ deck_id: deckId, page_size: 100 });
      setCards(response.cards);
    } catch (err) {
      reportAPIError(err, { operation: 'fetchCards', endpoint: `/cards?deck_id=${deckId}` });
    } finally {
      setIsLoadingCards(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  useEffect(() => {
    if (deck) {
      fetchCards();
    }
  }, [deck, fetchCards]);

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

  // Create card handlers
  const handleCreateCardClick = () => {
    setIsCreateCardModalOpen(true);
  };

  const handleCreateCardSuccess = () => {
    setIsCreateCardModalOpen(false);
    fetchDeck(); // Refresh deck data including card count
    fetchCards(); // Refresh cards list
  };

  // Edit card handlers
  const handleEditCardClick = (card: CardResponse) => {
    setSelectedCardId(card.id);
    setIsEditCardModalOpen(true);
  };

  const handleEditCardModalClose = () => {
    setIsEditCardModalOpen(false);
    setSelectedCardId(null);
  };

  const handleCardUpdated = () => {
    setIsEditCardModalOpen(false);
    setSelectedCardId(null);
    fetchCards(); // Refresh cards list
  };

  // Delete card handlers
  const handleDeleteCardClick = (card: CardResponse) => {
    setCardToDelete(card);
    setIsDeleteCardDialogOpen(true);
  };

  const handleDeleteCardConfirm = async () => {
    if (!cardToDelete) return;

    setIsDeletingCard(true);
    try {
      await cardAPI.delete(cardToDelete.id);
      toast({
        title: t('myDecks.cards.deleteSuccess'),
      });
      setIsDeleteCardDialogOpen(false);
      setCardToDelete(null);
      fetchCards(); // Refresh cards list
      fetchDeck(); // Refresh deck data including card count
    } catch (err) {
      reportAPIError(err, { operation: 'deleteCard', endpoint: `/cards/${cardToDelete.id}` });
      toast({
        title: t('myDecks.cards.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleDeleteCardCancel = () => {
    setIsDeleteCardDialogOpen(false);
    setCardToDelete(null);
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

          {/* Create Card Button */}
          <div className="mb-4 flex justify-end">
            <Button variant="hero" onClick={handleCreateCardClick} data-testid="create-card-button">
              <Plus className="mr-2 h-4 w-4" />
              {t('myDecks.createCard')}
            </Button>
          </div>

          {/* Deck Header Card */}
          <Card className="relative mb-6">
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
              <div className="mt-2">
                <Badge variant="secondary">{deck.level}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Cards List */}
          {isLoadingCards ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">{t('myDecks.cards.empty')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="cards-list">
              {cards.map((card) => (
                <Card key={card.id} className="relative" data-testid={`card-${card.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-lg font-medium text-foreground">
                            {card.front_text}
                          </span>
                          {card.part_of_speech && (
                            <Badge variant="outline" className="text-xs">
                              {card.part_of_speech}
                            </Badge>
                          )}
                          {card.level && card.level !== deck.level && (
                            <Badge variant="secondary" className="text-xs">
                              {card.level}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{card.back_text_en}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCardClick(card)}
                          aria-label={t('myDecks.cards.editCard')}
                          data-testid={`edit-card-${card.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCardClick(card)}
                          aria-label={t('myDecks.cards.deleteCard')}
                          data-testid={`delete-card-${card.id}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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

      {/* Create Card Modal */}
      {deck && (
        <UserVocabularyCardCreateModal
          open={isCreateCardModalOpen}
          onOpenChange={setIsCreateCardModalOpen}
          deckId={deck.id}
          deckLevel={deck.level}
          onSuccess={handleCreateCardSuccess}
        />
      )}

      {/* Edit Card Modal */}
      {deck && selectedCardId && (
        <UserVocabularyCardEditModal
          open={isEditCardModalOpen}
          onOpenChange={(open) => !open && handleEditCardModalClose()}
          cardId={selectedCardId}
          deckId={deck.id}
          deckLevel={deck.level}
          onSuccess={handleCardUpdated}
        />
      )}

      {/* Delete Card Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteCardDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCardCancel()}
        title={t('myDecks.cards.deleteTitle')}
        description={t('myDecks.cards.deleteMessage', { cardName: cardToDelete?.front_text })}
        confirmText={t('myDecks.cards.deleteConfirm')}
        cancelText={t('myDecks.cards.deleteCancel')}
        onConfirm={handleDeleteCardConfirm}
        onCancel={handleDeleteCardCancel}
        variant="destructive"
        loading={isDeletingCard}
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
