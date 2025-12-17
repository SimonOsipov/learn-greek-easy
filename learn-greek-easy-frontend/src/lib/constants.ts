// Application constants

export const APP_NAME = 'Learn Greek Easy';
export const APP_VERSION = '1.0.0';

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/',
  DECKS: '/decks',
  STATISTICS: '/statistics',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  LOGIN: '/login',
  REGISTER: '/register',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
  },
  DECKS: {
    LIST: '/api/decks',
    DETAIL: '/api/decks/:id',
    CARDS: '/api/decks/:id/cards',
  },
  REVIEWS: {
    DUE: '/api/reviews/due',
    SUBMIT: '/api/reviews',
    STATS: '/api/reviews/stats',
  },
  PROGRESS: {
    OVERVIEW: '/api/progress/overview',
    DECK: '/api/progress/deck/:id',
  },
} as const;

export const REVIEW_RATINGS = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
} as const;

export const CARD_STATUS = {
  NEW: 'new',
  LEARNING: 'learning',
  YOUNG: 'young',
  MATURE: 'mature',
} as const;
