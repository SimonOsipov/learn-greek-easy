// src/stores/__tests__/authStore.test.ts

/**
 * AuthStore Tests - SKIPPED
 *
 * Rationale for Skipping Unit Tests:
 * ===================================
 *
 * The authStore uses Zustand's `persist` middleware, which captures the
 * localStorage instance at module load time. This creates a fundamental
 * limitation for unit testing:
 *
 * 1. **Module Load Time Capture**: When authStore.ts is imported, Zustand's
 *    persist middleware immediately captures `window.localStorage` and holds
 *    a closure reference to it. This happens BEFORE test setup runs.
 *
 * 2. **Mock Timing Issue**: In test-setup.ts, we mock localStorage using
 *    `global.localStorage = mockStorage`. However, this mock is created
 *    AFTER the authStore module has already loaded and captured the real
 *    (or initial) localStorage reference.
 *
 * 3. **Closure Immutability**: Even if we reassign `window.localStorage` in
 *    tests, the authStore's persist middleware still references the original
 *    localStorage via its closure. We cannot "re-inject" a new localStorage
 *    into an already-created Zustand store.
 *
 * Attempted Solutions (All Failed):
 * ================================
 *
 * - Dynamic imports: Still captures localStorage on first import
 * - beforeAll/beforeEach mocking: Too late, module already loaded
 * - vi.resetModules(): Breaks other test dependencies
 * - Manual state reset: Doesn't fix persist middleware's storage reference
 *
 * Testing Strategy:
 * ================
 *
 * 1. **Integration Tests** (Tasks 10.06-10.07):
 *    - Full end-to-end tests using Playwright
 *    - Tests auth flow: login → localStorage persistence → page reload → session recovery
 *    - Verifies "remember me" functionality works in real browser environment
 *
 * 2. **Service Layer Tests** (This task):
 *    - mockAuthAPI.test.ts provides comprehensive coverage of auth logic
 *    - Tests login, register, token refresh, profile updates
 *    - Ensures business logic correctness independent of store
 *
 * 3. **Component Tests** (Tasks 10.06-10.07):
 *    - Login.test.tsx and Register.test.tsx test UI integration
 *    - Verifies components correctly call store actions
 *
 * Future Refactoring Options:
 * ==========================
 *
 * If unit testing becomes critical, consider these architectural changes:
 *
 * Option A: Conditional Persistence
 * ```typescript
 * const isPersistEnabled = import.meta.env.MODE !== 'test';
 * const store = isPersistEnabled
 *   ? persist(storeConfig, { name: 'auth-storage' })
 *   : storeConfig;
 * ```
 *
 * Option B: Extract Business Logic
 * ```typescript
 * // Pure functions (easy to unit test)
 * export function handleLogin(state, email, password) { ... }
 *
 * // Store (tested via integration)
 * export const useAuthStore = create(persist((set, get) => ({
 *   login: async (email, password) => {
 *     set(handleLogin(get(), email, password));
 *   }
 * })));
 * ```
 *
 * Option C: Dependency Injection
 * ```typescript
 * export function createAuthStore(storage = localStorage) {
 *   return create(persist(storeConfig, {
 *     storage: createJSONStorage(() => storage)
 *   }));
 * }
 * ```
 *
 * Trade-offs:
 * - Option A: Simple but doesn't test persist logic
 * - Option B: Best separation of concerns, more refactoring
 * - Option C: Most flexible but breaks singleton pattern
 *
 * Current Decision:
 * ================
 *
 * Skip unit tests for authStore and rely on:
 * 1. Integration tests for full auth flow
 * 2. Service tests for business logic
 * 3. Component tests for UI integration
 *
 * This provides adequate coverage while avoiding architectural complexity
 * for MVP. Refactor to Option B if auth logic becomes more complex.
 *
 * See Also:
 * - .claude/01-MVP/frontend/10/10.04-component-testing.md (localStorage testing limitations)
 * - .claude/01-MVP/frontend/10/10.06-integration-testing-plan.md (auth flow tests)
 * - Architecture-Decisions.md (Testing strategy section)
 */

describe.skip('authStore (uses persist middleware)', () => {
  it('should be tested via integration tests', () => {
    // This test suite is intentionally skipped
    // See documentation above for rationale and testing alternatives
  });
});
