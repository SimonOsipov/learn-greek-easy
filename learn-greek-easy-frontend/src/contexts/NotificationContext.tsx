import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as notificationAPI from '@/services/notificationAPI';
import { useAuthStore } from '@/stores/authStore';
import type { Notification } from '@/types/notification';

interface NotificationContextValue {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;

  // Actions
  fetchNotifications: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;

  // Toast management
  activeToasts: Notification[];
  showToast: (notification: Notification) => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const POLLING_INTERVAL = 60000; // 60 seconds
const PAGE_SIZE = 20;
const MAX_TOASTS = 3;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeToasts, setActiveToasts] = useState<Notification[]>([]);
  const previousUnreadCountRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Get auth state from store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Toast management
  const showToast = useCallback((notification: Notification) => {
    setActiveToasts((prev) => {
      if (prev.some((t) => t.id === notification.id)) return prev;
      const newToasts = [...prev, notification];
      return newToasts.slice(-MAX_TOASTS); // Keep only last MAX_TOASTS
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (reset = false) => {
      // Don't fetch if not authenticated or already fetching
      if (!isAuthenticated || isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;
        const response = await notificationAPI.fetchNotifications({
          limit: PAGE_SIZE,
          offset: currentOffset,
        });

        if (reset) {
          setNotifications(response.notifications);
          setOffset(PAGE_SIZE);
        } else {
          setNotifications((prev) => [...prev, ...response.notifications]);
          setOffset((prev) => prev + PAGE_SIZE);
        }

        setUnreadCount(response.unread_count);
        setHasMore(response.has_more);

        // Show toast for new notifications
        if (reset && response.unread_count > previousUnreadCountRef.current) {
          const newCount = response.unread_count - previousUnreadCountRef.current;
          const newNotifications = response.notifications
            .filter((n) => !n.read)
            .slice(0, Math.min(newCount, MAX_TOASTS));
          newNotifications.forEach((n) => showToast(n));
        }
        previousUnreadCountRef.current = response.unread_count;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [isAuthenticated, offset, showToast]
  );

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Refresh unread count only (for polling)
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const count = await notificationAPI.fetchUnreadCount();
      if (count > unreadCount) {
        // New notifications arrived, fetch them
        await fetchNotifications(true);
      } else {
        setUnreadCount(count);
      }
    } catch (err) {
      console.error('Failed to refresh unread count:', err);
    }
  }, [isAuthenticated, unreadCount, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationAPI.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationAPI.markAllNotificationsAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: now })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        const notification = notifications.find((n) => n.id === id);
        await notificationAPI.deleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }
    },
    [notifications]
  );

  // Clear all
  const clearAll = useCallback(async () => {
    try {
      await notificationAPI.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setOffset(0);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, []);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(true);
    } else {
      // Reset state when logged out
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setOffset(0);
      setActiveToasts([]);
      previousUnreadCountRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Intentionally only depend on isAuthenticated

  // Polling for new notifications - use ref to avoid recreating interval
  const refreshUnreadCountRef = useRef(refreshUnreadCount);
  refreshUnreadCountRef.current = refreshUnreadCount;

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refreshUnreadCountRef.current();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated]); // Only depend on isAuthenticated for stable interval

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      hasMore,
      fetchNotifications,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      refreshUnreadCount,
      activeToasts,
      showToast,
      dismissToast,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      error,
      hasMore,
      fetchNotifications,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      refreshUnreadCount,
      activeToasts,
      showToast,
      dismissToast,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
