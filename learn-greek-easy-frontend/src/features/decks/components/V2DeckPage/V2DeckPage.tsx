// src/features/decks/components/V2DeckPage/V2DeckPage.tsx

import React, { useState } from 'react';

import { AlertCircle, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { UserDeckEditModal } from '@/components/decks';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
// Import dx.css directly in this route module so the dx-* styles load on deck
// detail deep-links. (A shared-barrel import lands in the common DxCover chunk,
// whose CSS Vite does not reliably inject for static-import routes.)
import '@/features/decks/dx/dx.css';
import { useToast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { reportAPIError } from '@/lib/errorReporting';
import { deckAPI, type DeckLevel } from '@/services/deckAPI';
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
  const { t, i18n } = useTranslation('deck');
  const { selectedDeck, isLoading, error, selectDeck } = useDeckStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Edit / delete state — only reachable for the deck owner (see isOwned below).
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // V2DeckPage is the deck detail page for vocabulary decks.
  // At this point, the deck is already loaded in the store.
  // Note: We intentionally do NOT clear the selection here because:
  // 1. React StrictMode double-invokes effects and their cleanups
  // 2. If we clear selection in cleanup, StrictMode will clear it before the component fully mounts
  // 3. Instead, we rely on route changes to naturally trigger new deck selections

  // Loading state - also show loading if deck isn't loaded yet.
  // selectedDeck is normally populated by DeckDetailPage before this renders,
  // but we handle the edge case where it isn't yet.
  if (isLoading || !selectedDeck) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => selectDeck(deckId)} />;
  }

  // Personal decks belong to the user — their natural parent is /my-decks, and
  // only their owner can edit or delete them.
  const isOwned = selectedDeck.isOwned ?? false;
  const backTo = isOwned ? '/my-decks' : '/decks';
  const backLabel = isOwned ? t('myDecks.title') : t('detail.breadcrumb');

  const handleDeckUpdated = () => {
    setIsEditOpen(false);
    // Refetch so the renamed/re-levelled deck is reflected in the header.
    selectDeck(deckId);
  };

  const handleDeleteClick = () => {
    track('user_deck_delete_started', {
      deck_id: selectedDeck.id,
      deck_name: selectedDeck.title,
      source: 'deck_detail',
    });
    setIsDeleteOpen(true);
  };

  const handleDeleteCancel = () => {
    track('user_deck_delete_cancelled', {
      deck_id: selectedDeck.id,
      deck_name: selectedDeck.title,
      source: 'deck_detail',
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deckAPI.deleteMyDeck(selectedDeck.id);
      toast({ title: t('myDecks.deleteSuccess') });
      // The deck no longer exists — return to the library.
      navigate('/my-decks');
    } catch (err) {
      reportAPIError(err, { operation: 'deleteMyDeck', endpoint: `/decks/${selectedDeck.id}` });
      toast({ title: t('myDecks.deleteError'), variant: 'destructive' });
    }
  };

  return (
    <div data-testid="v2-deck-detail" className="container mx-auto px-4 py-6 md:py-8">
      {/* Breadcrumb + owner actions */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <nav
          data-testid="breadcrumb"
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link
            to={backTo}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-foreground">
            {getLocalizedDeckName(selectedDeck, i18n.language)}
          </span>
        </nav>

        {isOwned && (
          <div className="flex flex-shrink-0 items-center gap-2" data-testid="deck-detail-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              data-testid="edit-deck-button"
              aria-label={t('myDecks.editDeck')}
            >
              <Pencil className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('myDecks.editDeck')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteClick}
              data-testid="delete-deck-button"
              className="text-destructive hover:text-destructive"
              aria-label={t('myDecks.deleteDeck')}
            >
              <Trash2 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('myDecks.deleteDeck')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <V2DeckHeader deck={selectedDeck} />

        {/* Word Browser Section */}
        <WordBrowser deckId={deckId} isOwnDeck={isOwned} />
      </div>

      {/* Owner: edit deck modal */}
      {isEditOpen && (
        <UserDeckEditModal
          isOpen
          onClose={() => setIsEditOpen(false)}
          mode="edit"
          source="detail_page"
          deck={{
            id: selectedDeck.id,
            name: selectedDeck.title,
            description: selectedDeck.description,
            level: selectedDeck.level as DeckLevel,
          }}
          onSuccess={handleDeckUpdated}
        />
      )}

      {/* Owner: delete confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={t('myDecks.delete.title')}
        description={t('myDecks.delete.message', { deckName: selectedDeck.title })}
        confirmText={t('myDecks.delete.confirm')}
        cancelText={t('myDecks.delete.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="destructive"
      />
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
    <div className="container mx-auto px-4 py-6 md:py-8">
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
