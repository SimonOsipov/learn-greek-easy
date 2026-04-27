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
export type CardType = 'WORD' | 'CULTURE';

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
  /** Type of card: 'WORD' for word entries, 'CULTURE' for culture questions */
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
  badgeClass: string;
}

/**
 * Status display mapping for card error statuses.
 */
export const CARD_ERROR_STATUS_CONFIG: Record<CardErrorStatus, CardErrorStatusConfig> = {
  PENDING: {
    label: 'Pending',
    badgeClass: 'badge b-amber',
  },
  REVIEWED: {
    label: 'Reviewed',
    badgeClass: 'badge b-blue',
  },
  FIXED: {
    label: 'Fixed',
    badgeClass: 'badge b-green',
  },
  DISMISSED: {
    label: 'Dismissed',
    badgeClass: 'badge b-gray',
  },
};

/**
 * Card type display configuration.
 */
export const CARD_TYPE_CONFIG: Record<CardType, { label: string; icon: string }> = {
  WORD: {
    label: 'Word Entry',
    icon: 'book',
  },
  CULTURE: {
    label: 'Culture Question',
    icon: 'globe',
  },
};

// ============================================
// Admin Request Types
// ============================================

/**
 * Request payload for updating a card error report (admin only).
 * Sent to PATCH /api/v1/admin/card-errors/{id}
 */
export interface AdminCardErrorUpdateRequest {
  /** New status for the report (optional) */
  status?: CardErrorStatus;
  /** Admin notes about the resolution (max 1000 chars, optional) */
  admin_notes?: string;
}

/**
 * Parameters for listing card errors (admin only).
 * Query params for GET /api/v1/admin/card-errors
 */
export interface AdminCardErrorListParams {
  /** Filter by status */
  status?: CardErrorStatus;
  /** Filter by card type */
  card_type?: CardType;
  /** Page number (1-indexed, default: 1) */
  page?: number;
  /** Items per page (1-100, default: 20) */
  page_size?: number;
}

// ============================================
// Admin Response Types
// ============================================

/**
 * Brief reporter information for error report items.
 * Matches backend ReporterBriefResponse schema.
 */
export interface ReporterBrief {
  /** Reporter's user ID */
  id: string;
  /** Reporter's display name (null if not set) */
  full_name: string | null;
}

/**
 * Admin card error report response with full details.
 * Includes user_id, resolved_by, and reporter info not shown to regular users.
 * Matches backend AdminCardErrorReportResponse schema.
 */
export interface AdminCardErrorResponse {
  /** UUID of the error report */
  id: string;
  /** UUID of the reported card */
  card_id: string;
  /** Type of card reported */
  card_type: CardType;
  /** UUID of the user who reported the error */
  user_id: string;
  /** User's description of the error */
  description: string;
  /** Current status of the report */
  status: CardErrorStatus;
  /** Admin notes about the resolution (null until admin responds) */
  admin_notes: string | null;
  /** UUID of admin who resolved (null until resolved) */
  resolved_by: string | null;
  /** ISO 8601 timestamp when report was resolved (null until resolved) */
  resolved_at: string | null;
  /** Brief info about the reporter */
  reporter: ReporterBrief;
  /** ISO 8601 timestamp when report was created */
  created_at: string;
  /** ISO 8601 timestamp when report was last updated */
  updated_at: string;
}

/**
 * Paginated admin card error list response.
 * Matches backend AdminCardErrorReportListResponse schema.
 */
export interface AdminCardErrorListResponse {
  /** Total number of matching reports */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  page_size: number;
  /** List of card error reports */
  items: AdminCardErrorResponse[];
}
