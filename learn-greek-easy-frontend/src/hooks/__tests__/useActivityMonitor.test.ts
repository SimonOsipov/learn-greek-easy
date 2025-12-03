/**
 * useActivityMonitor Hook Tests
 * Tests session timeout and activity monitoring
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useActivityMonitor } from '@/hooks/useActivityMonitor';
import { useAuthStore } from '@/stores/authStore';

// Mock dependencies
const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    logout: mockLogout,
    isAuthenticated: true,
  }),
}));

// Mock sessionManager
const mockStartInactivityTimer = vi.fn();
const mockExtendSession = vi.fn();
const mockCleanup = vi.fn();
const mockGetActivityEvents = vi.fn(() => ['mousedown', 'keydown', 'scroll', 'touchstart']);

vi.mock('@/utils/sessionManager', () => ({
  sessionManager: {
    startInactivityTimer: (...args: any[]) => mockStartInactivityTimer(...args),
    extendSession: (...args: any[]) => mockExtendSession(...args),
    cleanup: () => mockCleanup(),
    getActivityEvents: () => mockGetActivityEvents(),
  },
}));

describe('useActivityMonitor Hook', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('Initial State', () => {
    it('should initialize with no warning', () => {
      const { result } = renderHook(() => useActivityMonitor());

      expect(result.current.showWarning).toBe(false);
      expect(result.current.remainingSeconds).toBe(300);
    });

    it('should provide extendSession function', () => {
      const { result } = renderHook(() => useActivityMonitor());
      expect(typeof result.current.extendSession).toBe('function');
    });
  });

  describe('Timer Setup', () => {
    it('should start inactivity timer on mount when authenticated', () => {
      renderHook(() => useActivityMonitor());

      expect(mockStartInactivityTimer).toHaveBeenCalled();
    });

    it('should register activity event listeners', () => {
      renderHook(() => useActivityMonitor());

      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

      activityEvents.forEach((event) => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useActivityMonitor());

      unmount();

      expect(mockCleanup).toHaveBeenCalled();

      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      activityEvents.forEach((event) => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout by logging out', () => {
      renderHook(() => useActivityMonitor());

      // Get the timeout callback
      const timeoutCallback = mockStartInactivityTimer.mock.calls[0]?.[0];

      // Trigger timeout
      act(() => {
        timeoutCallback();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Session expired',
        description: "You've been logged out due to inactivity.",
        variant: 'destructive',
      });
    });
  });

  describe('Warning Handling', () => {
    it('should show warning when warning callback is triggered', () => {
      const { result } = renderHook(() => useActivityMonitor());

      expect(result.current.showWarning).toBe(false);

      // Get the warning callback
      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];

      // Trigger warning with remaining seconds
      act(() => {
        warningCallback(180);
      });

      expect(result.current.showWarning).toBe(true);
      expect(result.current.remainingSeconds).toBe(180);
    });

    it('should update remaining seconds on countdown', () => {
      const { result } = renderHook(() => useActivityMonitor());

      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];

      // Trigger warning
      act(() => {
        warningCallback(300);
      });

      expect(result.current.remainingSeconds).toBe(300);

      // Countdown tick
      act(() => {
        warningCallback(299);
      });

      expect(result.current.remainingSeconds).toBe(299);
    });
  });

  describe('Session Extension', () => {
    it('should extend session and hide warning', () => {
      const { result } = renderHook(() => useActivityMonitor());

      // Trigger warning first
      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];
      act(() => {
        warningCallback(100);
      });

      expect(result.current.showWarning).toBe(true);

      // Extend session
      act(() => {
        result.current.extendSession();
      });

      expect(result.current.showWarning).toBe(false);
      expect(result.current.remainingSeconds).toBe(300);
      expect(mockExtendSession).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Session extended',
        description: 'Your session has been extended for another 30 minutes.',
      });
    });

    it('should restart timers when extending session', () => {
      const { result } = renderHook(() => useActivityMonitor());

      mockExtendSession.mockClear();

      act(() => {
        result.current.extendSession();
      });

      expect(mockExtendSession).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    });
  });

  describe('Activity Reset', () => {
    it('should not reset timer when warning is showing', () => {
      const { result } = renderHook(() => useActivityMonitor());

      // Show warning
      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];
      act(() => {
        warningCallback(100);
      });

      expect(result.current.showWarning).toBe(true);

      mockExtendSession.mockClear();

      // Simulate user activity
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      // Should not reset timer when warning is active
      expect(mockExtendSession).not.toHaveBeenCalled();
    });

    it('should reset timer on activity when warning is not showing', () => {
      renderHook(() => useActivityMonitor());

      mockExtendSession.mockClear();

      // Simulate user activity
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      expect(mockExtendSession).toHaveBeenCalled();
    });

    it('should handle all activity events', () => {
      renderHook(() => useActivityMonitor());

      mockExtendSession.mockClear();

      const activityEvents = [
        new MouseEvent('mousedown'),
        new KeyboardEvent('keydown'),
        new Event('scroll'),
        new TouchEvent('touchstart'),
      ];

      activityEvents.forEach((event) => {
        mockExtendSession.mockClear();

        act(() => {
          document.dispatchEvent(event);
        });

        expect(mockExtendSession).toHaveBeenCalled();
      });
    });
  });

  describe('Authentication State', () => {
    it('should start timer when user is authenticated', () => {
      renderHook(() => useActivityMonitor());

      expect(mockStartInactivityTimer).toHaveBeenCalled();
      expect(mockGetActivityEvents).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid consecutive activities', () => {
      renderHook(() => useActivityMonitor());

      mockExtendSession.mockClear();

      // Simulate rapid mouse movements
      act(() => {
        for (let i = 0; i < 10; i++) {
          document.dispatchEvent(new MouseEvent('mousedown'));
        }
      });

      // Should call extendSession for each event
      expect(mockExtendSession.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle countdown reaching zero', () => {
      const { result } = renderHook(() => useActivityMonitor());

      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];

      // Countdown to zero
      act(() => {
        warningCallback(5);
      });

      expect(result.current.remainingSeconds).toBe(5);

      act(() => {
        warningCallback(0);
      });

      expect(result.current.remainingSeconds).toBe(0);
    });

    it('should reset remaining seconds to 300 on extend', () => {
      const { result } = renderHook(() => useActivityMonitor());

      // Trigger warning with low time
      const warningCallback = mockStartInactivityTimer.mock.calls[0]?.[1];
      act(() => {
        warningCallback(30);
      });

      expect(result.current.remainingSeconds).toBe(30);

      // Extend session
      act(() => {
        result.current.extendSession();
      });

      expect(result.current.remainingSeconds).toBe(300);
    });
  });

  describe('Multiple Hook Instances', () => {
    it('should register event listeners on mount', () => {
      renderHook(() => useActivityMonitor());

      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

      activityEvents.forEach((event) => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });
  });
});
