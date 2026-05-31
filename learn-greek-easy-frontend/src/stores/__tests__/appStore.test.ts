// src/stores/__tests__/appStore.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import { selectIsReady, useAppStore } from '@/stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with both flags false and isReady false', () => {
      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(false);
      expect(state.authInitialized).toBe(false);
      expect(state.isReady).toBe(false);
    });
  });

  describe('isReady two-flag ordering', () => {
    it('is NOT ready after only setReactHydrated', () => {
      useAppStore.getState().setReactHydrated();
      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(true);
      expect(state.authInitialized).toBe(false);
      expect(state.isReady).toBe(false);
    });

    it('is NOT ready after only setAuthInitialized', () => {
      useAppStore.getState().setAuthInitialized();
      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(false);
      expect(state.authInitialized).toBe(true);
      expect(state.isReady).toBe(false);
    });

    it('is ready when setReactHydrated fires first then setAuthInitialized', () => {
      useAppStore.getState().setReactHydrated();
      useAppStore.getState().setAuthInitialized();
      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(true);
      expect(state.authInitialized).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it('is ready when setAuthInitialized fires first then setReactHydrated', () => {
      useAppStore.getState().setAuthInitialized();
      useAppStore.getState().setReactHydrated();
      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(true);
      expect(state.authInitialized).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it('calling setReactHydrated twice does not accidentally flip isReady', () => {
      useAppStore.getState().setReactHydrated();
      useAppStore.getState().setReactHydrated();
      expect(useAppStore.getState().isReady).toBe(false);
    });

    it('calling setAuthInitialized twice does not accidentally flip isReady', () => {
      useAppStore.getState().setAuthInitialized();
      useAppStore.getState().setAuthInitialized();
      expect(useAppStore.getState().isReady).toBe(false);
    });
  });

  describe('reset', () => {
    it('restores all flags to false after both are set', () => {
      useAppStore.getState().setReactHydrated();
      useAppStore.getState().setAuthInitialized();
      expect(useAppStore.getState().isReady).toBe(true);

      useAppStore.getState().reset();

      const state = useAppStore.getState();
      expect(state.reactHydrated).toBe(false);
      expect(state.authInitialized).toBe(false);
      expect(state.isReady).toBe(false);
    });
  });

  describe('selectIsReady selector', () => {
    it('returns false from initial state', () => {
      expect(selectIsReady(useAppStore.getState())).toBe(false);
    });

    it('returns true once both flags are set', () => {
      useAppStore.getState().setReactHydrated();
      useAppStore.getState().setAuthInitialized();
      expect(selectIsReady(useAppStore.getState())).toBe(true);
    });
  });
});
