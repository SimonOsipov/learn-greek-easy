import { api } from '@/services/api';
import type {
  ClearResponse,
  MarkReadResponse,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';

const BASE_URL = '/api/v1/notifications';

/**
 * Fetch notifications for current user
 */
export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  include_read?: boolean;
}): Promise<NotificationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.include_read !== undefined) {
    searchParams.set('include_read', String(params.include_read));
  }

  const url = searchParams.toString() ? `${BASE_URL}?${searchParams}` : BASE_URL;
  const response = await api.get<NotificationListResponse>(url);
  return response;
}

/**
 * Get unread notification count
 */
export async function fetchUnreadCount(): Promise<number> {
  const response = await api.get<UnreadCountResponse>(`${BASE_URL}/unread-count`);
  return response.count;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<MarkReadResponse> {
  const response = await api.put<MarkReadResponse>(`${BASE_URL}/${notificationId}/read`);
  return response;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<MarkReadResponse> {
  const response = await api.put<MarkReadResponse>(`${BASE_URL}/read-all`);
  return response;
}

/**
 * Delete a single notification
 */
export async function deleteNotification(notificationId: string): Promise<ClearResponse> {
  const response = await api.delete<ClearResponse>(`${BASE_URL}/${notificationId}`);
  return response;
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<ClearResponse> {
  const response = await api.delete<ClearResponse>(`${BASE_URL}/clear`);
  return response;
}
