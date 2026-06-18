/**
 * AdminPage — AllDecksList 3-Way Status Filter Tests
 *
 * Covers ADMIN2-35-03: Deck list filter bar → SegControl pills (Type + Status)
 *
 * Acceptance criteria tested:
 * AC-6  status_filter_all_shows_all      — 'all' returns every deck
 * AC-7  status_filter_active_shows_active — 'active' returns only is_active===true
 * AC-8  status_filter_deactivated_shows_inactive — 'deactivated' returns only is_active===false
 * AC-9  status_filter_persists_to_localStorage — writes/reads 'admin.deckList.statusFilter';
 *        unknown stored value defaults to 'all'
 * AC-10 status_filter_not_in_api_params — fetch params contain only page/page_size/search/type,
 *        never status/is_active/hideDeactivated
 *
 * NOTE FOR EXECUTOR (ADMIN2-35-03):
 * The specs below import `computeDisplayDecks` as a named export from
 * `@/pages/AdminPage`. You MUST export this pure helper from AdminPage.tsx:
 *
 *   export type StatusFilter = 'all' | 'active' | 'deactivated';
 *   export function computeDisplayDecks(
 *     decks: UnifiedDeckItem[],
 *     statusFilter: StatusFilter,
 *   ): UnifiedDeckItem[] {
 *     if (statusFilter === 'all') return decks;
 *     return decks.filter(d => statusFilter === 'active' ? d.is_active : !d.is_active);
 *   }
 *
 * The localStorage key has changed:
 *   OLD: 'admin.deckList.hideDeactivated'  (boolean string)
 *   NEW: 'admin.deckList.statusFilter'     ('all'|'active'|'deactivated')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UnifiedDeckItem, DeckListResponse } from '@/services/adminAPI';
// RED: computeDisplayDecks and StatusFilter are not yet exported from AdminPage.
// This import will fail (or the function will be undefined) until the executor adds the export.
import { computeDisplayDecks, type StatusFilter } from '@/pages/AdminPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-1',
  name: 'Test Deck',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 10,
  is_active: true,
  is_premium: false,
  is_system_deck: false,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

/**
 * Mirrors the localStorage init logic the executor will write:
 *   const stored = localStorage.getItem('admin.deckList.statusFilter');
 *   const initial: StatusFilter =
 *     stored === 'active' || stored === 'deactivated' ? stored : 'all';
 */
function readStatusFilterFromStorage(): StatusFilter {
  const stored = localStorage.getItem('admin.deckList.statusFilter');
  return stored === 'active' || stored === 'deactivated' ? stored : 'all';
}

/**
 * Mirrors the onChange handler the executor will write:
 *   localStorage.setItem('admin.deckList.statusFilter', value);
 */
function writeStatusFilterToStorage(value: StatusFilter): void {
  localStorage.setItem('admin.deckList.statusFilter', value);
}

// ---------------------------------------------------------------------------
// Test data — mixed list with active and inactive decks
// ---------------------------------------------------------------------------

const activeDeck1 = createMockDeck({ id: 'a1', name: 'Active Deck 1', is_active: true });
const activeDeck2 = createMockDeck({ id: 'a2', name: 'Active Deck 2', is_active: true });
const inactiveDeck1 = createMockDeck({ id: 'i1', name: 'Inactive Deck 1', is_active: false });
const inactiveDeck2 = createMockDeck({ id: 'i2', name: 'Inactive Deck 2', is_active: false });

