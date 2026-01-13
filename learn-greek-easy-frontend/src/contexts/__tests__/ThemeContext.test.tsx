/**
 * ThemeContext Tests
 *
 * Tests for the theme context and provider functionality.
 * These tests verify that:
 * - Context provides current theme correctly
 * - Theme can be toggled and set explicitly
 * - Theme persists to localStorage
 * - .dark class is applied/removed from document
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ThemeContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document classList
    document.documentElement.classList.remove('dark', 'theme-transition');
  });

  afterEach(() => {
    // Clean up document classList after tests
    document.documentElement.classList.remove('dark', 'theme-transition');
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });

    it('should provide currentTheme', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(['light', 'dark']).toContain(result.current.currentTheme);
    });

    it('should provide toggleTheme function', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(typeof result.current.toggleTheme).toBe('function');
    });

    it('should provide setTheme function', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(typeof result.current.setTheme).toBe('function');
    });

    it('should provide isChanging state', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(typeof result.current.isChanging).toBe('boolean');
    });
  });

  describe('Initial Theme', () => {
    it('should default to light theme when localStorage is empty', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('light');
    });

    it('should read dark theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('dark');
    });

    it('should read light theme from localStorage', () => {
      localStorage.setItem('theme', 'light');
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('light');
    });

    it('should default to light for invalid localStorage value', () => {
      localStorage.setItem('theme', 'invalid');
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('light');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.currentTheme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      localStorage.setItem('theme', 'dark');
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.currentTheme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.currentTheme).toBe('light');
    });

    it('should accept source parameter', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme('settings');
      });

      expect(result.current.currentTheme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should set theme to dark', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.currentTheme).toBe('dark');
    });

    it('should set theme to light', () => {
      localStorage.setItem('theme', 'dark');
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.currentTheme).toBe('light');
    });

    it('should not update if setting same theme', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      const initialTheme = result.current.currentTheme;

      act(() => {
        result.current.setTheme(initialTheme);
      });

      // Theme should remain the same
      expect(result.current.currentTheme).toBe(initialTheme);
    });

    it('should accept header source', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark', 'header');
      });

      expect(result.current.currentTheme).toBe('dark');
    });

    it('should accept settings source', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark', 'settings');
      });

      expect(result.current.currentTheme).toBe('dark');
    });
  });

  describe('localStorage Persistence', () => {
    it('should persist theme to localStorage on change', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(localStorage.getItem('theme')).toBe('dark');
      });
    });

    it('should persist toggle to localStorage', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(localStorage.getItem('theme')).toBe('dark');
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(localStorage.getItem('theme')).toBe('light');
      });
    });
  });

  describe('Document Class Management', () => {
    it('should add dark class to documentElement when dark theme', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should remove dark class from documentElement when light theme', async () => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should add theme-transition class during transition', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      // Transition class should be added immediately
      expect(document.documentElement.classList.contains('theme-transition')).toBe(true);
    });
  });

  describe('isChanging State', () => {
    it('should initially be false', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.isChanging).toBe(false);
    });
  });
});
