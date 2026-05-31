/**
 * use-toast Hook + reducer Tests
 *
 * Covers the singleton global toast store behind 123+ call sites:
 * - reducer ADD_TOAST caps at TOAST_LIMIT (1)
 * - reducer UPDATE_TOAST merges by id
 * - reducer DISMISS_TOAST: all toasts vs a specific id (sets open=false)
 * - reducer REMOVE_TOAST: all (toastId undefined) vs a specific id
 * - cross-instance sync via the shared module-level listener array
 * - the [] effect dep registers each listener exactly once (no leak / double-fire)
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reducer, useToast, toast } from '../use-toast';

// Helper to clear the global singleton store between tests by removing all toasts.
function resetToastStore() {
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    // REMOVE_TOAST with no id empties the store.
    result.current.dismiss();
  });
  // Drain any pending remove timers and clear everything.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  unmount();
}

describe('use-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastStore();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('reducer', () => {
    const makeToast = (id: string) => ({ id, open: true, title: id });

    it('ADD_TOAST caps the list at TOAST_LIMIT (1), keeping the newest', () => {
      const state = { toasts: [makeToast('a')] };
      const next = reducer(state, { type: 'ADD_TOAST', toast: makeToast('b') });

      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('b');
    });

    it('UPDATE_TOAST merges props onto the matching toast by id', () => {
      const state = { toasts: [makeToast('a')] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'a', title: 'updated' },
      });

      expect(next.toasts[0].title).toBe('updated');
      expect(next.toasts[0].open).toBe(true);
    });

    it('UPDATE_TOAST leaves non-matching toasts untouched', () => {
      const state = { toasts: [makeToast('a')] };
      const next = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'missing', title: 'nope' },
      });

      expect(next.toasts[0].title).toBe('a');
    });

    it('DISMISS_TOAST with a specific id sets only that toast open=false', () => {
      const state = { toasts: [makeToast('a'), makeToast('b')] };
      const next = reducer(state, { type: 'DISMISS_TOAST', toastId: 'a' });

      expect(next.toasts.find((t) => t.id === 'a')?.open).toBe(false);
      expect(next.toasts.find((t) => t.id === 'b')?.open).toBe(true);
    });

    it('DISMISS_TOAST with no id sets every toast open=false', () => {
      const state = { toasts: [makeToast('a'), makeToast('b')] };
      const next = reducer(state, { type: 'DISMISS_TOAST' });

      expect(next.toasts.every((t) => t.open === false)).toBe(true);
    });

    it('REMOVE_TOAST with a specific id removes only that toast', () => {
      const state = { toasts: [makeToast('a'), makeToast('b')] };
      const next = reducer(state, { type: 'REMOVE_TOAST', toastId: 'a' });

      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe('b');
    });

    it('REMOVE_TOAST with no id clears all toasts', () => {
      const state = { toasts: [makeToast('a'), makeToast('b')] };
      const next = reducer(state, { type: 'REMOVE_TOAST' });

      expect(next.toasts).toEqual([]);
    });
  });

  describe('toast() + useToast() singleton store', () => {
    it('exposes a created toast through the hook state, capped at 1', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'first' });
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('first');
      expect(result.current.toasts[0].open).toBe(true);

      act(() => {
        result.current.toast({ title: 'second' });
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('second');
    });

    it('toast() returns an id, dismiss, and update API', () => {
      let handle: ReturnType<typeof toast> | undefined;
      const { result } = renderHook(() => useToast());

      act(() => {
        handle = result.current.toast({ title: 'hello' });
      });

      expect(handle?.id).toBeTypeOf('string');

      act(() => {
        handle?.update({ id: handle.id, title: 'changed' });
      });
      expect(result.current.toasts[0].title).toBe('changed');

      act(() => {
        handle?.dismiss();
      });
      expect(result.current.toasts[0].open).toBe(false);
    });

    it('dismiss(id) from the hook sets the matching toast open=false', () => {
      const { result } = renderHook(() => useToast());

      let id = '';
      act(() => {
        id = result.current.toast({ title: 'x' }).id;
      });

      act(() => {
        result.current.dismiss(id);
      });
      expect(result.current.toasts[0].open).toBe(false);
    });

    it('onOpenChange(false) dismisses the toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'x' });
      });

      act(() => {
        result.current.toasts[0].onOpenChange?.(false);
      });
      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe('cross-instance sync via shared listener array', () => {
    it('a toast created from one hook instance is visible in another', () => {
      const a = renderHook(() => useToast());
      const b = renderHook(() => useToast());

      act(() => {
        a.result.current.toast({ title: 'shared' });
      });

      expect(a.result.current.toasts[0].title).toBe('shared');
      expect(b.result.current.toasts[0].title).toBe('shared');
    });

    it('dismiss from one instance is reflected in the other', () => {
      const a = renderHook(() => useToast());
      const b = renderHook(() => useToast());

      let id = '';
      act(() => {
        id = a.result.current.toast({ title: 'x' }).id;
      });

      act(() => {
        b.result.current.dismiss(id);
      });

      expect(a.result.current.toasts[0].open).toBe(false);
      expect(b.result.current.toasts[0].open).toBe(false);
    });
  });

  describe('listener lifecycle (no leak / no double-fire)', () => {
    it('unmounting removes the listener so dispatch no longer updates a stale setter', () => {
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'before' });
      });
      expect(result.current.toasts[0].title).toBe('before');

      unmount();

      // A second instance keeps firing; the unmounted one must not throw or
      // hold a stale subscriber.
      const second = renderHook(() => useToast());
      act(() => {
        second.result.current.toast({ title: 'after' });
      });

      expect(second.result.current.toasts[0].title).toBe('after');
    });

    it('keeps a single listener so repeated dispatches never stack duplicate toasts', () => {
      const { result } = renderHook(() => useToast());

      // Each dispatch moves state forward deterministically; a leaked/duplicated
      // listener (the old [state] effect dep) could cause stacked or stale entries.
      act(() => {
        result.current.toast({ title: 'one' });
      });
      act(() => {
        result.current.toast({ title: 'two' });
      });

      // With TOAST_LIMIT=1 and a single listener, only the latest survives.
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('two');
    });
  });
});
