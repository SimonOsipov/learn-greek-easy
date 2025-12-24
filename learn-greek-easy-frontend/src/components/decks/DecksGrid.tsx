// /src/components/decks/DecksGrid.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { CultureCategory } from '@/components/culture';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import type { Deck } from '@/types/deck';

import { DeckCard } from './DeckCard';

export interface DecksGridProps {
  decks: Deck[];
  onDeckClick?: (deckId: string) => void;
}

export const DecksGrid: React.FC<DecksGridProps> = ({ decks, onDeckClick }) => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  const handleDeckClick = (deckId: string) => {
    // Find the deck to get properties for tracking
    const deck = decks.find((d) => d.id === deckId);

    // Track deck selection event
    if (deck) {
      track('deck_selected', {
        deck_id: deck.id,
        deck_name: deck.title,
        level: deck.level,
        total_cards: deck.cardCount,
        cards_due: deck.progress?.dueToday ?? 0,
      });
    }

    if (onDeckClick) {
      onDeckClick(deckId);
    } else {
      // Default behavior: navigate to deck detail page
      // Culture decks go to /culture/decks/:id, vocabulary decks go to /decks/:id
      const isCultureDeck = deck?.category === 'culture';
      if (isCultureDeck) {
        navigate(`/culture/decks/${deckId}`);
      } else {
        navigate(`/decks/${deckId}`);
      }
    }
  };

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label={t('list.title')}
    >
      {decks.map((deck) => {
        // Check if this is a culture deck
        const isCultureDeck = deck.category === 'culture';
        // Extract culture category from deck tags or use a default
        // Culture decks might have tags like "history", "geography" etc.
        const cultureCategory = isCultureDeck
          ? (deck.tags?.find((tag) =>
              ['history', 'geography', 'politics', 'culture', 'traditions'].includes(tag)
            ) as CultureCategory | undefined)
          : undefined;

        return (
          <div key={deck.id} role="listitem">
            <DeckCard
              deck={deck}
              onClick={() => handleDeckClick(deck.id)}
              showProgress={true}
              showStats={true}
              variant="grid"
              isCultureDeck={isCultureDeck}
              cultureCategory={cultureCategory}
            />
          </div>
        );
      })}
    </div>
  );
};
