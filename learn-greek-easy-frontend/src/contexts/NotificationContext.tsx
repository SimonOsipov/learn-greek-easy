import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import log from '@/lib/logger';
import * as notificationAPI from '@/services/notificationAPI';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
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
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const POLLING_INTERVAL = 60000; // 60 seconds
const PAGE_SIZE = 20;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const previousUnreadCountRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Get auth state from store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  // Wait for auth to be validated with backend before making API calls
  const authInitialized = useAppStore((state) => state.authInitialized);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (reset = false) => {
      // Don't fetch if not hydrated, not authenticated, or already fetching
      if (!hasHydrated || !isAuthenticated || isFetchingRef.current) return;

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

        previousUnreadCountRef.current = response.unread_count;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [hasHydrated, isAuthenticated, offset]
  );

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Refresh unread count only (for polling)
  const refreshUnreadCount = useCallback(async () => {
    if (!hasHydrated || !isAuthenticated || !authInitialized) return;

    try {
      const count = await notificationAPI.fetchUnreadCount();
      if (count > unreadCount) {
        // New notifications arrived, fetch them
        await fetchNotifications(true);
      } else {
        setUnreadCount(count);
      }
    } catch (err) {
      log.error('Failed to refresh unread count:', err);
    }
  }, [hasHydrated, isAuthenticated, authInitialized, unreadCount, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationAPI.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      log.error('Failed to mark as read:', err);
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
      log.error('Failed to mark all as read:', err);
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
        log.error('Failed to delete notification:', err);
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
      log.error('Failed to clear notifications:', err);
    }
  }, []);

  // Initial fetch when authenticated, hydrated, and auth validated with backend
  useEffect(() => {
    if (hasHydrated && isAuthenticated && authInitialized) {
      fetchNotifications(true);
    } else if (!isAuthenticated) {
      // Reset state when logged out
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setOffset(0);
      previousUnreadCountRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, isAuthenticated, authInitialized]); // Depend on hydration, auth state, and auth validation

  // Polling for new notifications - use ref to avoid recreating interval
  const refreshUnreadCountRef = useRef(refreshUnreadCount);
  refreshUnreadCountRef.current = refreshUnreadCount;

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !authInitialized) return;

    const interval = setInterval(() => {
      refreshUnreadCountRef.current();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [hasHydrated, isAuthenticated, authInitialized]); // Depend on hydration, auth, and auth validation for stable interval

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
