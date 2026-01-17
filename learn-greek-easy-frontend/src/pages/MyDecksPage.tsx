// src/pages/MyDecksPage.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, BookOpen, Plus, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DecksGrid, UserDeckEditModal } from '@/components/decks';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { CardSkeleton } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  trackMyDecksPageViewed,
  trackMyDecksCreateDeckClicked,
  trackMyDecksCreateCardClicked,
  trackMyDecksEditDeckClicked,
  trackMyDecksDeleteDeckClicked,
  trackMyDecksDeckDeleted,
} from '@/lib/analytics/myDecksAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { deckAPI, type DeckLevel, type DeckResponse } from '@/services/deckAPI';
import type { Deck, DeckProgress } from '@/types/deck';

/**
 * Transform backend deck response to frontend Deck type
 * Simplified version for user-owned decks (no progress data needed)
 */
const transformDeckResponse = (deck: DeckResponse): Deck => {
  // User's own decks - no progress tracking for now
  const progress: DeckProgress | undefined = undefined;

  return {
    id: deck.id,
    title: deck.name,
    titleGreek: deck.name,
    description: deck.description || '',
    level: deck.level.toUpperCase() as 'A1' | 'A2' | 'B1' | 'B2',
    category: 'vocabulary',
    cardCount: deck.card_count ?? 0,
    estimatedTime: deck.estimated_time_minutes ?? 10,
    isPremium: deck.is_premium ?? false,
    tags: deck.tags || [],
    thumbnail: `/images/decks/${deck.level.toLowerCase()}.jpg`,
    createdBy: 'You',
    createdAt: new Date(deck.created_at),
    updatedAt: new Date(deck.updated_at),
    progress,
  };
};

export const MyDecksPage: React.FC = () => {
  const { t } = useTranslation('deck');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const hasTrackedPageView = useRef(false);

  // Edit deck state
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  // Delete deck state
  const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMyDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await deckAPI.getMyDecks({ page: 1, page_size: 50 });
      const transformedDecks = response.decks.map(transformDeckResponse);
      setDecks(transformedDecks);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('myDecks.error.loading');
      setError(errorMessage);
      reportAPIError(err, { operation: 'fetchMyDecks', endpoint: '/decks/mine' });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMyDecks();
  }, [fetchMyDecks]);

  // Track page view after decks loaded successfully
  useEffect(() => {
    if (!isLoading && !error && !hasTrackedPageView.current) {
      trackMyDecksPageViewed({
        user_deck_count: decks.length,
        has_decks: decks.length > 0,
      });
      hasTrackedPageView.current = true;
    }
  }, [isLoading, error, decks.length]);

  const handleRetry = () => {
    setError(null);
    fetchMyDecks();
  };

  const handleCreateDeckClick = () => {
    trackMyDecksCreateDeckClicked({
      button_state: 'enabled',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleDeckCreated = () => {
    fetchMyDecks();
  };

  const handleCreateCardClick = () => {
    trackMyDecksCreateCardClicked({
      button_state: 'disabled',
    });
  };

  const handleDeckClick = (deckId: string) => {
    navigate(`/my-decks/${deckId}`);
  };

  // Edit deck handlers
  const handleEditDeckClick = (deck: Deck) => {
    trackMyDecksEditDeckClicked({
      deck_id: deck.id,
      deck_name: deck.title,
    });
    setEditingDeck(deck);
  };

  const handleEditModalClose = () => {
    setEditingDeck(null);
  };

  const handleDeckUpdated = () => {
    fetchMyDecks();
    setEditingDeck(null);
  };

  // Delete deck handlers
  const handleDeleteDeckClick = (deck: Deck) => {
    trackMyDecksDeleteDeckClicked({
      deck_id: deck.id,
      deck_name: deck.title,
    });
    setDeletingDeck(deck);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDeck) return;

    setIsDeleting(true);
    try {
      await deckAPI.deleteMyDeck(deletingDeck.id);
      trackMyDecksDeckDeleted({
        deck_id: deletingDeck.id,
        deck_name: deletingDeck.title,
      });
      toast({
        title: t('myDecks.deleteSuccess'),
      });
      // Remove deck from local state for immediate UI update
      setDecks((prev) => prev.filter((d) => d.id !== deletingDeck.id));
      setDeletingDeck(null);
    } catch (err) {
      reportAPIError(err, { operation: 'deleteMyDeck', endpoint: `/decks/${deletingDeck.id}` });
      toast({
        title: t('myDecks.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingDeck(null);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="my-decks-title"
        >
          {t('myDecks.title')}
        </h1>
      </div>

      {/* Action Buttons Card */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="hero" size="lg" onClick={handleCreateDeckClick}>
            <Plus className="mr-2 h-4 w-4" />
            {t('myDecks.createDeck')}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <span onClick={handleCreateCardClick}>
                <Button variant="outline" size="lg" disabled>
                  <Square className="mr-2 h-4 w-4" />
                  {t('myDecks.createCard')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('myDecks.comingSoon')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-200">
                {t('list.errorLoading')}
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                {t('list.tryAgain')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && <MyDecksGridSkeleton />}

      {/* Decks Grid */}
      {!isLoading && !error && decks.length > 0 && (
        <DecksGrid
          decks={decks}
          onDeckClick={handleDeckClick}
          showActions={true}
          onEditDeck={handleEditDeckClick}
          onDeleteDeck={handleDeleteDeckClick}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && decks.length === 0 && (
        <div
          className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center"
          role="status"
          aria-label={t('myDecks.empty.title')}
          data-testid="my-decks-empty-state"
        >
          <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/50" aria-hidden="true" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">{t('myDecks.empty.title')}</h3>
          <div className="mt-4">
            <Button variant="hero" onClick={handleCreateDeckClick}>
              {t('myDecks.empty.cta')}
            </Button>
          </div>
        </div>
      )}

      {/* Create Deck Modal */}
      <UserDeckEditModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        mode="create"
        onSuccess={handleDeckCreated}
      />

      {/* Edit Deck Modal */}
      {editingDeck && (
        <UserDeckEditModal
          isOpen={true}
          onClose={handleEditModalClose}
          mode="edit"
          deck={{
            id: editingDeck.id,
            name: editingDeck.title,
            description: editingDeck.description,
            level: editingDeck.level.toLowerCase() as DeckLevel,
          }}
          onSuccess={handleDeckUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingDeck}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        title={t('myDecks.delete.title')}
        description={t('myDecks.delete.message', { deckName: deletingDeck?.title })}
        confirmText={t('myDecks.delete.confirm')}
        cancelText={t('myDecks.delete.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
};

// Loading skeleton component
const MyDecksGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
