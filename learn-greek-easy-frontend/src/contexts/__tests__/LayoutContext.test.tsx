/**
 * LayoutContext Tests
 *
 * Tests for the layout context and provider functionality.
 * These tests verify that:
 * - Breakpoint booleans are correct at boundary values (767/768/1023/1024)
 * - Sidebar auto-closes on resize to desktop (>= 1024), not on mobile/tablet
 * - Resize event listener is cleaned up on unmount
 * - useLayoutContext throws when used outside LayoutProvider
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { LayoutProvider, useLayoutContext } from '../LayoutContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LayoutProvider>{children}</LayoutProvider>
);

/** Fire a 'resize' event after setting window.innerWidth to the given value. */
function fireResize(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Start each test at a known width (desktop)
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1024,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useLayoutContext — outside provider
// ---------------------------------------------------------------------------

describe('useLayoutContext hook', () => {
  it('throws when used outside LayoutProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLayoutContext());
    }).toThrow('useLayoutContext must be used within LayoutProvider');

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Breakpoint booleans
// ---------------------------------------------------------------------------

describe('breakpoint booleans', () => {
  describe('isMobile', () => {
    it('is true at width 767 (one below mobile threshold)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 767,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('is false at width 768 (tablet threshold)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 768,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isMobile).toBe(false);
    });
  });

  describe('isTablet', () => {
    it('is true at width 768 (lower tablet boundary)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 768,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('is true at width 1023 (one below desktop threshold)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1023,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('is false at width 1024 (desktop threshold)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1024,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isTablet).toBe(false);
    });
  });

  describe('isDesktop', () => {
    it('is true at width 1024 (lower desktop boundary)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1024,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });

    it('is false at width 1023 (one below desktop threshold)', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1023,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isDesktop).toBe(false);
    });
  });

  describe('breakpoints update on resize', () => {
    it('transitions from desktop to tablet on resize to 1023', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1024,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isDesktop).toBe(true);

      act(() => {
        fireResize(1023);
      });

      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isTablet).toBe(true);
    });

    it('transitions from tablet to mobile on resize to 767', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 768,
      });
      const { result } = renderHook(() => useLayoutContext(), { wrapper });
      expect(result.current.isTablet).toBe(true);

      act(() => {
        fireResize(767);
      });

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-close sidebar on resize
// ---------------------------------------------------------------------------

describe('sidebar auto-close on resize', () => {
  it('auto-closes sidebar when resizing to desktop (>= 1024)', () => {
    // Start at tablet width so sidebar can be opened
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 768 });
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    // Open the sidebar
    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    // Resize to desktop
    act(() => {
      fireResize(1024);
    });

    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('does NOT auto-close sidebar when resizing within mobile range', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 400 });
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    act(() => {
      fireResize(350);
    });

    expect(result.current.isSidebarOpen).toBe(true);
  });

  it('does NOT auto-close sidebar when resizing within tablet range', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 800 });
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    act(() => {
      fireResize(900);
    });

    expect(result.current.isSidebarOpen).toBe(true);
  });

  it('auto-closes sidebar at exactly 1024', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1023,
    });
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    act(() => {
      fireResize(1024);
    });

    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('does NOT auto-close at 1023 (one below desktop threshold)', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 768 });
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    act(() => {
      fireResize(1023);
    });

    expect(result.current.isSidebarOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resize listener cleanup
// ---------------------------------------------------------------------------

describe('resize listener cleanup', () => {
  it('removes the resize event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useLayoutContext(), { wrapper });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('does not update state after unmount', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 800 });
    const { unmount } = renderHook(() => useLayoutContext(), { wrapper });

    unmount();

    // After unmount, firing resize should not throw or cause warnings
    expect(() => {
      act(() => {
        fireResize(1024);
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sidebar controls
// ---------------------------------------------------------------------------

describe('sidebar controls', () => {
  beforeEach(() => {
    // Use non-desktop width so sidebar auto-close doesn't interfere
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 800 });
  });

  it('isSidebarOpen starts as false', () => {
    const { result } = renderHook(() => useLayoutContext(), { wrapper });
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('toggleSidebar opens the sidebar', () => {
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.isSidebarOpen).toBe(true);
  });

  it('toggleSidebar closes the sidebar when already open', () => {
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('closeSidebar closes the sidebar', () => {
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);

    act(() => {
      result.current.closeSidebar();
    });

    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('closeSidebar is a no-op when already closed', () => {
    const { result } = renderHook(() => useLayoutContext(), { wrapper });

    act(() => {
      result.current.closeSidebar();
    });

    expect(result.current.isSidebarOpen).toBe(false);
  });
});
