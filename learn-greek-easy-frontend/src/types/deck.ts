// src/types/deck.ts

// Type Enums
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DeckCategory = 'vocabulary' | 'grammar' | 'phrases' | 'culture';
export type DeckStatus = 'not-started' | 'in-progress' | 'completed';
export type CardDifficulty = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Card presentation system version.
 * - V1: Traditional flashcard system with spaced repetition
 * - V2: Word browser system with word entries
 */
export type CardSystemVersion = 'V1' | 'V2';

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
  /** Card presentation system version (V1=flashcards, V2=word browser) */
  cardSystem: CardSystemVersion;
  // Multilingual fields for client-side locale resolution
  nameEn?: string;
  nameRu?: string;
  descriptionEn?: string | null;
  descriptionRu?: string | null;
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

// ============================================================================
// Admin Response Types (All Languages)
// ============================================================================

/**
 * Admin response for vocabulary deck with all language fields.
 * Matches backend DeckAdminResponse schema.
 *
 * Used by admin endpoints to display and edit deck content in all languages.
 * Unlike DeckResponse (localized), this includes all three language variants.
 */
export interface DeckAdminResponse {
  id: string;
  name_en: string;
  name_ru: string;
  description_en: string | null;
  description_ru: string | null;
  level: DeckLevel;
  is_active: boolean;
  is_premium: boolean;
  card_count: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin response for culture deck with all language fields.
 * Matches backend CultureDeckAdminResponse schema.
 *
 * Used by admin endpoints to display and edit deck content in all languages.
 * Unlike CultureDeckResponse (localized), this includes all three language variants.
 */
export interface CultureDeckAdminResponse {
  id: string;
  name_en: string;
  name_ru: string;
  description_en: string | null;
  description_ru: string | null;
  category: string;
  is_active: boolean;
  is_premium: boolean;
  question_count: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}
