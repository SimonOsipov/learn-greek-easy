// src/lib/cultureDeckTransform.ts

/**
 * Transform utility for culture deck API responses.
 *
 * Extracted from deckStore.ts so that CulturePage can reuse the same
 * transform without importing useDeckStore (which merges vocab + culture).
 */

import type { CultureDeckResponse } from '@/services/cultureDeckAPI';
import type { Deck, DeckProgress } from '@/types/deck';

/**
 * Transform culture deck response to frontend Deck type.
 *
 * Key invariants:
 * - category is always set to 'culture' (practical sub-category collapses here)
 * - level is always set to 'A1' (culture decks have no CEFR levels)
 */
export const transformCultureDeckResponse = (deck: CultureDeckResponse): Deck => {
  // Determine status from progress data
  let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
  if (deck.progress) {
    if (
      deck.progress.questions_total > 0 &&
      deck.progress.questions_mastered >= deck.progress.questions_total
    ) {
      status = 'completed';
    } else if (deck.progress.questions_mastered > 0 || deck.progress.questions_learning > 0) {
      status = 'in-progress';
    }
  }

  // Get total questions from progress data or deck response
  const totalCards = deck.progress?.questions_total ?? deck.question_count ?? 0;

  // Build progress object matching DeckProgress interface
  const progress: DeckProgress | undefined = deck.progress
    ? {
        deckId: deck.id,
        status,
        cardsTotal: deck.progress.questions_total,
        cardsNew: deck.progress.questions_new,
        cardsLearning: deck.progress.questions_learning,
        cardsReview: 0, // Culture decks don't have review concept yet
        cardsMastered: deck.progress.questions_mastered,
        dueToday: 0, // Culture decks don't have spaced repetition yet
        streak: 0,
        lastStudied: deck.progress.last_practiced_at
          ? new Date(deck.progress.last_practiced_at)
          : undefined,
        totalTimeSpent: 0,
        accuracy:
          deck.progress.questions_total > 0
            ? Math.round((deck.progress.questions_mastered / deck.progress.questions_total) * 100)
            : 0,
      }
    : undefined;

  return {
    id: deck.id,
    title: deck.name,
    titleGreek: deck.name,
    description: deck.description || '',
    level: 'A1', // Culture decks don't have CEFR levels
    category: 'culture', // KEY: Set category to 'culture'
    cardCount: totalCards,
    estimatedTime: Math.ceil(totalCards * 0.5), // Estimate 30 seconds per question
    isPremium: deck.is_premium ?? false,
    tags: [deck.category], // Use culture category as tag (history, geography, etc.)
    thumbnail: `/images/culture/${deck.category}.jpg`,
    coverImageUrl: deck.cover_image_url ?? undefined,
    createdBy: 'Greeklish',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress,
    nameEn: deck.name_en,
    nameRu: deck.name_ru,
    descriptionEn: deck.description_en,
    descriptionRu: deck.description_ru,
  };
};
