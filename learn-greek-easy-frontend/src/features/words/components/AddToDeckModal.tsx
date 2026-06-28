// src/features/words/components/AddToDeckModal.tsx

/**
 * Add-to-deck modal for word pages.
 *
 * Lists the user's own decks and lets them toggle whether the current word
 * entry belongs to each deck. Adding links the word and generates its card
 * records server-side; removing unlinks it and deletes the deck's cards
 * (and with them the user's practice progress), so removal asks for
 * confirmation first.
 */

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import { deckAPI, type DeckResponse } from '@/services/deckAPI';
import { wordEntryAPI } from '@/services/wordEntryAPI';

export interface AddToDeckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** UUID of the word entry being added/removed */
  wordEntryId: string;
  /** Lemma of the word, shown in the modal description and analytics */
  lemma: string;
}

export function AddToDeckModal({ open, onOpenChange, wordEntryId, lemma }: AddToDeckModalProps) {
  const { t } = useTranslation('deck');
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Deck currently being added/removed (its row shows a spinner; other clicks
  // are ignored via the handleToggle guard while a mutation is in flight)
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null);
  // Deck awaiting remove confirmation (removal deletes practice progress)
  const [deckToRemoveFrom, setDeckToRemoveFrom] = useState<DeckResponse | null>(null);

  const {
    data: myDecksData,
    isLoading: isDecksLoading,
    isError: isDecksError,
    refetch: refetchDecks,
  } = useQuery({
    queryKey: ['myDecks'],
    queryFn: () => deckAPI.getMyDecks({ page: 1, page_size: 50 }),
    enabled: open,
  });

  const {
    data: containingData,
    isLoading: isContainingLoading,
    isError: isContainingError,
    refetch: refetchContaining,
  } = useQuery({
    queryKey: ['wordEntryMyDecks', wordEntryId],
    queryFn: () => wordEntryAPI.getMyDecksForWord(wordEntryId),
    enabled: open && !!wordEntryId,
  });

  const decks = myDecksData?.decks ?? [];
  const containingDeckIds = new Set(containingData?.deck_ids ?? []);
  const isLoading = isDecksLoading || isContainingLoading;
  const isError = isDecksError || isContainingError;

  // Awaited in onSuccess so rows stay pending until the contained-state
  // refetch lands — otherwise a quick second click re-adds and 409s
  const invalidateDeckQueries = (deckId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wordEntryMyDecks', wordEntryId] }),
      queryClient.invalidateQueries({ queryKey: ['wordEntries', deckId] }),
      queryClient.invalidateQueries({ queryKey: ['wordMastery', deckId] }),
      queryClient.invalidateQueries({ queryKey: ['wordEntryCards', wordEntryId] }),
      queryClient.invalidateQueries({ queryKey: ['myDecks'] }),
    ]);

  const addMutation = useMutation({
    mutationFn: (deck: DeckResponse) => deckAPI.addWordToMyDeck(deck.id, wordEntryId),
    onSuccess: async (_data, deck) => {
      track('user_deck_word_added', {
        deck_id: deck.id,
        word_entry_id: wordEntryId,
        lemma,
        source: 'word_reference',
      });
      toast({
        title: t('wordReference.addToDeck.addedToast', { deckName: deck.name }),
        variant: 'success',
      });
      await invalidateDeckQueries(deck.id);
    },
    onError: async (err, deck) => {
      reportAPIError(err, {
        operation: 'addWordToMyDeck',
        endpoint: `/decks/${deck.id}/word-entries/${wordEntryId}`,
      });
      toast({ title: t('wordReference.addToDeck.addError'), variant: 'destructive' });
      // Contained-state may be stale (e.g. word added in another tab) — resync
      await invalidateDeckQueries(deck.id);
    },
    onSettled: () => setPendingDeckId(null),
  });

  const removeMutation = useMutation({
    mutationFn: (deck: DeckResponse) => deckAPI.removeWordFromMyDeck(deck.id, wordEntryId),
    onSuccess: async (_data, deck) => {
      track('user_deck_word_removed', {
        deck_id: deck.id,
        word_entry_id: wordEntryId,
        lemma,
        source: 'word_reference',
      });
      toast({
        title: t('wordReference.addToDeck.removedToast', { deckName: deck.name }),
        variant: 'success',
      });
      await invalidateDeckQueries(deck.id);
    },
    onError: async (err, deck) => {
      reportAPIError(err, {
        operation: 'removeWordFromMyDeck',
        endpoint: `/decks/${deck.id}/word-entries/${wordEntryId}`,
      });
      toast({ title: t('wordReference.addToDeck.removeError'), variant: 'destructive' });
      await invalidateDeckQueries(deck.id);
    },
    onSettled: () => setPendingDeckId(null),
  });

  const handleToggle = (deck: DeckResponse) => {
    if (pendingDeckId) return;
    if (containingDeckIds.has(deck.id)) {
      // Removal deletes the deck's cards and the user's progress — confirm first
      setDeckToRemoveFrom(deck);
    } else {
      setPendingDeckId(deck.id);
      addMutation.mutate(deck);
    }
  };

  const handleRemoveConfirm = () => {
    if (!deckToRemoveFrom) return;
    setPendingDeckId(deckToRemoveFrom.id);
    removeMutation.mutate(deckToRemoveFrom);
    setDeckToRemoveFrom(null);
  };

  const handleCreateDeck = () => {
    onOpenChange(false);
    // openCreateDeck: MyDecksPage auto-opens the create modal on arrival
    navigate('/my-decks', { state: { openCreateDeck: true } });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[80vh] overflow-hidden sm:max-w-md"
          data-testid="add-to-deck-modal"
        >
          <DialogHeader>
            <DialogTitle>{t('wordReference.addToDeck.title')}</DialogTitle>
            <DialogDescription>
              {t('wordReference.addToDeck.description', { lemma })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div
                className="flex items-center justify-center py-8"
                data-testid="add-to-deck-loading"
              >
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div
                className="flex flex-col items-center justify-center py-8 text-center"
                data-testid="add-to-deck-error"
              >
                <p className="mb-4 text-sm text-muted-foreground">{t('myDecks.error.loading')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchDecks();
                    refetchContaining();
                  }}
                >
                  {t('list.tryAgain')}
                </Button>
              </div>
            ) : decks.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-8 text-center"
                data-testid="add-to-deck-empty"
              >
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="mb-4 text-sm text-muted-foreground">
                  {t('wordReference.addToDeck.empty.title')}
                </p>
                <Button variant="hero" size="sm" onClick={handleCreateDeck}>
                  {t('wordReference.addToDeck.empty.cta')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {decks.map((deck) => {
                  const isAdded = containingDeckIds.has(deck.id);
                  const isPending = pendingDeckId === deck.id;
                  return (
                    <Button
                      key={deck.id}
                      variant="outline"
                      className="h-auto w-full justify-start p-3 text-left"
                      onClick={() => handleToggle(deck)}
                      aria-pressed={isAdded}
                      aria-busy={isPending}
                      data-testid={`add-to-deck-row-${deck.id}`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{deck.name}</span>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {deck.level}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t('card.cardsCount', { count: deck.card_count ?? 0 })}
                        </span>
                      </div>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-xs">
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : isAdded ? (
                          <span className="flex items-center gap-1 text-primary">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {t('wordReference.addToDeck.added')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {t('wordReference.addToDeck.add')}
                          </span>
                        )}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deckToRemoveFrom}
        onOpenChange={(isOpen) => !isOpen && setDeckToRemoveFrom(null)}
        title={t('wordReference.addToDeck.removeConfirm.title')}
        description={t('wordReference.addToDeck.removeConfirm.message', {
          lemma,
          deckName: deckToRemoveFrom?.name,
        })}
        confirmText={t('wordReference.addToDeck.removeConfirm.confirm')}
        cancelText={t('wordReference.addToDeck.removeConfirm.cancel')}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setDeckToRemoveFrom(null)}
        variant="destructive"
      />
    </>
  );
}
