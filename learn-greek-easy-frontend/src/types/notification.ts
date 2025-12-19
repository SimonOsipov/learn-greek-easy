// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification type categories
 * Used for icon/color selection and filtering
 */
export type NotificationType =
  | 'streak_milestone' // Streak achievements (fire icon, orange)
  | 'deck_completed' // Finished a deck (trophy icon, green)
  | 'cards_due' // Cards ready for review (book icon, blue)
  | 'achievement' // General achievements (star icon, purple)
  | 'system'; // System announcements (info icon, gray)

/**
 * Single notification item
 *
 * @remarks
 * Structure designed to match future API response format.
 * For mock-up phase, `read` status is visual-only (no persistence).
 */
export interface Notification {
  /** Unique identifier */
  id: string;

  /** Category for icon/color selection */
  type: NotificationType;

  /** Main notification text (bold) */
  title: string;

  /** Supporting details (muted text) */
  message: string;

  /** When notification was created */
  timestamp: Date;

  /** Read status - affects visual styling */
  read: boolean;

  /** Optional: URL to navigate to when clicked */
  href?: string;
}

/**
 * Notification icon configuration
 * Maps notification types to icons and colors
 */
export interface NotificationIconConfig {
  /** Lucide icon name */
  icon: string;
  /** Tailwind color class */
  colorClass: string;
}

/**
 * Future: API response structure for notifications endpoint
 *
 * @remarks
 * Kept here for reference during backend integration
 */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  /** Pagination cursor */
  cursor?: string;
}
