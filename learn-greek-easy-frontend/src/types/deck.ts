// Deck and Card type definitions

export interface Deck {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'A1' | 'A2' | 'B1' | 'B2';
  icon?: string;
  cards: CardStats;
  progress: number;
  lastReviewed?: Date;
  nextReview?: Date;
  status: 'not-started' | 'in-progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CardStats {
  total: number;
  new: number;
  learning: number;
  young: number;
  mature: number;
  due: number;
  mastered: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  example?: string;
  pronunciation?: string;
  audioUrl?: string;
  imageUrl?: string;
  difficulty: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: Date;
  lastReviewed?: Date;
  status: 'new' | 'learning' | 'young' | 'mature';
}

export interface ReviewCard extends Card {
  showAnswer: boolean;
  startTime: Date;
  responseTime?: number;
}

export interface ReviewSession {
  id: string;
  deckId: string;
  cards: ReviewCard[];
  currentIndex: number;
  completed: number;
  correct: number;
  incorrect: number;
  startedAt: Date;
  completedAt?: Date;
}
