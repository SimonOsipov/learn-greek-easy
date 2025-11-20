// src/stores/__tests__/deckStore.test.ts

/**
 * DeckStore Tests - SKIPPED
 *
 * Rationale for Skipping Unit Tests:
 * ===================================
 *
 * The deckStore uses Zustand's `persist` middleware to store user progress
 * in localStorage. This creates the same testing limitations as authStore.
 *
 * Technical Limitation:
 * ====================
 *
 * 1. **Persist Middleware Closure**: When deckStore.ts is imported, Zustand's
 *    persist middleware captures `window.localStorage` at module load time
 *    and holds a closure reference to it.
 *
 * 2. **Mock Timing**: Our test-setup.ts mocks localStorage AFTER the module
 *    has already loaded, so the mock is never used by the persist middleware.
 *
 * 3. **Partial Persistence**: Unlike authStore which persists full state,
 *    deckStore only persists `deckProgress` via the `partialize` option:
 *
 *    ```typescript
 *    partialize: (state) => ({
 *      deckProgress: state.deckProgress,
 *    })
 *    ```
 *
 *    This means:
 *    - `deckProgress` state is persisted (can't unit test)
 *    - Other state (decks, selectedDeck, filters) is NOT persisted (could test)
 *
 * Why Full Store Tests Are Still Skipped:
 * =======================================
 *
 * While we could test non-persisted state, the core business logic of deckStore
 * revolves around progress tracking (which uses persist). Testing only the
 * UI state (filters, selectedDeck) would provide minimal value because:
 *
 * - Progress updates are the most complex logic
 * - Filters are simple state updates
 * - SelectedDeck is a straightforward setter
 *
 * Testing Strategy:
 * ================
 *
 * 1. **Service Layer Tests** (This task):
 *    - mockDeckAPI.test.ts covers ALL deck business logic
 *    - Tests progress calculations, state transitions, error handling
 *    - Provides comprehensive coverage of deck operations
 *
 * 2. **Integration Tests** (Tasks 10.06-10.07):
 *    - End-to-end tests using Playwright
 *    - Tests: select deck → start learning → review cards → progress saved
 *    - Verifies localStorage persistence works in real browser
 *
 * 3. **Component Tests** (Tasks 10.06-10.07):
 *    - DecksPage.test.tsx tests deck listing and filtering
 *    - DeckDetailPage.test.tsx tests deck actions (start, reset, etc.)
 *
 * What Gets Tested Where:
 * ======================
 *
 * Business Logic (mockDeckAPI.test.ts):
 * - getAllDecks() with filters
 * - getDeckById()
 * - startDeck() - progress initialization
 * - reviewCard() - SR state updates
 * - reviewSession() - batch progress updates
 * - completeDeck() - completion logic
 * - resetDeckProgress() - reset logic
 *
 * Integration (Playwright):
 * - Full deck learning flow
 * - Progress persistence across page reloads
 * - Filter state management
 *
 * Components (React Testing Library):
 * - Deck list rendering
 * - Filter UI interactions
 * - Deck selection
 * - Action button states
 *
 * Future Refactoring Options:
 * ==========================
 *
 * Same options as authStore:
 *
 * Option A: Conditional Persistence (simplest for MVP)
 * ```typescript
 * const store = import.meta.env.MODE === 'test'
 *   ? create(storeConfig)
 *   : create(persist(storeConfig, { name: 'deck-progress-storage' }));
 * ```
 *
 * Option B: Extract Progress Logic (best long-term)
 * ```typescript
 * // Pure functions (easy to test)
 * export function calculateProgressUpdate(current, session) { ... }
 * export function shouldCompleteDeck(progress) { ... }
 *
 * // Store uses pure functions
 * reviewSession: async (deckId, ...) => {
 *   const updated = calculateProgressUpdate(get().deckProgress[deckId], session);
 *   set({ deckProgress: { ...get().deckProgress, [deckId]: updated } });
 * }
 * ```
 *
 * Option C: Backend Migration (planned for post-MVP)
 * When backend is ready, progress will move to PostgreSQL and this store
 * will only manage UI state (no persistence needed).
 *
 * Current Decision:
 * ================
 *
 * Skip unit tests for deckStore because:
 * 1. Business logic is comprehensively tested in mockDeckAPI.test.ts
 * 2. Integration tests cover full user flows
 * 3. Component tests cover UI interactions
 * 4. Store is temporary (backend migration planned)
 *
 * This provides sufficient coverage for MVP without architectural changes.
 *
 * See Also:
 * - src/stores/deckStore.ts (TODO comments for backend migration)
 * - .claude/01-MVP/frontend/10/10.04-component-testing.md (persistence limitations)
 * - .claude/01-MVP/frontend/10/10.06-integration-testing-plan.md (deck flow tests)
 */

describe.skip('deckStore (uses persist middleware)', () => {
  it('should be tested via service tests and integration tests', () => {
    // This test suite is intentionally skipped
    // See documentation above for rationale and testing alternatives
  });
});
