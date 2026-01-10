// ============================================================================
// Notification Types (Matching Backend API)
// ============================================================================

/**
 * Notification type categories matching backend enum
 */
export type NotificationType =
  | 'achievement_unlocked'
  | 'daily_goal_complete'
  | 'level_up'
  | 'streak_at_risk'
  | 'streak_lost'
  | 'welcome'
  | 'feedback_response'
  | 'feedback_status_change';

/**
 * Single notification from API
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  action_url: string | null;
  extra_data: Record<string, unknown> | null; // Context data
  read: boolean;
  read_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
}

/**
 * API response for notification list
 */
export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
  total_count: number;
  has_more: boolean;
}

/**
 * API response for unread count
 */
export interface UnreadCountResponse {
  count: number;
}

/**
 * API response for mark as read
 */
export interface MarkReadResponse {
  success: boolean;
  marked_count: number;
}

/**
 * API response for clear operations
 */
export interface ClearResponse {
  success: boolean;
  deleted_count: number;
}

/**
 * Icon configuration for notification types
 */
export interface NotificationIconConfig {
  icon: string;
  colorClass: string;
}

/**
 * Notification type to icon/color mapping
 */
export const NOTIFICATION_CONFIG: Record<NotificationType, NotificationIconConfig> = {
  achievement_unlocked: { icon: 'Trophy', colorClass: 'text-warning' },
  daily_goal_complete: { icon: 'CheckCircle', colorClass: 'text-success' },
  level_up: { icon: 'ArrowUp', colorClass: 'text-primary' },
  streak_at_risk: { icon: 'Flame', colorClass: 'text-warning' },
  streak_lost: { icon: 'HeartCrack', colorClass: 'text-destructive' },
  welcome: { icon: 'Hand', colorClass: 'text-info' },
  feedback_response: { icon: 'MessageSquareText', colorClass: 'text-info' },
  feedback_status_change: { icon: 'RefreshCw', colorClass: 'text-primary' },
};
