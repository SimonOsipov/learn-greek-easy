/**
 * adminChangelogStore Tests — CLTE-03 surface area only
 *
 * Tests for the drawer-state additions and pageSize bump introduced in CLTE-03:
 * - Initial defaults for all four drawer fields + pageSize
 * - openCompose() transition
 * - openEdit(id) transition
 * - closeDrawer() resets all four fields (from both compose and edit states)
 * - setLang() round trip
 * - setPanelMode() round trip
 * - reset() includes the new drawer fields back to defaults
 *
 * Existing actions (fetchList, createEntry, updateEntry, etc.) are NOT tested
 * here — out of scope.
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminChangelogStore } from '../adminChangelogStore';

// Mock the API module so the store can be imported without real network calls
vi.mock('@/services/changelogAPI', () => ({
  changelogAPI: {
    adminGetList: vi.fn(),
    adminGetById: vi.fn(),
    adminCreate: vi.fn(),
    adminUpdate: vi.fn(),
    adminDelete: vi.fn(),
  },
}));

describe('adminChangelogStore — drawer state + pageSize (CLTE-03)', () => {
  beforeEach(() => {
    // Reset drawer state between tests
    useAdminChangelogStore.setState({
      openEntryId: null,
      mode: null,
      lang: 'en',
      panelMode: 'form',
    });
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should have openEntryId as null', () => {
      const { openEntryId } = useAdminChangelogStore.getState();
      expect(openEntryId).toBeNull();
    });

    it('should have mode as null', () => {
      const { mode } = useAdminChangelogStore.getState();
      expect(mode).toBeNull();
    });

    it('should have lang defaulting to "en"', () => {
      const { lang } = useAdminChangelogStore.getState();
      expect(lang).toBe('en');
    });

    it('should have panelMode defaulting to "form"', () => {
      const { panelMode } = useAdminChangelogStore.getState();
      expect(panelMode).toBe('form');
    });

    it('should have pageSize defaulting to 100', () => {
      const { pageSize } = useAdminChangelogStore.getState();
      expect(pageSize).toBe(100);
    });
  });

  describe('openCompose()', () => {
    it('should set mode to "compose"', () => {
      act(() => {
        useAdminChangelogStore.getState().openCompose();
      });

      expect(useAdminChangelogStore.getState().mode).toBe('compose');
    });

    it('should set openEntryId to null', () => {
      useAdminChangelogStore.setState({ openEntryId: 'some-id' });

      act(() => {
        useAdminChangelogStore.getState().openCompose();
      });

      expect(useAdminChangelogStore.getState().openEntryId).toBeNull();
    });

    it('should set lang to "en"', () => {
      useAdminChangelogStore.setState({ lang: 'ru' });

      act(() => {
        useAdminChangelogStore.getState().openCompose();
      });

      expect(useAdminChangelogStore.getState().lang).toBe('en');
    });

    it('should set panelMode to "form"', () => {
      useAdminChangelogStore.setState({ panelMode: 'json' });

      act(() => {
        useAdminChangelogStore.getState().openCompose();
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('form');
    });

    it('should set all four fields together', () => {
      useAdminChangelogStore.setState({
        openEntryId: 'existing-id',
        mode: 'edit',
        lang: 'ru',
        panelMode: 'json',
      });

      act(() => {
        useAdminChangelogStore.getState().openCompose();
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBe('compose');
      expect(state.openEntryId).toBeNull();
      expect(state.lang).toBe('en');
      expect(state.panelMode).toBe('form');
    });
  });

  describe('openEdit(id)', () => {
    it('should set mode to "edit"', () => {
      act(() => {
        useAdminChangelogStore.getState().openEdit('entry-123');
      });

      expect(useAdminChangelogStore.getState().mode).toBe('edit');
    });

    it('should set openEntryId to the given id', () => {
      act(() => {
        useAdminChangelogStore.getState().openEdit('entry-456');
      });

      expect(useAdminChangelogStore.getState().openEntryId).toBe('entry-456');
    });

    it('should set lang to "en"', () => {
      useAdminChangelogStore.setState({ lang: 'ru' });

      act(() => {
        useAdminChangelogStore.getState().openEdit('entry-789');
      });

      expect(useAdminChangelogStore.getState().lang).toBe('en');
    });

    it('should set panelMode to "form"', () => {
      useAdminChangelogStore.setState({ panelMode: 'json' });

      act(() => {
        useAdminChangelogStore.getState().openEdit('entry-789');
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('form');
    });

    it('should set all four fields together', () => {
      act(() => {
        useAdminChangelogStore.getState().openEdit('entry-abc');
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBe('edit');
      expect(state.openEntryId).toBe('entry-abc');
      expect(state.lang).toBe('en');
      expect(state.panelMode).toBe('form');
    });
  });

  describe('closeDrawer()', () => {
    it('should reset mode to null', () => {
      useAdminChangelogStore.setState({ mode: 'compose', openEntryId: null });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      expect(useAdminChangelogStore.getState().mode).toBeNull();
    });

    it('should reset openEntryId to null', () => {
      useAdminChangelogStore.setState({ mode: 'edit', openEntryId: 'entry-123' });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      expect(useAdminChangelogStore.getState().openEntryId).toBeNull();
    });

    it('should reset lang to "en"', () => {
      useAdminChangelogStore.setState({ mode: 'edit', lang: 'ru' });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      expect(useAdminChangelogStore.getState().lang).toBe('en');
    });

    it('should reset panelMode to "form"', () => {
      useAdminChangelogStore.setState({ mode: 'edit', panelMode: 'json' });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('form');
    });

    it('should reset all four fields from compose state', () => {
      useAdminChangelogStore.setState({
        mode: 'compose',
        openEntryId: null,
        lang: 'ru',
        panelMode: 'json',
      });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBeNull();
      expect(state.openEntryId).toBeNull();
      expect(state.lang).toBe('en');
      expect(state.panelMode).toBe('form');
    });

    it('should reset all four fields from edit state', () => {
      useAdminChangelogStore.setState({
        mode: 'edit',
        openEntryId: 'entry-xyz',
        lang: 'ru',
        panelMode: 'json',
      });

      act(() => {
        useAdminChangelogStore.getState().closeDrawer();
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBeNull();
      expect(state.openEntryId).toBeNull();
      expect(state.lang).toBe('en');
      expect(state.panelMode).toBe('form');
    });
  });

  describe('setLang()', () => {
    it('should set lang to "ru"', () => {
      act(() => {
        useAdminChangelogStore.getState().setLang('ru');
      });

      expect(useAdminChangelogStore.getState().lang).toBe('ru');
    });

    it('should round-trip: "en" → "ru" → "en"', () => {
      act(() => {
        useAdminChangelogStore.getState().setLang('ru');
      });

      expect(useAdminChangelogStore.getState().lang).toBe('ru');

      act(() => {
        useAdminChangelogStore.getState().setLang('en');
      });

      expect(useAdminChangelogStore.getState().lang).toBe('en');
    });

    it('should not affect other drawer fields', () => {
      useAdminChangelogStore.setState({ mode: 'edit', openEntryId: 'entry-1', panelMode: 'json' });

      act(() => {
        useAdminChangelogStore.getState().setLang('ru');
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBe('edit');
      expect(state.openEntryId).toBe('entry-1');
      expect(state.panelMode).toBe('json');
    });
  });

  describe('setPanelMode()', () => {
    it('should set panelMode to "json"', () => {
      act(() => {
        useAdminChangelogStore.getState().setPanelMode('json');
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('json');
    });

    it('should round-trip: "form" → "json" → "form"', () => {
      act(() => {
        useAdminChangelogStore.getState().setPanelMode('json');
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('json');

      act(() => {
        useAdminChangelogStore.getState().setPanelMode('form');
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('form');
    });

    it('should not affect other drawer fields', () => {
      useAdminChangelogStore.setState({ mode: 'compose', openEntryId: null, lang: 'ru' });

      act(() => {
        useAdminChangelogStore.getState().setPanelMode('json');
      });

      const state = useAdminChangelogStore.getState();
      expect(state.mode).toBe('compose');
      expect(state.openEntryId).toBeNull();
      expect(state.lang).toBe('ru');
    });
  });

  describe('reset()', () => {
    it('should reset openEntryId to null', () => {
      useAdminChangelogStore.setState({ openEntryId: 'entry-123' });

      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      expect(useAdminChangelogStore.getState().openEntryId).toBeNull();
    });

    it('should reset mode to null', () => {
      useAdminChangelogStore.setState({ mode: 'edit' });

      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      expect(useAdminChangelogStore.getState().mode).toBeNull();
    });

    it('should reset lang to "en"', () => {
      useAdminChangelogStore.setState({ lang: 'ru' });

      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      expect(useAdminChangelogStore.getState().lang).toBe('en');
    });

    it('should reset panelMode to "form"', () => {
      useAdminChangelogStore.setState({ panelMode: 'json' });

      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      expect(useAdminChangelogStore.getState().panelMode).toBe('form');
    });

    it('should reset all four drawer fields together', () => {
      useAdminChangelogStore.setState({
        openEntryId: 'entry-xyz',
        mode: 'edit',
        lang: 'ru',
        panelMode: 'json',
      });

      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      const state = useAdminChangelogStore.getState();
      expect(state.openEntryId).toBeNull();
      expect(state.mode).toBeNull();
      expect(state.lang).toBe('en');
      expect(state.panelMode).toBe('form');
    });

    it('should preserve pageSize at 100 after reset', () => {
      act(() => {
        useAdminChangelogStore.getState().reset();
      });

      expect(useAdminChangelogStore.getState().pageSize).toBe(100);
    });
  });
});