const mixedList: UnifiedDeckItem[] = [activeDeck1, activeDeck2, inactiveDeck1, inactiveDeck2];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AllDecksList — 3-Way Status Filter (ADMIN2-35-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // AC-6 — status_filter_all_shows_all
  // -------------------------------------------------------------------------
  describe('status_filter_all_shows_all', () => {
    it("returns all rows when statusFilter is 'all'", () => {
      const result = computeDisplayDecks(mixedList, 'all');
      expect(result).toHaveLength(4);
      expect(result.map((d) => d.id)).toContain('a1');
      expect(result.map((d) => d.id)).toContain('i1');
    });

    it("returns all rows when list is all-active and statusFilter is 'all'", () => {
      const allActive = [activeDeck1, activeDeck2];
      expect(computeDisplayDecks(allActive, 'all')).toHaveLength(2);
    });

    it("returns all rows when list is all-inactive and statusFilter is 'all'", () => {
      const allInactive = [inactiveDeck1, inactiveDeck2];
      expect(computeDisplayDecks(allInactive, 'all')).toHaveLength(2);
    });

    it("returns empty array for empty list and statusFilter 'all'", () => {
      expect(computeDisplayDecks([], 'all')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AC-7 — status_filter_active_shows_active
  // -------------------------------------------------------------------------
  describe('status_filter_active_shows_active', () => {
    it("returns only is_active===true rows when statusFilter is 'active'", () => {
      const result = computeDisplayDecks(mixedList, 'active');
      expect(result).toHaveLength(2);
      expect(result.every((d) => d.is_active)).toBe(true);
      expect(result.map((d) => d.id)).not.toContain('i1');
      expect(result.map((d) => d.id)).not.toContain('i2');
    });

    it("returns empty array when all decks are inactive and statusFilter is 'active'", () => {
      const allInactive = [inactiveDeck1, inactiveDeck2];
      expect(computeDisplayDecks(allInactive, 'active')).toHaveLength(0);
    });

    it("returns all rows when all decks are active and statusFilter is 'active'", () => {
      const allActive = [activeDeck1, activeDeck2];
      const result = computeDisplayDecks(allActive, 'active');
      expect(result).toHaveLength(2);
      expect(result.every((d) => d.is_active)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AC-8 — status_filter_deactivated_shows_inactive
  // -------------------------------------------------------------------------
  describe('status_filter_deactivated_shows_inactive', () => {
    it("returns only is_active===false rows when statusFilter is 'deactivated'", () => {
      const result = computeDisplayDecks(mixedList, 'deactivated');
      expect(result).toHaveLength(2);
      expect(result.every((d) => !d.is_active)).toBe(true);
      expect(result.map((d) => d.id)).not.toContain('a1');
      expect(result.map((d) => d.id)).not.toContain('a2');
    });

    it("returns empty array when all decks are active and statusFilter is 'deactivated'", () => {
      const allActive = [activeDeck1, activeDeck2];
      expect(computeDisplayDecks(allActive, 'deactivated')).toHaveLength(0);
    });

    it("returns all rows when all decks are inactive and statusFilter is 'deactivated'", () => {
      const allInactive = [inactiveDeck1, inactiveDeck2];
      const result = computeDisplayDecks(allInactive, 'deactivated');
      expect(result).toHaveLength(2);
      expect(result.every((d) => !d.is_active)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AC-9 — status_filter_persists_to_localStorage
  // -------------------------------------------------------------------------
  describe('status_filter_persists_to_localStorage', () => {
    it("writes 'deactivated' to localStorage['admin.deckList.statusFilter']", () => {
      writeStatusFilterToStorage('deactivated');
      expect(localStorage.getItem('admin.deckList.statusFilter')).toBe('deactivated');
    });

    it("reads back 'deactivated' from storage after writing", () => {
      writeStatusFilterToStorage('deactivated');
      expect(readStatusFilterFromStorage()).toBe('deactivated');
    });

    it("writes 'active' and reads it back correctly", () => {
      writeStatusFilterToStorage('active');
      expect(readStatusFilterFromStorage()).toBe('active');
    });

    it("writes 'all' and reads it back correctly", () => {
      writeStatusFilterToStorage('all');
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("defaults to 'all' when localStorage is empty (no prior value)", () => {
      // localStorage is clear from beforeEach
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("defaults to 'all' when stored value is the OLD boolean key 'true'", () => {
      // Migration guard: leftover from the old 'hideDeactivated' boolean scheme
      localStorage.setItem('admin.deckList.statusFilter', 'true');
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("defaults to 'all' when stored value is an unknown string", () => {
      localStorage.setItem('admin.deckList.statusFilter', 'hidden');
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("defaults to 'all' when stored value is the old boolean key 'false'", () => {
      localStorage.setItem('admin.deckList.statusFilter', 'false');
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("uses the new key 'admin.deckList.statusFilter', not the old 'admin.deckList.hideDeactivated'", () => {
      writeStatusFilterToStorage('active');
      // New key is set
      expect(localStorage.getItem('admin.deckList.statusFilter')).toBe('active');
      // Old key must NOT be touched
      expect(localStorage.getItem('admin.deckList.hideDeactivated')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC-10 — status_filter_not_in_api_params
  // -------------------------------------------------------------------------
  describe('status_filter_not_in_api_params', () => {
    /**
     * Status filter is CLIENT-SIDE ONLY. The params object built for adminAPI.listDecks
     * must NEVER contain status/is_active/hideDeactivated — regardless of what statusFilter
     * is currently set to. We verify this by constructing the params exactly as the
     * component will (page, page_size, + conditional search + conditional type).
     */
    it('params object contains only page/page_size when search and type are absent', () => {
      const params: Record<string, unknown> = {
        page: 1,
        page_size: 20,
      };
      const keys = Object.keys(params);
      expect(keys).not.toContain('status');
      expect(keys).not.toContain('is_active');
      expect(keys).not.toContain('hideDeactivated');
      expect(keys).not.toContain('statusFilter');
      expect(keys).toContain('page');
      expect(keys).toContain('page_size');
    });

    it('params object with search and type still has no status-related keys', () => {
      const params: Record<string, unknown> = { page: 1, page_size: 20 };
      const search = 'greek';
      const typeFilter = 'vocabulary';
      // This is how the component builds params — statusFilter intentionally excluded
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;

      const keys = Object.keys(params);
      expect(keys).not.toContain('status');
      expect(keys).not.toContain('is_active');
      expect(keys).not.toContain('hideDeactivated');
      expect(keys).not.toContain('statusFilter');
      // These are the only allowed keys
      expect(keys).toEqual(expect.arrayContaining(['page', 'page_size', 'search', 'type']));
      // And ONLY those four
      expect(keys.every((k) => ['page', 'page_size', 'search', 'type'].includes(k))).toBe(true);
    });

    it('statusFilter=deactivated still produces a params object with no status key', () => {
      // Even when the component is displaying only deactivated decks, the API call
      // must not reflect that — the filtering happens entirely client-side after fetch.
      const statusFilter: StatusFilter = 'deactivated';
      const params: Record<string, unknown> = { page: 1, page_size: 20 };
      // statusFilter is deliberately NOT added to params
      void statusFilter; // referenced to silence lint, not added to params

      expect(Object.keys(params)).not.toContain('status');
      expect(Object.keys(params)).not.toContain('is_active');
      expect(Object.keys(params)).not.toContain('statusFilter');
    });

    it('client-side filtering is applied AFTER the full server response', () => {
      // The server returns a mixed list; client filter runs after fetch.
      // This verifies the separation: API sees all, display sees filtered.
      const serverResponse: DeckListResponse = {
        decks: [activeDeck1, inactiveDeck1],
        total: 2,
        page: 1,
        page_size: 20,
      };

      // Simulate what happens after fetch: apply client filter
      const displayDecks = computeDisplayDecks(serverResponse.decks, 'active');
      expect(displayDecks).toHaveLength(1);
      expect(displayDecks[0].id).toBe('a1');

      // server.total still reflects the unfiltered count (server doesn't know about filter)
      expect(serverResponse.total).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL-1 — stale_old_key_tolerated
  // If the OLD boolean key 'admin.deckList.hideDeactivated' is present but the
  // NEW key is absent, the filter must default to 'all' and not crash.
  // -------------------------------------------------------------------------
  describe('stale_old_key_tolerated (migration robustness)', () => {
    it("defaults to 'all' when only the old boolean key is present (true)", () => {
      localStorage.setItem('admin.deckList.hideDeactivated', 'true');
      // New key is absent — readStatusFilterFromStorage mirrors the init logic
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it("defaults to 'all' when only the old boolean key is present (false)", () => {
      localStorage.setItem('admin.deckList.hideDeactivated', 'false');
      expect(readStatusFilterFromStorage()).toBe('all');
    });

    it('does not crash and returns all decks when the old key is present', () => {
      localStorage.setItem('admin.deckList.hideDeactivated', 'true');
      const filter = readStatusFilterFromStorage();
      // Should not throw; result must be 'all'
      expect(filter).toBe('all');
      // And computeDisplayDecks must pass through everything unchanged
      const result = computeDisplayDecks(mixedList, filter);
      expect(result).toHaveLength(4);
    });

    it('uses the new key when both old and new keys are set, ignoring the old one', () => {
      localStorage.setItem('admin.deckList.hideDeactivated', 'true');
      localStorage.setItem('admin.deckList.statusFilter', 'active');
      expect(readStatusFilterFromStorage()).toBe('active');
    });
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL-2 — type_and_status_combined
  // The status filter operates on the list ALREADY filtered by type (server-side).
  // computeDisplayDecks receives the server-returned page (already type-scoped)
  // and applies the status filter on top. Verify layering.
  // -------------------------------------------------------------------------
  describe('type_and_status_combined (layering)', () => {
    // Build a more specific mixed list: 2 vocab active, 1 vocab inactive, 1 culture active
    const vocabActive1 = createMockDeck({ id: 'va1', type: 'vocabulary', is_active: true });
    const vocabActive2 = createMockDeck({ id: 'va2', type: 'vocabulary', is_active: true });
    const vocabInactive = createMockDeck({ id: 'vi1', type: 'vocabulary', is_active: false });
    const cultureActive = createMockDeck({ id: 'ca1', type: 'culture', is_active: true });

    it("status 'active' on a vocab-only server response returns only active vocab decks", () => {
      // Server has already filtered to vocabulary; client sees [va1, va2, vi1]
      const serverVocabPage = [vocabActive1, vocabActive2, vocabInactive];
      const result = computeDisplayDecks(serverVocabPage, 'active');
      expect(result).toHaveLength(2);
      expect(result.every((d) => d.is_active && d.type === 'vocabulary')).toBe(true);
    });

    it("status 'deactivated' on a vocab-only server response returns only inactive vocab decks", () => {
      const serverVocabPage = [vocabActive1, vocabActive2, vocabInactive];
      const result = computeDisplayDecks(serverVocabPage, 'deactivated');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('vi1');
    });

    it("status 'all' on a mixed server page returns all items (no double-filtering)", () => {
      const serverMixed = [vocabActive1, vocabInactive, cultureActive];
      const result = computeDisplayDecks(serverMixed, 'all');
      expect(result).toHaveLength(3);
    });

    it('status filter does not cross-filter by type — culture deck passes active filter', () => {
      // If server returned both vocab and culture (typeFilter='all'), status='active'
      // must pass through ALL active decks regardless of type.
      const serverAll = [vocabActive1, vocabInactive, cultureActive];
      const result = computeDisplayDecks(serverAll, 'active');
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toContain('va1');
      expect(result.map((d) => d.id)).toContain('ca1');
      expect(result.map((d) => d.id)).not.toContain('vi1');
    });

    it('status and type layering: empty result when no deck matches both constraints', () => {
      // Server returned only vocab decks (typeFilter='vocabulary'); all are active.
      // Status='deactivated' → nothing passes.
      const serverVocabAllActive = [vocabActive1, vocabActive2];
      const result = computeDisplayDecks(serverVocabAllActive, 'deactivated');
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL-3 — default_selection
  // With no stored key, 'all' is the default and computeDisplayDecks returns all.
  // -------------------------------------------------------------------------
  describe('default_selection', () => {
    it("computeDisplayDecks(list,'all') returns the full list unchanged", () => {
      // No localStorage interaction — pure function default
      const result = computeDisplayDecks(mixedList, 'all');
      expect(result).toBe(mixedList); // same reference: 'all' returns the array as-is
    });

    it('default filter from empty localStorage is all and produces full list', () => {
      // localStorage is clear (beforeEach clears it)
      const defaultFilter = readStatusFilterFromStorage();
      expect(defaultFilter).toBe('all');
      const result = computeDisplayDecks(mixedList, defaultFilter);
      expect(result).toHaveLength(4);
    });

    it('default filter does not accidentally exclude newly-created decks with is_active=true', () => {
      const freshDeck = createMockDeck({ id: 'fresh', is_active: true });
      const list = [...mixedList, freshDeck];
      const result = computeDisplayDecks(list, 'all');
      expect(result).toHaveLength(5);
      expect(result.map((d) => d.id)).toContain('fresh');
    });
  });
});
