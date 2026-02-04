// src/types/cardError.ts

/**
 * Card Error Report Types
 *
 * TypeScript type definitions for the card error reporting feature.
 * Allows users to report errors on vocabulary cards and culture questions.
 */

// ============================================
// Enums
// ============================================

/**
 * Type of card being reported.
 * Must match backend CardErrorCardType enum values exactly (UPPERCASE).
 */
export type CardType = 'VOCABULARY' | 'CULTURE';

/**
 * Status of a card error report.
 * Must match backend CardErrorStatus enum values exactly (UPPERCASE).
 */
export type CardErrorStatus = 'PENDING' | 'REVIEWED' | 'FIXED' | 'DISMISSED';

// ============================================
// Request Types
// ============================================

/**
 * Request payload for creating a card error report.
 * Sent to POST /api/v1/card-errors
 */
export interface CreateCardErrorRequest {
  /** UUID of the card being reported */
  card_id: string;
  /** Type of card: 'VOCABULARY' for flashcards, 'CULTURE' for culture questions */
  card_type: CardType;
  /** User's description of the error (max 1000 characters) */
  description: string;
}

// ============================================
// Response Types
// ============================================

/**
 * Response from creating a card error report.
 * Returned by POST /api/v1/card-errors
 */
export interface CardErrorResponse {
  /** UUID of the created error report */
  id: string;
  /** UUID of the reported card */
  card_id: string;
  /** Type of card reported */
  card_type: CardType;
  /** User's description of the error */
  description: string;
  /** Current status of the report */
  status: CardErrorStatus;
  /** Admin notes about the resolution (null until admin responds) */
  admin_notes: string | null;
  /** ISO 8601 timestamp when report was resolved (null until resolved) */
  resolved_at: string | null;
  /** ISO 8601 timestamp when report was created */
  created_at: string;
  /** ISO 8601 timestamp when report was last updated */
  updated_at: string;
}

// ============================================
// UI Helper Types
// ============================================

/**
 * Status display configuration for UI badges.
 * Follows pattern from feedback.ts STATUS_CONFIG.
 */
export interface CardErrorStatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Status display mapping for card error statuses.
 */
export const CARD_ERROR_STATUS_CONFIG: Record<CardErrorStatus, CardErrorStatusConfig> = {
  PENDING: {
    label: 'Pending',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/50',
  },
  REVIEWED: {
    label: 'Reviewed',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
  },
  FIXED: {
    label: 'Fixed',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/50',
  },
  DISMISSED: {
    label: 'Dismissed',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
};

/**
 * Card type display configuration.
 */
export const CARD_TYPE_CONFIG: Record<CardType, { label: string; icon: string }> = {
  VOCABULARY: {
    label: 'Vocabulary Card',
    icon: 'book',
  },
  CULTURE: {
    label: 'Culture Question',
    icon: 'globe',
  },
};
