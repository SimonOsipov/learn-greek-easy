// src/services/adminAPI.ts

/**
 * Admin API Service
 *
 * Provides methods for admin operations including:
 * - Fetching content statistics (deck and card counts)
 *
 * All endpoints require superuser authentication.
 */

import { api } from './api';

// ============================================
// Types
// ============================================

/**
 * CEFR language proficiency levels
 */
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Deck statistics in admin response
 */
export interface DeckStats {
  id: string;
  name: string;
  level: DeckLevel;
  card_count: number;
}

/**
 * Content statistics response from admin endpoint
 */
export interface ContentStatsResponse {
  total_decks: number;
  total_cards: number;
  decks: DeckStats[];
}

// ============================================
// Admin API Methods
// ============================================

export const adminAPI = {
  /**
   * Get content statistics for admin dashboard
   *
   * Returns counts of active decks and cards, plus per-deck breakdown.
   * Requires superuser authentication.
   */
  getContentStats: async (): Promise<ContentStatsResponse> => {
    return api.get<ContentStatsResponse>('/api/v1/admin/stats');
  },
};
