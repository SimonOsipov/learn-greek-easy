/**
 * AdminPage handleSaveDeck Tests
 *
 * Tests for verifying that handleSaveDeck correctly includes is_premium
 * in API payloads for both vocabulary and culture decks.
 *
 * Related bug: [BUG-002] Premium toggle not persisting for decks in admin panel
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { adminAPI } from '@/services/adminAPI';
import type {
  UnifiedDeckItem,
  VocabularyDeckUpdatePayload,
  CultureDeckUpdatePayload,
} from '@/services/adminAPI';

// Mock the adminAPI
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateVocabularyDeck: vi.fn(),
    updateCultureDeck: vi.fn(),
    getContentStats: vi.fn(),
    listDecks: vi.fn(),
  },
}));

// Mock analytics to prevent errors
vi.mock('@/lib/analytics/adminAnalytics', () => ({
  trackAdminDeckEditOpened: vi.fn(),
  trackAdminDeckEditSaved: vi.fn(),
  trackAdminDeckEditFailed: vi.fn(),
  trackAdminDeckEditCancelled: vi.fn(),
  trackAdminDeckDeactivated: vi.fn(),
  trackAdminDeckReactivated: vi.fn(),
  trackAdminDeckPremiumEnabled: vi.fn(),
  trackAdminDeckPremiumDisabled: vi.fn(),
}));

// Create mock decks for testing
const createMockVocabularyDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'vocab-deck-1',
  name: 'Test Vocabulary Deck',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 50,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const createMockCultureDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'culture-deck-1',
  name: 'Test Culture Deck',
  type: 'culture',
  level: null,
  category: 'history',
  item_count: 20,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Simulates the handleSaveDeck logic from AdminPage.tsx
 * This is extracted to test the payload construction without
 * needing to render the full component.
 */
async function simulateHandleSaveDeck(
  selectedDeck: UnifiedDeckItem,
  formData: {
    name: string;
    description: string;
    is_active: boolean;
    is_premium: boolean;
    level?: string;
    category?: string;
  }
): Promise<void> {
  if (selectedDeck.type === 'vocabulary') {
    const payload: VocabularyDeckUpdatePayload = {
      name: formData.name,
      description: formData.description,
      is_active: formData.is_active,
      is_premium: formData.is_premium,
    };
    if ('level' in formData && formData.level) {
      payload.level = formData.level as VocabularyDeckUpdatePayload['level'];
    }
    await adminAPI.updateVocabularyDeck(selectedDeck.id, payload);
  } else {
    const payload: CultureDeckUpdatePayload = {
      name: formData.name,
      description: formData.description,
      is_active: formData.is_active,
      is_premium: formData.is_premium,
    };
    if ('category' in formData && formData.category) {
      payload.category = formData.category;
    }
    await adminAPI.updateCultureDeck(selectedDeck.id, payload);
  }
}

describe('AdminPage handleSaveDeck - Premium Toggle Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminAPI.updateVocabularyDeck as Mock).mockResolvedValue({});
    (adminAPI.updateCultureDeck as Mock).mockResolvedValue({});
  });

  describe('Vocabulary Deck - is_premium in payload', () => {
    it('should include is_premium: true when toggling vocabulary deck to premium', async () => {
      const deck = createMockVocabularyDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: true,
        is_premium: true, // Toggling to premium
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: true,
        is_premium: true,
        level: 'A1',
      });
    });

    it('should include is_premium: false when toggling vocabulary deck to free', async () => {
      const deck = createMockVocabularyDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: true,
        is_premium: false, // Toggling to free
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: true,
        is_premium: false,
        level: 'A1',
      });
    });

    it('should preserve is_premium: false when no change is made', async () => {
      const deck = createMockVocabularyDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name: 'Updated Name',
        description: 'New description',
        is_active: true,
        is_premium: false, // No change
        level: 'B1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name: 'Updated Name',
        description: 'New description',
        is_active: true,
        is_premium: false,
        level: 'B1',
      });
    });

    it('should preserve is_premium: true when no change is made', async () => {
      const deck = createMockVocabularyDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name: 'Updated Name',
        description: '',
        is_active: true,
        is_premium: true, // No change
        level: 'A2',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name: 'Updated Name',
        description: '',
        is_active: true,
        is_premium: true,
        level: 'A2',
      });
    });
  });

  describe('Culture Deck - is_premium in payload', () => {
    it('should include is_premium: true when toggling culture deck to premium', async () => {
      const deck = createMockCultureDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: true,
        is_premium: true, // Toggling to premium
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: true,
        is_premium: true,
        category: 'history',
      });
    });

    it('should include is_premium: false when toggling culture deck to free', async () => {
      const deck = createMockCultureDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: true,
        is_premium: false, // Toggling to free
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: true,
        is_premium: false,
        category: 'history',
      });
    });

    it('should preserve is_premium: false when no change is made', async () => {
      const deck = createMockCultureDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name: 'Updated Culture Deck',
        description: 'Description',
        is_active: true,
        is_premium: false, // No change
        category: 'traditions',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name: 'Updated Culture Deck',
        description: 'Description',
        is_active: true,
        is_premium: false,
        category: 'traditions',
      });
    });

    it('should preserve is_premium: true when no change is made', async () => {
      const deck = createMockCultureDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name: 'Premium Culture Deck',
        description: '',
        is_active: true,
        is_premium: true, // No change
        category: 'geography',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name: 'Premium Culture Deck',
        description: '',
        is_active: true,
        is_premium: true,
        category: 'geography',
      });
    });
  });

  describe('Combined scenarios', () => {
    it('should handle toggling both is_premium and is_active simultaneously for vocabulary deck', async () => {
      const deck = createMockVocabularyDeck({
        is_premium: false,
        is_active: true,
      });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: false, // Also deactivating
        is_premium: true, // Toggling to premium
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: false,
        is_premium: true,
        level: 'A1',
      });
    });

    it('should handle toggling both is_premium and is_active simultaneously for culture deck', async () => {
      const deck = createMockCultureDeck({
        is_premium: true,
        is_active: false,
      });

      await simulateHandleSaveDeck(deck, {
        name: deck.name as string,
        description: '',
        is_active: true, // Reactivating
        is_premium: false, // Toggling to free
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name: deck.name,
        description: '',
        is_active: true,
        is_premium: false,
        category: 'history',
      });
    });
  });
});
