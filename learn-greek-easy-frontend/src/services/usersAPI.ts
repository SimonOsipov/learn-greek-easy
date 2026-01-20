// src/services/usersAPI.ts

/**
 * Users API Service
 *
 * Provides methods for user account management including:
 * - Reset all learning progress
 * - Delete user account
 *
 * WARNING: These operations are destructive and cannot be undone.
 */

import { api } from './api';

// ============================================
// Users API Methods
// ============================================

export const usersAPI = {
  /**
   * Reset all learning progress for the current user.
   *
   * This is a DESTRUCTIVE operation that will permanently delete:
   * - All card statistics and review history
   * - All deck progress
   * - All XP and achievements
   * - Study streaks and time tracking
   *
   * The user's account and preferences will be preserved.
   *
   * @returns Promise that resolves on success (204 No Content)
   */
  resetProgress: async (): Promise<void> => {
    await api.post<void>('/api/v1/users/me/reset-progress');
  },

  /**
   * Delete the current user's account and all associated data.
   *
   * This is a DESTRUCTIVE operation that will permanently delete:
   * - The user account
   * - All user settings and preferences
   * - All learning progress and statistics
   * - All review history
   * - All XP and achievements
   * - The Auth0 account
   *
   * The user will be logged out and their account will be permanently removed.
   *
   * @returns Promise that resolves on success (204 No Content)
   */
  deleteAccount: async (): Promise<void> => {
    await api.delete<void>('/api/v1/users/me');
  },
};
