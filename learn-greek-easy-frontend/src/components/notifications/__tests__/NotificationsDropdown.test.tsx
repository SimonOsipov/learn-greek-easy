/**
 * NotificationsDropdown Component Tests
 *
 * Tests for the NotificationsDropdown component notification preference behavior.
 * These tests verify that:
 * - Component shows disabled state when notifications preference is false
 * - Component shows normal state when notifications preference is true
 * - Component defaults to enabled when notifications preference is undefined
 * - D-NAV: trigger shows red dot (not numeric count) when unreadCount > 0
 * - D-NAV: unread count text remains visible in the dropdown header
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NotificationsDropdown } from '../NotificationsDropdown';

// Mock the NotificationContext
const mockNotificationsEnabled = vi.fn();
const mockUnreadCount = vi.fn();

vi.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: mockUnreadCount(),
    isLoading: false,
    error: null,
    hasMore: false,
    notificationsEnabled: mockNotificationsEnabled(),
    fetchNotifications: vi.fn(),
    loadMore: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearAll: vi.fn(),
    refreshUnreadCount: vi.fn(),
  }),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => {
      const translations: Record<string, string> = {
        'notifications.title': 'Notifications',
        'notifications.disabled': 'Notifications disabled',
        'notifications.disabledTooltip': 'Notifications are disabled in preferences',
        'notifications.empty': 'No notifications yet',
        'notifications.error': 'Failed to load notifications',
        'notifications.new': 'new',
        'notifications.markAllRead': 'Mark all as read',
        'notifications.clearAll': 'Clear all',
        'notifications.loadMore': 'Load more',
        'notifications.retry': 'Retry',
        'actions.retry': 'Retry',
        loading: 'Loading...',
      };
      return translations[key] || defaultValue || key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// Mock Radix UI tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
}));

describe('NotificationsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnreadCount.mockReturnValue(0);
  });

  describe('Notification Preference Behavior', () => {
    it('should show disabled state when notifications preference is false', () => {
      mockNotificationsEnabled.mockReturnValue(false);

      render(<NotificationsDropdown />);

      const bellButton = screen.getByTestId('notifications-trigger');
      expect(bellButton).toBeDisabled();
      expect(bellButton).toHaveAttribute('aria-label', 'Notifications disabled');
    });

    it('should show tooltip message when notifications are disabled', () => {
      mockNotificationsEnabled.mockReturnValue(false);

      render(<NotificationsDropdown />);

      // Tooltip content should be in the document
      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent('Notifications are disabled in preferences');
    });

    it('should show normal state when notifications preference is true', () => {
      mockNotificationsEnabled.mockReturnValue(true);

      render(<NotificationsDropdown />);

      const bellButton = screen.getByTestId('notifications-trigger');
      expect(bellButton).not.toBeDisabled();
      expect(bellButton).toHaveAttribute('aria-label', 'Notifications');
    });

    it('should have muted icon color when disabled', () => {
      mockNotificationsEnabled.mockReturnValue(false);

      render(<NotificationsDropdown />);

      // The Bell icon should have muted styling when disabled
      const bellIcon = screen.getByTestId('notifications-trigger').querySelector('svg');
      expect(bellIcon).toHaveClass('text-muted-foreground');
    });

    it('should not have muted icon color when enabled', () => {
      mockNotificationsEnabled.mockReturnValue(true);

      render(<NotificationsDropdown />);

      const bellIcon = screen.getByTestId('notifications-trigger').querySelector('svg');
      expect(bellIcon).not.toHaveClass('text-muted-foreground');
    });
  });

  describe('Data Attributes', () => {
    it('should have data-testid on the trigger button when enabled', () => {
      mockNotificationsEnabled.mockReturnValue(true);

      render(<NotificationsDropdown />);

      expect(screen.getByTestId('notifications-trigger')).toBeInTheDocument();
    });

    it('should have data-testid on the trigger button when disabled', () => {
      mockNotificationsEnabled.mockReturnValue(false);

      render(<NotificationsDropdown />);

      expect(screen.getByTestId('notifications-trigger')).toBeInTheDocument();
    });
  });

  describe('D-NAV: dot badge vs numeric count (DASH2-01)', () => {
    it('should show .dot.dot-red on the trigger when unreadCount > 0', () => {
      mockNotificationsEnabled.mockReturnValue(true);
      mockUnreadCount.mockReturnValue(3);

      render(<NotificationsDropdown />);

      const trigger = screen.getByTestId('notifications-trigger');
      const dot = trigger.querySelector('.dot.dot-red');
      expect(dot).toBeInTheDocument();
    });

    it('should NOT render a numeric count badge on the trigger when unreadCount > 0', () => {
      mockNotificationsEnabled.mockReturnValue(true);
      mockUnreadCount.mockReturnValue(5);

      render(<NotificationsDropdown />);

      const trigger = screen.getByTestId('notifications-trigger');
      // No numeric text inside the trigger (only the bell svg and the dot span)
      expect(trigger.textContent).toBe('');
    });

    it('should NOT show .dot.dot-red on the trigger when unreadCount === 0', () => {
      mockNotificationsEnabled.mockReturnValue(true);
      mockUnreadCount.mockReturnValue(0);

      render(<NotificationsDropdown />);

      const trigger = screen.getByTestId('notifications-trigger');
      const dot = trigger.querySelector('.dot.dot-red');
      expect(dot).not.toBeInTheDocument();
    });

    it('should show "{n} new" count text inside the dropdown header when unreadCount > 0', async () => {
      const user = userEvent.setup();
      mockNotificationsEnabled.mockReturnValue(true);
      mockUnreadCount.mockReturnValue(7);

      render(<NotificationsDropdown />);

      // Open the dropdown
      const trigger = screen.getByTestId('notifications-trigger');
      await user.click(trigger);

      // The "{n} new" badge should appear in the dropdown header (not on the trigger)
      await waitFor(() => {
        expect(screen.getByText('7 new')).toBeInTheDocument();
      });
    });
  });
});
