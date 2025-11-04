// src/services/mockDeckData.ts

import type { Deck, DeckProgress } from '@/types/deck';

export const MOCK_DECKS: Deck[] = [
  {
    id: 'deck-a1-basics',
    title: 'A1 Basic Vocabulary',
    titleGreek: 'Βασικές Λέξεις A1',
    description:
      'Essential everyday vocabulary for beginners. Greetings, numbers, basic nouns and verbs.',
    level: 'A1',
    category: 'vocabulary',
    tags: ['beginner', 'essentials', 'everyday'],
    cardCount: 100,
    estimatedTime: 180, // 3 hours
    isPremium: false,
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: 'deck-a1-family',
    title: 'Family & Relationships',
    titleGreek: 'Οικογένεια και Σχέσεις',
    description: 'Words related to family members, relationships, and social connections.',
    level: 'A1',
    category: 'vocabulary',
    tags: ['family', 'social', 'relationships'],
    cardCount: 75,
    estimatedTime: 135, // 2.25 hours
    isPremium: false,
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: 'deck-a2-time',
    title: 'Numbers, Dates & Time',
    titleGreek: 'Αριθμοί, Ημερομηνίες & Ώρα',
    description: 'Master numbers, telling time, dates, days of the week, and temporal expressions.',
    level: 'A2',
    category: 'vocabulary',
    tags: ['numbers', 'time', 'dates', 'practical'],
    cardCount: 80,
    estimatedTime: 150, // 2.5 hours
    isPremium: false,
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-18'),
    updatedAt: new Date('2025-01-18'),
  },
  {
    id: 'deck-a2-food',
    title: 'Food & Dining',
    titleGreek: 'Φαγητό και Γεύμα',
    description: 'Essential vocabulary for restaurants, grocery shopping, and Greek cuisine.',
    level: 'A2',
    category: 'vocabulary',
    tags: ['food', 'dining', 'culture', 'practical'],
    cardCount: 120,
    estimatedTime: 220, // 3.7 hours
    isPremium: true, // Premium deck
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: 'deck-a1-travel',
    title: 'Travel & Transportation',
    titleGreek: 'Ταξίδια και Μεταφορές',
    description: 'Navigate Greece confidently with essential travel vocabulary.',
    level: 'A1',
    category: 'vocabulary',
    tags: ['travel', 'transportation', 'practical'],
    cardCount: 90,
    estimatedTime: 165, // 2.75 hours
    isPremium: false,
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date('2025-01-22'),
  },
  {
    id: 'deck-a2-workplace',
    title: 'Work & Professional Life',
    titleGreek: 'Εργασία και Επαγγελματική Ζωή',
    description: 'Professional vocabulary for workplace communication and job interviews.',
    level: 'A2',
    category: 'vocabulary',
    tags: ['work', 'professional', 'career'],
    cardCount: 110,
    estimatedTime: 200, // 3.3 hours
    isPremium: true, // Premium deck
    createdBy: 'Learn Greek Easy',
    createdAt: new Date('2025-01-25'),
    updatedAt: new Date('2025-01-25'),
  },
];

/**
 * Mock progress data for demonstration
 * In real app, this would come from user's learning history
 */
export const MOCK_PROGRESS: Record<string, DeckProgress> = {
  'deck-a1-basics': {
    deckId: 'deck-a1-basics',
    status: 'in-progress',
    cardsTotal: 100,
    cardsNew: 32,
    cardsLearning: 45,
    cardsReview: 0,
    cardsMastered: 23,
    dueToday: 12,
    streak: 12,
    lastStudied: new Date('2025-10-29'),
    totalTimeSpent: 380, // minutes
    accuracy: 78,
  },
  'deck-a1-family': {
    deckId: 'deck-a1-family',
    status: 'completed',
    cardsTotal: 75,
    cardsNew: 0,
    cardsLearning: 5,
    cardsReview: 15,
    cardsMastered: 55,
    dueToday: 8,
    streak: 18,
    lastStudied: new Date('2025-10-28'),
    totalTimeSpent: 240,
    accuracy: 92,
  },
  'deck-a2-time': {
    deckId: 'deck-a2-time',
    status: 'not-started',
    cardsTotal: 80,
    cardsNew: 80,
    cardsLearning: 0,
    cardsReview: 0,
    cardsMastered: 0,
    dueToday: 0,
    streak: 0,
    totalTimeSpent: 0,
    accuracy: 0,
  },
};
