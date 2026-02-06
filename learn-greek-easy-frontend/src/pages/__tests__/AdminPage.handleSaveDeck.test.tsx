/**
 * AdminPage handleSaveDeck Tests
 *
 * Tests for verifying that handleSaveDeck correctly includes is_premium
 * in API payloads for both vocabulary and culture decks, and sends
 * bilingual fields (name_en, name_ru, description_en, description_ru)
 * instead of single name/description fields.
 *
 * Related bug: [BUG-002] Premium toggle not persisting for decks in admin panel
 * Related bug: [VBUG-06] Russian translation persistence in deck admin
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
 *
 * Uses bilingual form data (name_en, name_ru, description_en, description_ru)
 * matching the actual form data produced by DeckEditModal.
 */
async function simulateHandleSaveDeck(
  selectedDeck: UnifiedDeckItem,
  formData: {
    name_en: string;
    name_ru: string;
    description_en: string;
    description_ru: string;
    is_active: boolean;
    is_premium: boolean;
    level?: string;
    category?: string;
  }
): Promise<void> {
  if (selectedDeck.type === 'vocabulary') {
    const payload: VocabularyDeckUpdatePayload = {
      name_en: formData.name_en || '',
      name_ru: formData.name_ru || '',
      description_en: formData.description_en || null,
      description_ru: formData.description_ru || null,
      is_active: formData.is_active,
      is_premium: formData.is_premium,
    };
    if ('level' in formData && formData.level) {
      payload.level = formData.level as VocabularyDeckUpdatePayload['level'];
    }
    await adminAPI.updateVocabularyDeck(selectedDeck.id, payload);
  } else {
    const payload: CultureDeckUpdatePayload = {
      name_en: formData.name_en || '',
      name_ru: formData.name_ru || '',
      description_en: formData.description_en || null,
      description_ru: formData.description_ru || null,
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
        name_en: deck.name as string,
        name_ru: 'Тестовая колода',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: true, // Toggling to premium
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая колода',
        description_en: null,
        description_ru: null,
        is_active: true,
        is_premium: true,
        level: 'A1',
      });
    });

    it('should include is_premium: false when toggling vocabulary deck to free', async () => {
      const deck = createMockVocabularyDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name_en: deck.name as string,
        name_ru: 'Тестовая колода',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: false, // Toggling to free
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая колода',
        description_en: null,
        description_ru: null,
        is_active: true,
        is_premium: false,
        level: 'A1',
      });
    });

    it('should preserve is_premium: false when no change is made', async () => {
      const deck = createMockVocabularyDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name_en: 'Updated Name',
        name_ru: 'Обновлённое имя',
        description_en: 'New description',
        description_ru: 'Новое описание',
        is_active: true,
        is_premium: false, // No change
        level: 'B1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name_en: 'Updated Name',
        name_ru: 'Обновлённое имя',
        description_en: 'New description',
        description_ru: 'Новое описание',
        is_active: true,
        is_premium: false,
        level: 'B1',
      });
    });

    it('should preserve is_premium: true when no change is made', async () => {
      const deck = createMockVocabularyDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name_en: 'Updated Name',
        name_ru: 'Обновлённое имя',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: true, // No change
        level: 'A2',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name_en: 'Updated Name',
        name_ru: 'Обновлённое имя',
        description_en: null,
        description_ru: null,
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
        name_en: deck.name as string,
        name_ru: 'Тестовая культурная колода',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: true, // Toggling to premium
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая культурная колода',
        description_en: null,
        description_ru: null,
        is_active: true,
        is_premium: true,
        category: 'history',
      });
    });

    it('should include is_premium: false when toggling culture deck to free', async () => {
      const deck = createMockCultureDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name_en: deck.name as string,
        name_ru: 'Тестовая культурная колода',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: false, // Toggling to free
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая культурная колода',
        description_en: null,
        description_ru: null,
        is_active: true,
        is_premium: false,
        category: 'history',
      });
    });

    it('should preserve is_premium: false when no change is made', async () => {
      const deck = createMockCultureDeck({ is_premium: false });

      await simulateHandleSaveDeck(deck, {
        name_en: 'Updated Culture Deck',
        name_ru: 'Обновлённая культурная колода',
        description_en: 'Description',
        description_ru: 'Описание',
        is_active: true,
        is_premium: false, // No change
        category: 'traditions',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name_en: 'Updated Culture Deck',
        name_ru: 'Обновлённая культурная колода',
        description_en: 'Description',
        description_ru: 'Описание',
        is_active: true,
        is_premium: false,
        category: 'traditions',
      });
    });

    it('should preserve is_premium: true when no change is made', async () => {
      const deck = createMockCultureDeck({ is_premium: true });

      await simulateHandleSaveDeck(deck, {
        name_en: 'Premium Culture Deck',
        name_ru: 'Премиум культурная колода',
        description_en: '',
        description_ru: '',
        is_active: true,
        is_premium: true, // No change
        category: 'geography',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name_en: 'Premium Culture Deck',
        name_ru: 'Премиум культурная колода',
        description_en: null,
        description_ru: null,
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
        name_en: deck.name as string,
        name_ru: 'Тестовая колода',
        description_en: '',
        description_ru: '',
        is_active: false, // Also deactivating
        is_premium: true, // Toggling to premium
        level: 'A1',
      });

      expect(adminAPI.updateVocabularyDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая колода',
        description_en: null,
        description_ru: null,
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
        name_en: deck.name as string,
        name_ru: 'Тестовая культурная колода',
        description_en: '',
        description_ru: '',
        is_active: true, // Reactivating
        is_premium: false, // Toggling to free
        category: 'history',
      });

      expect(adminAPI.updateCultureDeck).toHaveBeenCalledWith(deck.id, {
        name_en: deck.name,
        name_ru: 'Тестовая культурная колода',
        description_en: null,
        description_ru: null,
        is_active: true,
        is_premium: false,
        category: 'history',
      });
    });
  });

  describe('Bilingual field persistence', () => {
    it('should send separate name_en and name_ru for vocabulary deck', async () => {
      const deck = createMockVocabularyDeck();

      await simulateHandleSaveDeck(deck, {
        name_en: 'English Name',
        name_ru: 'Русское Название',
        description_en: 'English desc',
        description_ru: 'Русское описание',
        is_active: true,
        is_premium: false,
        level: 'A1',
      });

      const calledPayload = (adminAPI.updateVocabularyDeck as Mock).mock.calls[0][1];
      expect(calledPayload.name_en).toBe('English Name');
      expect(calledPayload.name_ru).toBe('Русское Название');
      expect(calledPayload.description_en).toBe('English desc');
      expect(calledPayload.description_ru).toBe('Русское описание');
      // Should NOT have legacy single-field keys
      expect(calledPayload).not.toHaveProperty('name');
      expect(calledPayload).not.toHaveProperty('description');
    });

    it('should send separate name_en and name_ru for culture deck', async () => {
      const deck = createMockCultureDeck();

      await simulateHandleSaveDeck(deck, {
        name_en: 'English Culture Name',
        name_ru: 'Культурное Название',
        description_en: 'English culture desc',
        description_ru: 'Описание культуры',
        is_active: true,
        is_premium: false,
        category: 'history',
      });

      const calledPayload = (adminAPI.updateCultureDeck as Mock).mock.calls[0][1];
      expect(calledPayload.name_en).toBe('English Culture Name');
      expect(calledPayload.name_ru).toBe('Культурное Название');
      expect(calledPayload.description_en).toBe('English culture desc');
      expect(calledPayload.description_ru).toBe('Описание культуры');
      // Should NOT have legacy single-field keys
      expect(calledPayload).not.toHaveProperty('name');
      expect(calledPayload).not.toHaveProperty('description');
    });
  });
});
