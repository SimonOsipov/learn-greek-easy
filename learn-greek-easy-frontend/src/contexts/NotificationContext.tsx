import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { toast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/useSSE';
import { reportAPIError } from '@/lib/errorReporting';
import { supabase } from '@/lib/supabaseClient';
import { APIRequestError } from '@/services/api';
import * as notificationAPI from '@/services/notificationAPI';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
import type { Notification } from '@/types/notification';
import type { SSEConnectionState, SSEEvent } from '@/types/sse';

// Export for testing purposes
export const NOTIFICATIONS_ENABLED_DEFAULT = true;

interface NotificationContextValue {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  notificationsEnabled: boolean;

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
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  const [tokenVersion, setTokenVersion] = useState(0);
  const [useFallbackPolling, setUseFallbackPolling] = useState(false);

  // Get auth state from store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  // Wait for auth to be validated with backend before making API calls
  const authInitialized = useAppStore((state) => state.authInitialized);

  // Get notification preference from user settings
  const notificationsEnabled = useAuthStore(
    (state) => state.user?.preferences?.notifications ?? NOTIFICATIONS_ENABLED_DEFAULT
  );

  // Tab visibility tracking
  useEffect(() => {
    const handler = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Token refresh listener — bump version to reconnect SSE with fresh token
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        setTokenVersion((v) => v + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (reset = false) => {
      // Don't fetch if not hydrated, not authenticated, or already fetching
      if (!hasHydrated || !isAuthenticated || isFetchingRef.current) return;

      // If notifications are disabled, clear and return early
      if (!notificationsEnabled) {
        setNotifications([]);
        setUnreadCount(0);
        setHasMore(false);
        setOffset(0);
        return;
      }

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
    [hasHydrated, isAuthenticated, notificationsEnabled, offset]
  );

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Refresh unread count only (for polling)
  const refreshUnreadCount = useCallback(async () => {
    if (!hasHydrated || !isAuthenticated || !authInitialized) return;

    // If notifications are disabled, ensure count is 0 and return
    if (!notificationsEnabled) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await notificationAPI.fetchUnreadCount();
      if (count > unreadCount) {
        // New notifications arrived, fetch them
        await fetchNotifications(true);
      } else {
        setUnreadCount(count);
      }
    } catch (err) {
      const isExpectedPollingError =
        err instanceof APIRequestError && (err.status === 401 || err.status === 408);
      if (!isExpectedPollingError) {
        reportAPIError(err, {
          operation: 'refreshUnreadCount',
          endpoint: '/notifications/unread-count',
        });
      }
    }
  }, [
    hasHydrated,
    isAuthenticated,
    authInitialized,
    notificationsEnabled,
    unreadCount,
    fetchNotifications,
  ]);

  // SSE event handler
  const handleSSEEvent = useCallback((event: SSEEvent<unknown>) => {
    if (event.type === 'unread_count') {
      setUnreadCount((event.data as { count: number }).count);
    } else if (event.type === 'new_notification') {
      const notifData = event.data as {
        id: string;
        type: string;
        title: string;
        message: string;
        icon?: string;
        action_url?: string;
      };
      setNotifications((prev) => [
        {
          id: notifData.id,
          type: notifData.type,
          title: notifData.title,
          message: notifData.message,
          icon: notifData.icon ?? null,
          action_url: notifData.action_url ?? null,
          read: false,
          read_at: null,
          created_at: new Date().toISOString(),
        } as any,
        ...prev,
      ]);
      setUnreadCount((prev) => prev + 1);
      toast({ title: notifData.title, description: notifData.message });
    }
  }, []);

  // SSE state change handler — fall back to polling on persistent error
  const handleSSEStateChange = useCallback((state: SSEConnectionState) => {
    if (state === 'error') {
      setUseFallbackPolling(true);
    } else if (state === 'connected') {
      setUseFallbackPolling(false);
    }
  }, []);

  // SSE connection — primary real-time channel
  useSSE(`/api/v1/notifications/stream?v=${tokenVersion}`, {
    enabled:
      hasHydrated && isAuthenticated && authInitialized && notificationsEnabled && tabVisible,
    onEvent: handleSSEEvent,
    onStateChange: handleSSEStateChange,
    maxRetries: 10,
  });

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationAPI.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      reportAPIError(err, { operation: 'markAsRead', endpoint: `/notifications/${id}/read` });
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
      reportAPIError(err, { operation: 'markAllAsRead', endpoint: '/notifications/read-all' });
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
        reportAPIError(err, { operation: 'deleteNotification', endpoint: `/notifications/${id}` });
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
      reportAPIError(err, { operation: 'clearAllNotifications', endpoint: '/notifications/clear' });
    }
  }, []);

  // Initial fetch when authenticated, hydrated, and auth validated with backend
  // Also re-fetch when notifications preference changes
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
  }, [hasHydrated, isAuthenticated, authInitialized, notificationsEnabled]); // Depend on hydration, auth state, auth validation, and notification preference

  // Fallback polling — only active when SSE fails permanently
  useEffect(() => {
    if (!useFallbackPolling || !hasHydrated || !isAuthenticated || !authInitialized) return;
    refreshUnreadCount();
    const intervalId = setInterval(() => refreshUnreadCount(), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [useFallbackPolling, hasHydrated, isAuthenticated, authInitialized, refreshUnreadCount]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      hasMore,
      notificationsEnabled,
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
      notificationsEnabled,
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
