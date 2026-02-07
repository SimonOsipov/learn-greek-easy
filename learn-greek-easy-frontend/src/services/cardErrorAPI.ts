// src/services/cardErrorAPI.ts

/**
 * Card Error API Service
 *
 * Provides methods for card error reporting operations.
 * Currently supports creating error reports from users.
 */

import type { CreateCardErrorRequest, CardErrorResponse } from '@/types/cardError';

import { api } from './api';

// ============================================
// Card Error API Methods
// ============================================

export const cardErrorAPI = {
  /**
   * Create a new card error report.
   *
   * @param data - The error report data
   * @returns The created error report
   * @throws APIRequestError on failure (400 for validation, 404 for card not found, 409 for duplicate)
   *
   * @example
   * ```ts
   * const report = await cardErrorAPI.create({
   *   card_type: 'WORD',
   *   card_id: 'uuid-here',
   *   description: 'The translation is incorrect',
   * });
   * ```
   */
  create: async (data: CreateCardErrorRequest): Promise<CardErrorResponse> => {
    return api.post<CardErrorResponse>('/api/v1/card-errors', data);
  },
};
