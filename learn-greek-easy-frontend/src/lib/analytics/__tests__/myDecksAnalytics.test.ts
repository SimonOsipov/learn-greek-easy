/**
 * My Decks Analytics Unit Tests
 *
 * Tests all tracking functions in myDecksAnalytics.ts
 * Verifies PostHog integration and graceful handling when PostHog is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import posthog from 'posthog-js';

import {
  trackMyDecksPageViewed,
  trackMyDecksCreateDeckClicked,
  trackMyDecksCreateCardClicked,
  trackMyDecksEditDeckClicked,
  trackMyDecksDeleteDeckClicked,
  trackMyDecksDeckDeleted,
  trackMyDecksAccessDenied,
  trackUserDeckCreateStarted,
  trackUserDeckCreateCompleted,
  trackUserDeckCreateCancelled,
  trackUserDeckEditStarted,
  trackUserDeckEditCompleted,
  trackUserDeckEditCancelled,
  trackUserDeckDeleteStarted,
  trackUserDeckDeleteCancelled,
} from '../myDecksAnalytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe('myDecksAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Page & Button Events
  // ==========================================================================

  describe('trackMyDecksPageViewed', () => {
    it('should call posthog.capture with correct event name and properties', () => {
      trackMyDecksPageViewed({
        user_deck_count: 5,
        has_decks: true,
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_page_viewed', {
        user_deck_count: 5,
        has_decks: true,
      });
    });

    it('should track when user has no decks', () => {
      trackMyDecksPageViewed({
        user_deck_count: 0,
        has_decks: false,
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_page_viewed', {
        user_deck_count: 0,
        has_decks: false,
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksPageViewed({ user_deck_count: 3, has_decks: true });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksCreateDeckClicked', () => {
    it('should call posthog.capture with enabled button state', () => {
      trackMyDecksCreateDeckClicked({ button_state: 'enabled' });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_create_deck_clicked', {
        button_state: 'enabled',
      });
    });

    it('should call posthog.capture with disabled button state', () => {
      trackMyDecksCreateDeckClicked({ button_state: 'disabled' });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_create_deck_clicked', {
        button_state: 'disabled',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksCreateDeckClicked({ button_state: 'enabled' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksCreateCardClicked', () => {
    it('should call posthog.capture with disabled button state', () => {
      trackMyDecksCreateCardClicked({ button_state: 'disabled' });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_create_card_clicked', {
        button_state: 'disabled',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksCreateCardClicked({ button_state: 'disabled' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksEditDeckClicked', () => {
    it('should call posthog.capture with deck details', () => {
      trackMyDecksEditDeckClicked({
        deck_id: 'deck-123',
        deck_name: 'My Custom Deck',
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_edit_deck_clicked', {
        deck_id: 'deck-123',
        deck_name: 'My Custom Deck',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksEditDeckClicked({ deck_id: 'deck-123', deck_name: 'Test' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksDeleteDeckClicked', () => {
    it('should call posthog.capture with deck details', () => {
      trackMyDecksDeleteDeckClicked({
        deck_id: 'deck-456',
        deck_name: 'Deck to Delete',
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_delete_deck_clicked', {
        deck_id: 'deck-456',
        deck_name: 'Deck to Delete',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksDeleteDeckClicked({ deck_id: 'deck-456', deck_name: 'Test' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksDeckDeleted', () => {
    it('should call posthog.capture when deck is successfully deleted', () => {
      trackMyDecksDeckDeleted({
        deck_id: 'deck-789',
        deck_name: 'Deleted Deck',
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_deck_deleted', {
        deck_id: 'deck-789',
        deck_name: 'Deleted Deck',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksDeckDeleted({ deck_id: 'deck-789', deck_name: 'Test' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackMyDecksAccessDenied', () => {
    it('should call posthog.capture with access denied details', () => {
      trackMyDecksAccessDenied({
        attempted_deck_id: 'deck-not-owned',
        redirect_destination: '/my-decks',
      });

      expect(posthog.capture).toHaveBeenCalledWith('my_decks_access_denied', {
        attempted_deck_id: 'deck-not-owned',
        redirect_destination: '/my-decks',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackMyDecksAccessDenied({
          attempted_deck_id: 'deck-123',
          redirect_destination: '/my-decks',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Create Modal Lifecycle Events
  // ==========================================================================

  describe('trackUserDeckCreateStarted', () => {
    it('should call posthog.capture with my_decks_button source', () => {
      trackUserDeckCreateStarted({ source: 'my_decks_button' });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_started', {
        source: 'my_decks_button',
      });
    });

    it('should call posthog.capture with empty_state_cta source', () => {
      trackUserDeckCreateStarted({ source: 'empty_state_cta' });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_started', {
        source: 'empty_state_cta',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckCreateStarted({ source: 'my_decks_button' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackUserDeckCreateCompleted', () => {
    it('should call posthog.capture with all deck creation details', () => {
      trackUserDeckCreateCompleted({
        deck_id: 'new-deck-123',
        deck_name: 'My New Deck',
        level: 'A1',
        has_description: true,
        source: 'my_decks_button',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_completed', {
        deck_id: 'new-deck-123',
        deck_name: 'My New Deck',
        level: 'A1',
        has_description: true,
        source: 'my_decks_button',
      });
    });

    it('should track deck creation without description', () => {
      trackUserDeckCreateCompleted({
        deck_id: 'deck-456',
        deck_name: 'Basic Deck',
        level: 'B1',
        has_description: false,
        source: 'empty_state_cta',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_completed', {
        deck_id: 'deck-456',
        deck_name: 'Basic Deck',
        level: 'B1',
        has_description: false,
        source: 'empty_state_cta',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckCreateCompleted({
          deck_id: 'deck-123',
          deck_name: 'Test',
          level: 'A1',
          has_description: false,
          source: 'my_decks_button',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackUserDeckCreateCancelled', () => {
    it('should call posthog.capture with my_decks_button source', () => {
      trackUserDeckCreateCancelled({ source: 'my_decks_button' });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_cancelled', {
        source: 'my_decks_button',
      });
    });

    it('should call posthog.capture with empty_state_cta source', () => {
      trackUserDeckCreateCancelled({ source: 'empty_state_cta' });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_create_cancelled', {
        source: 'empty_state_cta',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckCreateCancelled({ source: 'my_decks_button' });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Edit Modal Lifecycle Events
  // ==========================================================================

  describe('trackUserDeckEditStarted', () => {
    it('should call posthog.capture with grid_card source', () => {
      trackUserDeckEditStarted({
        deck_id: 'deck-to-edit',
        deck_name: 'Edit Me',
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_started', {
        deck_id: 'deck-to-edit',
        deck_name: 'Edit Me',
        source: 'grid_card',
      });
    });

    it('should call posthog.capture with detail_page source', () => {
      trackUserDeckEditStarted({
        deck_id: 'deck-123',
        deck_name: 'From Detail Page',
        source: 'detail_page',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_started', {
        deck_id: 'deck-123',
        deck_name: 'From Detail Page',
        source: 'detail_page',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckEditStarted({
          deck_id: 'deck-123',
          deck_name: 'Test',
          source: 'grid_card',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackUserDeckEditCompleted', () => {
    it('should call posthog.capture with fields changed', () => {
      trackUserDeckEditCompleted({
        deck_id: 'deck-edited',
        deck_name: 'Updated Name',
        fields_changed: ['name', 'description'],
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_completed', {
        deck_id: 'deck-edited',
        deck_name: 'Updated Name',
        fields_changed: ['name', 'description'],
        source: 'grid_card',
      });
    });

    it('should track when only level is changed', () => {
      trackUserDeckEditCompleted({
        deck_id: 'deck-789',
        deck_name: 'Same Name',
        fields_changed: ['level'],
        source: 'detail_page',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_completed', {
        deck_id: 'deck-789',
        deck_name: 'Same Name',
        fields_changed: ['level'],
        source: 'detail_page',
      });
    });

    it('should track when no fields changed (empty array)', () => {
      trackUserDeckEditCompleted({
        deck_id: 'deck-000',
        deck_name: 'No Changes',
        fields_changed: [],
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_completed', {
        deck_id: 'deck-000',
        deck_name: 'No Changes',
        fields_changed: [],
        source: 'grid_card',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckEditCompleted({
          deck_id: 'deck-123',
          deck_name: 'Test',
          fields_changed: ['name'],
          source: 'grid_card',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackUserDeckEditCancelled', () => {
    it('should call posthog.capture with grid_card source', () => {
      trackUserDeckEditCancelled({
        deck_id: 'deck-cancelled',
        deck_name: 'Cancelled Edit',
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_cancelled', {
        deck_id: 'deck-cancelled',
        deck_name: 'Cancelled Edit',
        source: 'grid_card',
      });
    });

    it('should call posthog.capture with detail_page source', () => {
      trackUserDeckEditCancelled({
        deck_id: 'deck-abc',
        deck_name: 'Detail Cancel',
        source: 'detail_page',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_edit_cancelled', {
        deck_id: 'deck-abc',
        deck_name: 'Detail Cancel',
        source: 'detail_page',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckEditCancelled({
          deck_id: 'deck-123',
          deck_name: 'Test',
          source: 'grid_card',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // Delete Modal Lifecycle Events
  // ==========================================================================

  describe('trackUserDeckDeleteStarted', () => {
    it('should call posthog.capture with grid_card source', () => {
      trackUserDeckDeleteStarted({
        deck_id: 'deck-to-delete',
        deck_name: 'Delete Me',
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_delete_started', {
        deck_id: 'deck-to-delete',
        deck_name: 'Delete Me',
        source: 'grid_card',
      });
    });

    it('should call posthog.capture with detail_page source', () => {
      trackUserDeckDeleteStarted({
        deck_id: 'deck-xyz',
        deck_name: 'Delete from Detail',
        source: 'detail_page',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_delete_started', {
        deck_id: 'deck-xyz',
        deck_name: 'Delete from Detail',
        source: 'detail_page',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckDeleteStarted({
          deck_id: 'deck-123',
          deck_name: 'Test',
          source: 'grid_card',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  describe('trackUserDeckDeleteCancelled', () => {
    it('should call posthog.capture with grid_card source', () => {
      trackUserDeckDeleteCancelled({
        deck_id: 'deck-not-deleted',
        deck_name: 'Saved Deck',
        source: 'grid_card',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_delete_cancelled', {
        deck_id: 'deck-not-deleted',
        deck_name: 'Saved Deck',
        source: 'grid_card',
      });
    });

    it('should call posthog.capture with detail_page source', () => {
      trackUserDeckDeleteCancelled({
        deck_id: 'deck-456',
        deck_name: 'Keep This',
        source: 'detail_page',
      });

      expect(posthog.capture).toHaveBeenCalledWith('user_deck_delete_cancelled', {
        deck_id: 'deck-456',
        deck_name: 'Keep This',
        source: 'detail_page',
      });
    });

    it('should not throw if posthog.capture is undefined', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = undefined;

      expect(() => {
        trackUserDeckDeleteCancelled({
          deck_id: 'deck-123',
          deck_name: 'Test',
          source: 'grid_card',
        });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });

  // ==========================================================================
  // PostHog Null Safety Tests
  // ==========================================================================

  describe('PostHog null safety', () => {
    it('should handle posthog.capture being a non-function value', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = 'not a function';

      expect(() => {
        trackMyDecksPageViewed({ user_deck_count: 1, has_decks: true });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });

    it('should handle posthog.capture being null', () => {
      const originalCapture = posthog.capture;
      (posthog as Record<string, unknown>).capture = null;

      expect(() => {
        trackMyDecksPageViewed({ user_deck_count: 1, has_decks: true });
      }).not.toThrow();

      (posthog as Record<string, unknown>).capture = originalCapture;
    });
  });
});
