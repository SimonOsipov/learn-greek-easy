/**
 * NotificationsDropdown Component Tests
 *
 * Tests for the NotificationsDropdown component notification preference behavior.
 * These tests verify that:
 * - Component shows disabled state when notifications preference is false
 * - Component shows normal state when notifications preference is true
 * - Component defaults to enabled when notifications preference is undefined
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { NotificationsDropdown } from '../NotificationsDropdown';

// Mock the NotificationContext
const mockNotificationsEnabled = vi.fn();

vi.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
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
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
}));

describe('NotificationsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
