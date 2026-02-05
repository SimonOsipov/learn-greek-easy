// src/features/decks/components/V2DeckPage/WordCard.tsx

import type { WordEntryResponse } from '@/services/wordEntryAPI';

/**
 * Props for WordCard component.
 * Displays an individual word entry in the browser grid.
 */
export interface WordCardProps {
  word: WordEntryResponse;
}

/**
 * WordCard Component (Placeholder)
 *
 * Displays an individual word entry with lemma, translation, and
 * part of speech. Full implementation in DUAL-07.
 */
export const WordCard: React.FC<WordCardProps> = () => {
  // Placeholder - actual implementation in DUAL-07
  return null;
};
