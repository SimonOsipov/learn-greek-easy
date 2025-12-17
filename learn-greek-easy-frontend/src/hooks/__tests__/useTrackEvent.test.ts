/**
 * useTrackEvent Hook Tests
 * Tests all methods of the analytics tracking hook
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import posthog from 'posthog-js';

import { useTrackEvent } from '../useTrackEvent';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    people: {
      set: vi.fn(),
    },
  },
}));

describe('useTrackEvent Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('track()', () => {
    it('should call posthog.capture with event name and properties', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.track('deck_selected', { deck_id: 'test-123' });
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'deck_selected',
        expect.objectContaining({ deck_id: 'test-123' })
      );
    });

    it('should add timestamp to event properties when not provided', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.track('deck_selected', { deck_id: 'test' });
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'deck_selected',
        expect.objectContaining({ timestamp: expect.any(String) })
      );
    });

    it('should use provided timestamp if given', () => {
      const { result } = renderHook(() => useTrackEvent());
      const customTimestamp = '2025-01-01T00:00:00.000Z';

      act(() => {
        result.current.track('deck_selected', { timestamp: customTimestamp });
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'deck_selected',
        expect.objectContaining({ timestamp: customTimestamp })
      );
    });

    it('should work without properties', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.track('user_logged_out');
      });

      expect(posthog.capture).toHaveBeenCalledWith(
        'user_logged_out',
        expect.objectContaining({ timestamp: expect.any(String) })
      );
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.track('deck_selected');
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should not throw if posthog is undefined', () => {
      const originalCapture = posthog.capture;
      // Set capture to non-function value
      (posthog as Record<string, unknown>).capture = null;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.track('deck_selected');
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('identify()', () => {
    it('should call posthog.identify with user id and properties', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.identify('user-123', { email: 'test@example.com' });
      });

      expect(posthog.identify).toHaveBeenCalledWith('user-123', {
        email: 'test@example.com',
      });
    });

    it('should call posthog.identify with only user id if no properties', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.identify('user-456');
      });

      expect(posthog.identify).toHaveBeenCalledWith('user-456', undefined);
    });

    it('should pass complex properties to identify', () => {
      const { result } = renderHook(() => useTrackEvent());
      const userProps = {
        email: 'test@example.com',
        plan: 'premium',
        created_at: '2025-01-01',
        cards_reviewed: 100,
      };

      act(() => {
        result.current.identify('user-789', userProps);
      });

      expect(posthog.identify).toHaveBeenCalledWith('user-789', userProps);
    });

    it('should not throw if posthog.identify is undefined', () => {
      const originalIdentify = posthog.identify;
      (posthog as Record<string, unknown>).identify = undefined;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.identify('user-123');
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).identify = originalIdentify;
    });
  });

  describe('reset()', () => {
    it('should call posthog.reset on logout', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.reset();
      });

      expect(posthog.reset).toHaveBeenCalled();
    });

    it('should not throw if posthog.reset is undefined', () => {
      const originalReset = posthog.reset;
      (posthog as Record<string, unknown>).reset = undefined;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.reset();
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).reset = originalReset;
    });
  });

  describe('setUserProperties()', () => {
    it('should call posthog.people.set with properties', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.setUserProperties({ plan: 'premium', cards_reviewed: 100 });
      });

      expect(posthog.people.set).toHaveBeenCalledWith({
        plan: 'premium',
        cards_reviewed: 100,
      });
    });

    it('should handle empty properties object', () => {
      const { result } = renderHook(() => useTrackEvent());

      act(() => {
        result.current.setUserProperties({});
      });

      expect(posthog.people.set).toHaveBeenCalledWith({});
    });

    it('should not throw if posthog.people is undefined', () => {
      const originalPeople = posthog.people;
      (posthog as Record<string, unknown>).people = undefined;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.setUserProperties({ key: 'value' });
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).people = originalPeople;
    });

    it('should not throw if posthog.people.set is undefined', () => {
      const originalSet = posthog.people.set;
      (posthog.people as Record<string, unknown>).set = undefined;

      const { result } = renderHook(() => useTrackEvent());

      expect(() => {
        act(() => {
          result.current.setUserProperties({ key: 'value' });
        });
      }).not.toThrow();

      (posthog.people as Record<string, unknown>).set = originalSet;
    });
  });

  describe('Hook return value stability', () => {
    it('should return stable function references across re-renders', () => {
      const { result, rerender } = renderHook(() => useTrackEvent());

      const firstRender = {
        track: result.current.track,
        identify: result.current.identify,
        reset: result.current.reset,
        setUserProperties: result.current.setUserProperties,
      };

      rerender();

      // Functions should be stable (memoized with useCallback)
      expect(result.current.track).toBe(firstRender.track);
      expect(result.current.identify).toBe(firstRender.identify);
      expect(result.current.reset).toBe(firstRender.reset);
      expect(result.current.setUserProperties).toBe(firstRender.setUserProperties);
    });
  });
});
