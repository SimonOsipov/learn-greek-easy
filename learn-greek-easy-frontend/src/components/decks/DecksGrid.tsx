// /src/components/decks/DecksGrid.tsx

import React from 'react';

import { useNavigate } from 'react-router-dom';

import type { Deck } from '@/types/deck';

import { DeckCard } from './DeckCard';

export interface DecksGridProps {
  decks: Deck[];
  onDeckClick?: (deckId: string) => void;
}

export const DecksGrid: React.FC<DecksGridProps> = ({ decks, onDeckClick }) => {
  const navigate = useNavigate();

  const handleDeckClick = (deckId: string) => {
    if (onDeckClick) {
      onDeckClick(deckId);
    } else {
      // Default behavior: navigate to deck detail page
      navigate(`/decks/${deckId}`);
    }
  };

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label="Available decks"
    >
      {decks.map((deck) => (
        <div key={deck.id} role="listitem">
          <DeckCard
            deck={deck}
            onClick={() => handleDeckClick(deck.id)}
            showProgress={true}
            showStats={true}
            variant="grid"
          />
        </div>
      ))}
    </div>
  );
};
