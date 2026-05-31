/**
 * useAdminTabNav Hook Tests
 *
 * Covers:
 * - ?tab= derivation: valid tab, fallback to 'dashboard', unknown/missing/null
 * - openIn no-merge footgun: openIn with extra params does NOT preserve
 *   pre-existing search params (full-replace semantics documented in JSDoc)
 */

import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminTabNav } from '@/hooks/useAdminTabNav';

// ---------------------------------------------------------------------------
// Wrapper factories
// ---------------------------------------------------------------------------

function makeWrapper(initialEntry = '/admin') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [initialEntry] }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAdminTabNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activeTab derivation from ?tab=', () => {
    it('defaults to "dashboard" when no ?tab= param is present', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin'),
      });

      expect(result.current.activeTab).toBe('dashboard');
    });

    it('returns the valid tab when ?tab= is a known AdminTabType', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab=inbox'),
      });

      expect(result.current.activeTab).toBe('inbox');
    });

    it('returns "decks" for ?tab=decks', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab=decks'),
      });

      expect(result.current.activeTab).toBe('decks');
    });

    it('falls back to "dashboard" when ?tab= is an unknown value', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab=nonexistent'),
      });

      expect(result.current.activeTab).toBe('dashboard');
    });

    it('falls back to "dashboard" when ?tab= is an empty string', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab='),
      });

      expect(result.current.activeTab).toBe('dashboard');
    });

    it('returns the raw URLSearchParams object', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab=news&foo=bar'),
      });

      expect(result.current.searchParams.get('tab')).toBe('news');
      expect(result.current.searchParams.get('foo')).toBe('bar');
    });
  });

  describe('openIn — full-replace semantics (no-merge footgun)', () => {
    it('navigates to the specified tab', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin'),
      });

      act(() => {
        result.current.openIn('errors');
      });

      expect(result.current.activeTab).toBe('errors');
    });

    it('passes extra params into the URL', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin'),
      });

      act(() => {
        result.current.openIn('decks', { filter: 'published' });
      });

      expect(result.current.activeTab).toBe('decks');
      expect(result.current.searchParams.get('filter')).toBe('published');
    });

    it('does NOT preserve pre-existing params (full-replace, not merge)', () => {
      // Start with ?tab=inbox&preserve=me
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin?tab=inbox&preserve=me'),
      });

      // Confirm initial state
      expect(result.current.searchParams.get('preserve')).toBe('me');

      // openIn replaces the whole search string
      act(() => {
        result.current.openIn('decks');
      });

      // 'preserve' should be gone — this is the documented footgun
      expect(result.current.searchParams.get('preserve')).toBeNull();
      expect(result.current.activeTab).toBe('decks');
    });

    it('extra params from previous openIn call are also wiped on next call', () => {
      const { result } = renderHook(() => useAdminTabNav(), {
        wrapper: makeWrapper('/admin'),
      });

      act(() => {
        result.current.openIn('feedback', { page: '2' });
      });

      expect(result.current.searchParams.get('page')).toBe('2');

      act(() => {
        result.current.openIn('inbox');
      });

      // page param must be gone — no merging
      expect(result.current.searchParams.get('page')).toBeNull();
      expect(result.current.activeTab).toBe('inbox');
    });
  });
});
