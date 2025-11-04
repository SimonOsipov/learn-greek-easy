// src/types/deck.ts

// Type Enums
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type DeckCategory = 'vocabulary' | 'grammar' | 'phrases' | 'culture';
export type DeckStatus = 'not-started' | 'in-progress' | 'completed';
export type CardDifficulty = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Individual flashcard within a deck
 */
export interface Card {
  id: string;
  front: string; // Greek word/phrase
  back: string; // English translation
  pronunciation?: string; // Phonetic pronunciation guide
  example?: string; // Example sentence in Greek
  exampleTranslation?: string; // English translation of example
  difficulty: CardDifficulty;
  nextReviewDate?: Date;
  timesReviewed: number;
  successRate: number; // 0-100 percentage
}

/**
 * User's progress tracking for a specific deck
 */
export interface DeckProgress {
  deckId: string;
  status: DeckStatus;
  cardsTotal: number;
  cardsNew: number; // Not yet studied
  cardsLearning: number; // Currently being learned
  cardsReview: number; // Ready for review
  cardsMastered: number; // Fully mastered (80%+ success, 3+ reviews)
  dueToday: number; // Cards scheduled for today
  streak: number; // Consecutive days studied
  lastStudied?: Date;
  totalTimeSpent: number; // Total minutes spent on deck
  accuracy: number; // Overall accuracy percentage (0-100)
}

/**
 * Vocabulary deck with Greek language content
 */
export interface Deck {
  id: string;
  title: string; // English title
  titleGreek: string; // Greek translation of title
  description: string;
  level: DeckLevel;
  category: DeckCategory;
  tags: string[];
  cardCount: number;
  estimatedTime: number; // Minutes to complete
  isPremium: boolean;
  thumbnail?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // User-specific data (injected from progress tracking)
  progress?: DeckProgress;
}

/**
 * Filter options for deck list
 */
export interface DeckFilters {
  search: string;
  levels: DeckLevel[];
  categories: DeckCategory[];
  status: DeckStatus[];
  showPremiumOnly: boolean;
}
