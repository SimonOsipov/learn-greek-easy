import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearActivePlayer, registerActivePlayer } from '../newsAudioCoordinator';

// The coordinator uses module-level state, so we need a way to reset it between tests.
// We do this by clearing with a known reference, then verifying clean state.

describe('newsAudioCoordinator', () => {
  // Reset coordinator state before each test by registering and clearing a dummy
  beforeEach(() => {
    const dummy = vi.fn();
    registerActivePlayer(dummy);
    clearActivePlayer(dummy);
  });

  describe('registerActivePlayer', () => {
    it('should call previous stop when registering a new player', () => {
      const stop1 = vi.fn();
      const stop2 = vi.fn();

      registerActivePlayer(stop1);
      registerActivePlayer(stop2);

      expect(stop1).toHaveBeenCalledTimes(1);
      expect(stop2).not.toHaveBeenCalled();
    });

    it('should NOT call its own stop function when re-registering same reference', () => {
      const stop = vi.fn();

      registerActivePlayer(stop);
      registerActivePlayer(stop);

      expect(stop).not.toHaveBeenCalled();
    });
  });

  describe('clearActivePlayer', () => {
    it('should clear when matching stop function is provided', () => {
      const stop1 = vi.fn();
      const stop2 = vi.fn();

      registerActivePlayer(stop1);
      clearActivePlayer(stop1);

      // After clearing, registering stop2 should NOT call stop1
      registerActivePlayer(stop2);
      expect(stop1).not.toHaveBeenCalled();
    });

    it('should NOT clear when non-matching stop function is provided', () => {
      const stop1 = vi.fn();
      const stop2 = vi.fn();
      const stop3 = vi.fn();

      registerActivePlayer(stop1);
      clearActivePlayer(stop2); // non-matching, should not clear

      // stop1 should still be active, so registering stop3 should call stop1
      registerActivePlayer(stop3);
      expect(stop1).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerActivePlayer after clearActivePlayer', () => {
    it('should work correctly with no stale state', () => {
      const stop1 = vi.fn();
      const stop2 = vi.fn();

      registerActivePlayer(stop1);
      clearActivePlayer(stop1);
      registerActivePlayer(stop2);

      // stop1 should not have been called (was cleared before stop2 registered)
      expect(stop1).not.toHaveBeenCalled();
      // stop2 is now active, should not have been called
      expect(stop2).not.toHaveBeenCalled();
    });
  });
});
