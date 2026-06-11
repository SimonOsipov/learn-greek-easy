// src/features/words/components/AddToDeckModal.tsx

/**
 * Add-to-deck modal for word pages.
 *
 * Lists the user's own decks and lets them toggle whether the current word
 * entry belongs to each deck. Adding links the word and generates its card
 * records server-side; removing unlinks it and deletes the deck's cards.
 */

import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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

  // Deck currently being added/removed (disables its row while pending)
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null);

  const { data: myDecksData, isLoading: isDecksLoading } = useQuery({
    queryKey: ['myDecks'],
    queryFn: () => deckAPI.getMyDecks({ page: 1, page_size: 50 }),
    enabled: open,
  });

  const { data: containingData, isLoading: isContainingLoading } = useQuery({
    queryKey: ['wordEntryMyDecks', wordEntryId],
    queryFn: () => wordEntryAPI.getMyDecksForWord(wordEntryId),
    enabled: open && !!wordEntryId,
  });

  const decks = myDecksData?.decks ?? [];
  const containingDeckIds = new Set(containingData?.deck_ids ?? []);
  const isLoading = isDecksLoading || isContainingLoading;

  const invalidateDeckQueries = (deckId: string) => {
    queryClient.invalidateQueries({ queryKey: ['wordEntryMyDecks', wordEntryId] });
    queryClient.invalidateQueries({ queryKey: ['wordEntries', deckId] });
    queryClient.invalidateQueries({ queryKey: ['wordMastery', deckId] });
    queryClient.invalidateQueries({ queryKey: ['myDecks'] });
  };

  const addMutation = useMutation({
    mutationFn: (deck: DeckResponse) => deckAPI.addWordToMyDeck(deck.id, wordEntryId),
    onSuccess: (_data, deck) => {
      track('user_deck_word_added', {
        deck_id: deck.id,
        word_entry_id: wordEntryId,
        lemma,
        source: 'word_reference',
      });
      toast({ title: t('wordReference.addToDeck.addedToast', { deckName: deck.name }) });
      invalidateDeckQueries(deck.id);
    },
    onError: (err, deck) => {
      reportAPIError(err, {
        operation: 'addWordToMyDeck',
        endpoint: `/decks/${deck.id}/word-entries/${wordEntryId}`,
      });
      toast({ title: t('wordReference.addToDeck.addError'), variant: 'destructive' });
      // Contained-state may be stale (e.g. word added in another tab) — resync
      invalidateDeckQueries(deck.id);
    },
    onSettled: () => setPendingDeckId(null),
  });

  const removeMutation = useMutation({
    mutationFn: (deck: DeckResponse) => deckAPI.removeWordFromMyDeck(deck.id, wordEntryId),
    onSuccess: (_data, deck) => {
      track('user_deck_word_removed', {
        deck_id: deck.id,
        word_entry_id: wordEntryId,
        lemma,
        source: 'word_reference',
      });
      toast({ title: t('wordReference.addToDeck.removedToast', { deckName: deck.name }) });
      invalidateDeckQueries(deck.id);
    },
    onError: (err, deck) => {
      reportAPIError(err, {
        operation: 'removeWordFromMyDeck',
        endpoint: `/decks/${deck.id}/word-entries/${wordEntryId}`,
      });
      toast({ title: t('wordReference.addToDeck.removeError'), variant: 'destructive' });
      invalidateDeckQueries(deck.id);
    },
    onSettled: () => setPendingDeckId(null),
  });

  const handleToggle = (deck: DeckResponse) => {
    if (pendingDeckId) return;
    setPendingDeckId(deck.id);
    if (containingDeckIds.has(deck.id)) {
      removeMutation.mutate(deck);
    } else {
      addMutation.mutate(deck);
    }
  };

  const handleCreateDeck = () => {
    onOpenChange(false);
    navigate('/my-decks');
  };

  return (
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
                    disabled={!!pendingDeckId}
                    aria-pressed={isAdded}
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
  );
}
