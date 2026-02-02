import React from 'react';

import { BookOpen, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Deck } from '@/types/deck';

export interface DeckSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: Deck[];
  isLoading: boolean;
  onSelect: (deck: Deck) => void;
}

/**
 * Modal for selecting a deck from the user's deck list.
 * Used when creating a card from the My Decks list page where no deck is pre-selected.
 */
export function DeckSelectorModal({
  open,
  onOpenChange,
  decks,
  isLoading,
  onSelect,
}: DeckSelectorModalProps) {
  const { t } = useTranslation('deck');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh] overflow-hidden sm:max-w-md"
        data-testid="deck-selector-modal"
      >
        <DialogHeader>
          <DialogTitle>{t('myDecks.selectDeck.title')}</DialogTitle>
          <DialogDescription>{t('myDecks.selectDeck.description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {t('myDecks.selectDeck.noDecksFallback')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {decks.map((deck) => (
                <Button
                  key={deck.id}
                  variant="outline"
                  className="h-auto w-full justify-start p-3 text-left"
                  onClick={() => onSelect(deck)}
                  data-testid={`deck-selector-${deck.id}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{deck.title}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {deck.level}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t('card.cardsCount', { count: deck.cardCount })}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
