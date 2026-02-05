// src/features/decks/components/V2DeckPage/WordCard.tsx

/**
 * Individual word card component for V2 decks.
 * Displays word entry with lemma, pronunciation, translation, and part of speech.
 *
 * Note: The main WordCard implementation is in WordGrid.tsx as an internal component.
 * This file exports the props interface for external use.
 */

import type { WordEntryResponse } from '@/services/wordEntryAPI';

/**
 * Props for WordCard component.
 * Displays an individual word entry in the browser grid.
 */
export interface WordCardProps {
  word: WordEntryResponse;
}

// WordCard is implemented inside WordGrid.tsx for performance optimization
// (allows for virtualization in the future without prop drilling)
// This file exports only the props interface for type safety
