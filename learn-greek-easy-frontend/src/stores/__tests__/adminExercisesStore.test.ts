/**
 * adminExercisesStore tests — EXR-09a / EXR-19a / EXR-19c / EXR-19e
 *
 * Covers:
 * - resetFilters restores all defaults
 * - each filter setter resets page to 1
 * - setQ resets page to 1
 * - setQ debounces qDebounced by 300ms
 * - setQ then resetFilters clears pending debounce
 * - hydrateFromURL parses valid params
 * - hydrateFromURL falls back on invalid params
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminExercisesStore } from '../adminExercisesStore';

// Isolate state between tests
beforeEach(() => {
  useAdminExercisesStore.getState().resetFilters();
  useAdminExercisesStore.getState().closeDrawer();
});

describe('adminExercisesStore — resetFilters', () => {
  it('restores all defaults including q and qDebounced', () => {
    const store = useAdminExercisesStore.getState();
    store.setSource('dialog');
    store.setType('fill_gaps');
    store.setLevel('A2');
    store.setStatus('approved');
    store.setPage(5);
    store.setQ('abc');

    store.resetFilters();

    const state = useAdminExercisesStore.getState();
    expect(state.source).toBe('all');
    expect(state.type).toBe('all');
    expect(state.level).toBe('all');
    expect(state.status).toBe('all');
    expect(state.q).toBe('');
    expect(state.qDebounced).toBe('');
    expect(state.page).toBe(1);
  });
});

describe('adminExercisesStore — filter setters reset page to 1', () => {
  it('setSource resets page', () => {
    useAdminExercisesStore.getState().setPage(5);
    useAdminExercisesStore.getState().setSource('dialog');
    expect(useAdminExercisesStore.getState().page).toBe(1);
  });

  it('setType resets page', () => {
    useAdminExercisesStore.getState().setPage(5);
    useAdminExercisesStore.getState().setType('fill_gaps');
    expect(useAdminExercisesStore.getState().page).toBe(1);
  });

  it('setLevel resets page', () => {
    useAdminExercisesStore.getState().setPage(5);
    useAdminExercisesStore.getState().setLevel('B1');
    expect(useAdminExercisesStore.getState().page).toBe(1);
  });

  it('setStatus resets page', () => {
    useAdminExercisesStore.getState().setPage(5);
    useAdminExercisesStore.getState().setStatus('approved');
    expect(useAdminExercisesStore.getState().page).toBe(1);
  });

  it('setQ resets page to 1', () => {
    useAdminExercisesStore.getState().setPage(5);
    useAdminExercisesStore.getState().setQ('foo');
    expect(useAdminExercisesStore.getState().page).toBe(1);
  });
});

describe('adminExercisesStore — setQ debounce', () => {
  it('updates q immediately but defers qDebounced by 300ms', () => {
    vi.useFakeTimers();
    try {
      useAdminExercisesStore.getState().setQ('foo');

      // q is immediate
      expect(useAdminExercisesStore.getState().q).toBe('foo');
      // qDebounced is still empty before the timer fires
      expect(useAdminExercisesStore.getState().qDebounced).toBe('');

      vi.advanceTimersByTime(300);

      // Now qDebounced should have updated
      expect(useAdminExercisesStore.getState().qDebounced).toBe('foo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resetFilters clears pending debounce so qDebounced stays empty', () => {
    vi.useFakeTimers();
    try {
      useAdminExercisesStore.getState().setQ('foo');
      // Reset before timer fires
      useAdminExercisesStore.getState().resetFilters();

      vi.advanceTimersByTime(300);

      // Timer was cancelled — qDebounced must remain empty
      expect(useAdminExercisesStore.getState().qDebounced).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('adminExercisesStore — drawer actions (EXR2-24-05)', () => {
  it('openCompose sets mode to "compose" and clears openEntryId', () => {
    useAdminExercisesStore.getState().openCompose();
    const state = useAdminExercisesStore.getState();
    expect(state.mode).toBe('compose');
    expect(state.openEntryId).toBeNull();
  });

  it('openEdit sets mode to "edit" and stores the id', () => {
    useAdminExercisesStore.getState().openEdit('abc');
    const state = useAdminExercisesStore.getState();
    expect(state.mode).toBe('edit');
    expect(state.openEntryId).toBe('abc');
  });

  it('closeDrawer resets mode and openEntryId to null', () => {
    useAdminExercisesStore.getState().openCompose();
    useAdminExercisesStore.getState().closeDrawer();
    const state = useAdminExercisesStore.getState();
    expect(state.mode).toBeNull();
    expect(state.openEntryId).toBeNull();
  });
});

describe('adminExercisesStore — setModality (EXR2-24-08)', () => {
  it('setModality updates modality and resets page to 1', () => {
    useAdminExercisesStore.getState().setPage(3);
    useAdminExercisesStore.getState().setModality('reading');
    const state = useAdminExercisesStore.getState();
    expect(state.modality).toBe('reading');
    expect(state.page).toBe(1);
  });

  it('setModality back to listening updates state', () => {
    useAdminExercisesStore.getState().setModality('reading');
    useAdminExercisesStore.getState().setModality('listening');
    expect(useAdminExercisesStore.getState().modality).toBe('listening');
  });
});

describe('adminExercisesStore — hydrateFromURL', () => {
  it('parses valid params into store state', () => {
    const params = new URLSearchParams({
      source: 'dialog',
      type: 'fill_gaps',
      level: 'B1',
      status: 'approved',
      q: 'hello',
      page: '3',
    });

    useAdminExercisesStore.getState().hydrateFromURL(params);

    const state = useAdminExercisesStore.getState();
    expect(state.source).toBe('dialog');
    expect(state.type).toBe('fill_gaps');
    expect(state.level).toBe('B1');
    expect(state.status).toBe('approved');
    expect(state.q).toBe('hello');
    expect(state.qDebounced).toBe('hello');
    expect(state.page).toBe(3);
  });

  it('falls back to "all" for invalid source/type/level/status', () => {
    const params = new URLSearchParams({
      source: 'invalid',
      type: 'invalid',
      level: 'invalid',
      status: 'invalid',
    });

    useAdminExercisesStore.getState().hydrateFromURL(params);

    const state = useAdminExercisesStore.getState();
    expect(state.source).toBe('all');
    expect(state.type).toBe('all');
    expect(state.level).toBe('all');
    expect(state.status).toBe('all');
  });

  it('reads modality=reading from URL params', () => {
    const params = new URLSearchParams({ modality: 'reading' });
    useAdminExercisesStore.getState().hydrateFromURL(params);
    expect(useAdminExercisesStore.getState().modality).toBe('reading');
  });

  it('falls back to "listening" when modality param is missing', () => {
    const params = new URLSearchParams({});
    useAdminExercisesStore.getState().hydrateFromURL(params);
    expect(useAdminExercisesStore.getState().modality).toBe('listening');
  });

  it('falls back to "listening" when modality param is invalid', () => {
    const params = new URLSearchParams({ modality: 'invalid' });
    useAdminExercisesStore.getState().hydrateFromURL(params);
    expect(useAdminExercisesStore.getState().modality).toBe('listening');
  });

  it('does NOT touch drawer state (mode / openEntryId remain null after hydration)', () => {
    // Pre-condition: drawer is closed (ensured by beforeEach)
    const params = new URLSearchParams({ source: 'dialog', q: 'test' });
    useAdminExercisesStore.getState().hydrateFromURL(params);

    const state = useAdminExercisesStore.getState();
    expect(state.mode).toBeNull();
    expect(state.openEntryId).toBeNull();
  });
});
