// src/pages/MyDecksPage.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, BookOpen, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { DecksGrid, UserDeckEditModal } from '@/components/decks';
import type { CreateSource } from '@/components/decks/UserDeckEditModal';
import { CardSkeleton } from '@/components/feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { reportAPIError } from '@/lib/errorReporting';
import { deckAPI, type DeckResponse } from '@/services/deckAPI';
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
    nameEn: deck.name_en,
    nameRu: deck.name_ru,
    descriptionEn: deck.description_en,
    descriptionRu: deck.description_ru,
  };
};

export const MyDecksPage: React.FC = () => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();
  const location = useLocation();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Arriving from the word page's add-to-deck modal opens the create dialog directly
  const arrivedToCreate = Boolean(
    (location.state as { openCreateDeck?: boolean } | null)?.openCreateDeck
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(arrivedToCreate);
  const [createSource, setCreateSource] = useState<CreateSource>(
    arrivedToCreate ? 'add_to_deck_modal' : 'my_decks_button'
  );

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

  const handleRetry = () => {
    setError(null);
    fetchMyDecks();
  };

  const handleCreateDeckClick = (source: CreateSource = 'my_decks_button') => {
    setCreateSource(source);
    setIsCreateModalOpen(true);
  };

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleDeckCreated = () => {
    fetchMyDecks();
  };

  const handleDeckClick = (deckId: string) => {
    // Navigate to V2 deck detail page (MyDeckDetailPage removed in SM2V2-06).
    // Edit/delete now live on the deck detail page itself, not the grid card.
    navigate(`/decks/${deckId}`);
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
          <Button variant="hero" size="lg" onClick={() => handleCreateDeckClick('my_decks_button')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('myDecks.createDeck')}
          </Button>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('list.errorLoading')}</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={handleRetry} className="mt-3 block">
              {t('list.tryAgain')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && !error && <MyDecksGridSkeleton />}

      {/* Decks Grid */}
      {!isLoading && !error && decks.length > 0 && (
        <DecksGrid decks={decks} onDeckClick={handleDeckClick} />
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
            <Button variant="hero" onClick={() => handleCreateDeckClick('empty_state_cta')}>
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
        source={createSource}
        onSuccess={handleDeckCreated}
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
