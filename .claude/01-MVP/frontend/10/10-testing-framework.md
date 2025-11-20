# Task 10: Frontend Testing Framework

**Status**: ⏸️ **NOT STARTED** (0/10 subtasks - 0%)
**File**: [10-testing-framework.md](./10/10-testing-framework.md)
**Created**: 2025-11-08
**Priority**: High (Production Readiness Requirement)
**Duration**: 20-30 hours (1,200-1,800 minutes total)
**Dependencies**: Tasks 01-09 (All frontend features completed ✅)

---

## Executive Summary

**What This Task Accomplishes**: Implement a comprehensive, production-ready testing framework covering unit, integration, and end-to-end (E2E) tests for the Learn Greek Easy MVP. This framework ensures code quality, prevents regressions, and enables confident deployments by validating all critical user journeys and component behaviors.

**Why It Matters**: Testing is essential for production readiness. Without comprehensive tests, every code change risks breaking existing functionality. A well-architected testing framework provides:
- **Confidence**: Deploy changes knowing they won't break production
- **Documentation**: Tests serve as living documentation of expected behavior
- **Regression Prevention**: Catch bugs before they reach users
- **Faster Development**: Catch issues during development, not in production
- **CI/CD Enablement**: Automated tests in GitHub Actions prevent bad deployments

**What Success Looks Like**: A complete testing suite with 70% overall code coverage (targeting 70% unit, 20% integration, 10% E2E following testing pyramid principles). All critical user journeys covered by E2E tests. Tests run automatically in CI/CD pipeline. Zero failing tests before deployment.

---

## Background and Motivation

### Current State

**Completed Frontend Features** (Tasks 01-09 - All ✅):
1. ✅ Main Page Design
2. ✅ Core Setup & Configuration (React 19, Vite 7, TypeScript 5.9, Tailwind)
3. ✅ Authentication & User Management (Login, Register, Protected Routes, Session)
4. ✅ Deck Management Interface (Browse, Search, Filter, Details)
5. ✅ Flashcard Review System (SM-2 Algorithm, Keyboard Shortcuts)
6. ✅ Progress & Analytics Dashboard (Charts, Widgets, Activity Feed)
7. ✅ UI Components Documentation & Refactoring (60+ components)
8. ✅ Settings & User Preferences (Account, Preferences, Danger Zone)
9. ✅ Final Review & Bugfixes (8 bugs fixed, production-ready)

**Current Testing Status**:
- **Unit Tests**: ❌ None (`package.json` has placeholder: `"test": "echo \"No tests configured yet\""`)
- **Integration Tests**: ❌ None
- **E2E Tests**: ✅ Manual testing via Playwright MCP (used in Tasks 06-09 for verification)
- **Test Framework**: ❌ Not configured (no Vitest, no React Testing Library)
- **CI/CD**: ❌ No automated test runs

**Technical Context**:
- **Tech Stack**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS + Shadcn/ui
- **State Management**: Zustand (client state) + localStorage (persistence)
- **Backend**: Mock backend (localStorage-based) - will migrate to FastAPI + PostgreSQL later
- **Accessibility**: WCAG 2.1 AA compliance target
- **Node Version**: >=18.0.0, npm >=9.0.0

### The Gap

**What's Missing**:

1. **No Test Framework Configuration**:
   - Vitest not installed or configured
   - React Testing Library not set up
   - Playwright E2E not configured for automated tests
   - No test utilities or helpers
   - No test coverage reporting

2. **No Unit Tests**:
   - Utilities not tested (SM-2 algorithm, date helpers, formatters)
   - Hooks not tested (useForm, useDebounce, custom hooks)
   - Zustand stores not tested (auth, deck, review, analytics)
   - Service layer not tested (mockDeckAPI, mockAuthAPI)
   - TypeScript types not validated

3. **No Integration Tests**:
   - Component interactions not tested (form submission flows)
   - User journeys not covered (login → browse decks → review cards)
   - Store + component integration not tested
   - Router navigation not tested
   - Protected route access not validated

4. **No E2E Tests**:
   - Critical user journeys not automated (authentication, flashcard review)
   - Multi-page flows not covered (deck selection → review session → results)
   - Accessibility not tested programmatically
   - Keyboard navigation not automated
   - Mobile responsive behavior not validated

5. **No CI/CD Integration**:
   - No GitHub Actions workflow for tests
   - No pre-commit hooks for test execution
   - No build-time test validation
   - No coverage reporting in PRs

### Business Value

**For Product Quality**:
- **Regression Prevention**: Catch bugs before deployment (estimated 80% of bugs caught by tests)
- **User Trust**: Reliable product increases retention and referrals
- **Faster Iteration**: Confident refactoring enables feature velocity
- **Production Stability**: Fewer emergency hotfixes and rollbacks

**For Development Team**:
- **Developer Confidence**: Make changes without fear of breaking things
- **Faster Onboarding**: New developers understand behavior from tests
- **Code Documentation**: Tests document expected behavior better than comments
- **Refactoring Safety**: Comprehensive tests enable architecture improvements

**For MVP Launch**:
- **Investor Confidence**: Professional testing signals product maturity
- **Production Readiness**: Required for serious deployment
- **Quality Assurance**: Demonstrates commitment to user experience
- **Risk Mitigation**: Reduces likelihood of embarrassing launch bugs

### User Impact Stories

1. **Dimitris (28, daily user)**:
   - **Without Tests**: App breaks after update - loses 2-week streak, stops using app
   - **With Tests**: Update deploys smoothly - continues 50-day streak, becomes premium user

2. **Elena (42, accessibility needs)**:
   - **Without Tests**: Keyboard navigation breaks silently - can't use app
   - **With Tests**: Accessibility regression caught in CI - keyboard support maintained

3. **Yiannis (Development Team)**:
   - **Without Tests**: Spends 3 hours debugging why deck progress isn't saving
   - **With Tests**: Unit test catches localStorage bug in 5 minutes during development

4. **Sofia (Product Manager)**:
   - **Without Tests**: Afraid to ship new features - might break existing functionality
   - **With Tests**: Confidently ships weekly releases - tests prevent regressions

---

## Testing Strategy Overview

### Testing Pyramid Architecture

We follow the **Testing Pyramid** approach: many fast unit tests, fewer integration tests, minimal E2E tests.

```
         /\
        /  \     E2E Tests (10% - 200 tests)
       /    \    - Critical user journeys
      /------\   - Multi-page flows
     /        \
    /  INTEG  \  Integration Tests (20% - 400 tests)
   /            \ - Component interactions
  /--------------\- User flow validation
 /                \
/   UNIT TESTS     \ Unit Tests (70% - 1,400 tests)
/                  \- Utilities, helpers, hooks
--------------------
     ~2,000 total tests
```

**Rationale**:
- **Unit Tests (70%)**: Fast (milliseconds), cheap to write, catch logic bugs early
- **Integration Tests (20%)**: Medium speed (seconds), validate component interactions
- **E2E Tests (10%)**: Slow (minutes), expensive, validate critical happy paths only

**Coverage Targets**:
- **Overall**: 70% code coverage minimum (industry standard for production apps)
- **Unit**: 80%+ coverage for utils, hooks, services
- **Integration**: 60%+ coverage for component interactions
- **E2E**: 100% coverage of critical user journeys (auth, review, deck management)

### Tools Selection

#### 1. Vitest + React Testing Library (Unit/Integration)

**Why Vitest**:
- ✅ Built for Vite (our build tool) - native integration, no configuration overhead
- ✅ Fast: Up to 10x faster than Jest due to Vite's esbuild integration
- ✅ Compatible API: Drop-in Jest replacement (same assertions, same mocking)
- ✅ TypeScript support out-of-the-box (no babel config needed)
- ✅ Watch mode with HMR (instant re-runs on file changes)
- ✅ Built-in coverage via c8/istanbul

**Why React Testing Library**:
- ✅ Industry standard (used by React team, recommended in React docs)
- ✅ Encourages accessibility (tests use ARIA roles, labels like users do)
- ✅ User-centric approach (tests interact with DOM like real users)
- ✅ Prevents implementation detail testing (focuses on behavior, not internals)
- ✅ Excellent TypeScript support

**Alternatives Considered**:
- ❌ **Jest**: Slower than Vitest, requires additional Vite configuration
- ❌ **Enzyme**: Deprecated, encourages testing implementation details
- ❌ **Cypress Component Testing**: Slower than Vitest, browser-based overhead

#### 2. Playwright (E2E Testing)

**Why Playwright**:
- ✅ Already used in project (Playwright MCP for manual testing in Tasks 06-09)
- ✅ Cross-browser support (Chromium, Firefox, WebKit)
- ✅ Auto-wait built-in (no flaky tests from timing issues)
- ✅ Mobile emulation (test responsive behavior programmatically)
- ✅ Powerful debugging (trace viewer, screenshot on failure)
- ✅ Parallel execution (faster CI/CD pipeline)
- ✅ Accessibility testing via axe-core integration

**Alternatives Considered**:
- ❌ **Cypress**: Slower, less mature cross-browser support, harder parallelization
- ❌ **Selenium**: Outdated API, requires separate driver management
- ❌ **Puppeteer**: Chromium-only, less features than Playwright

#### 3. Supporting Tools

- **@testing-library/user-event**: Simulate realistic user interactions (typing, clicking)
- **@testing-library/jest-dom**: Custom matchers for DOM assertions (`toBeInTheDocument()`)
- **msw (Mock Service Worker)**: Mock API requests in integration tests
- **@axe-core/playwright**: Automated accessibility testing
- **happy-dom / jsdom**: DOM implementation for unit tests (Vitest compatibility)

### Test Organization Structure

```
learn-greek-easy-frontend/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   └── __tests__/
│   │   │       └── button.test.tsx          # Component unit tests
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── __tests__/
│   │   │       └── LoginForm.test.tsx       # Form integration tests
│   │   └── ...
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   └── __tests__/
│   │       └── useDebounce.test.ts          # Hook unit tests
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── __tests__/
│   │       └── authStore.test.ts            # Store unit tests
│   ├── utils/
│   │   ├── sm2-algorithm.ts
│   │   └── __tests__/
│   │       └── sm2-algorithm.test.ts        # Utility unit tests
│   └── lib/
│       └── test-utils.tsx                   # Shared test utilities
├── tests/
│   ├── integration/
│   │   ├── auth-flow.test.tsx               # Multi-component flows
│   │   ├── review-session.test.tsx
│   │   └── deck-management.test.tsx
│   └── e2e/
│       ├── auth.spec.ts                     # Playwright E2E tests
│       ├── flashcard-review.spec.ts
│       ├── deck-browsing.spec.ts
│       └── settings.spec.ts
├── vitest.config.ts                         # Vitest configuration
├── playwright.config.ts                     # Playwright configuration
└── package.json
```

**Naming Conventions**:
- **Unit/Integration Tests**: `*.test.ts` or `*.test.tsx` (co-located with source)
- **E2E Tests**: `*.spec.ts` (in `tests/e2e/` directory)
- **Test Utilities**: `test-utils.tsx`, `test-helpers.ts`

---

## Subtasks Breakdown (10 Total)

### Phase 1: Framework Setup (Subtasks 10.01-10.02)

#### 10.01: Vitest + React Testing Library Setup (120 min)
**Goal**: Configure Vitest, React Testing Library, and test utilities for unit/integration testing.

**Deliverables**:
- Install dependencies (vitest, @testing-library/react, @testing-library/user-event, happy-dom)
- Create `vitest.config.ts` with TypeScript, coverage, globals
- Create `src/lib/test-utils.tsx` with custom render function (wraps providers)
- Write sample unit test (utility function test) to validate setup
- Update `package.json` scripts (`test`, `test:watch`, `test:coverage`, `test:ui`)
- Document testing conventions in `docs/testing-guide.md`

**Files**: vitest.config.ts, test-utils.tsx, package.json, docs/testing-guide.md

---

#### 10.02: Playwright E2E Setup (90 min)
**Goal**: Configure Playwright for automated E2E testing with CI/CD support.

**Deliverables**:
- Install Playwright (`@playwright/test`)
- Create `playwright.config.ts` (browsers, base URL, screenshot on failure)
- Create `tests/e2e/` directory structure
- Write sample E2E test (homepage navigation) to validate setup
- Configure GitHub Actions workflow (`.github/workflows/test.yml`)
- Setup Playwright reporters (HTML, JSON for CI)
- Document E2E testing best practices

**Files**: playwright.config.ts, tests/e2e/sample.spec.ts, .github/workflows/test.yml

---

### Phase 2: Unit Tests - Utilities & Helpers (Subtasks 10.03-10.04)

#### 10.03: Core Utilities Testing (180 min)
**Goal**: Write comprehensive unit tests for utility functions (SM-2 algorithm, date helpers, formatters).

**Deliverables**:
- Test SM-2 algorithm (`src/utils/__tests__/sm2-algorithm.test.ts`)
  - Test quality factor calculations (0-5 range)
  - Test interval calculations (first review, subsequent reviews)
  - Test edge cases (quality=0, quality=5, large intervals)
- Test date/time utilities (`formatDate`, `formatDuration`, `getRelativeTime`)
- Test string formatters (`formatNumber`, `formatPercentage`)
- Test validation helpers (`validateEmail`, `validatePassword`)
- Achieve 90%+ coverage for utils directory

**Files**: 8-10 test files in `src/utils/__tests__/`

---

#### 10.04: Custom Hooks Testing (120 min)
**Goal**: Write unit tests for all custom React hooks.

**Deliverables**:
- Test `useDebounce` hook (value debouncing, delay configuration)
- Test `useLocalStorage` hook (get, set, remove, JSON serialization)
- Test `useForm` hook (validation, submission, error handling)
- Test `useKeyboardShortcut` hook (key detection, modifier keys)
- Test `useMediaQuery` hook (responsive breakpoint detection)
- Test `usePrevious` hook (track previous values)
- Achieve 85%+ coverage for hooks directory

**Files**: 6-8 test files in `src/hooks/__tests__/`

---

### Phase 3: Unit Tests - Stores & Services (Subtask 10.05)

#### 10.05: Zustand Stores & Service Layer Testing (180 min)
**Goal**: Write unit tests for all Zustand stores and mock API services.

**Deliverables**:
- Test `authStore` (login, logout, session management, token refresh)
- Test `deckStore` (fetch decks, filter decks, select deck, update progress)
- Test `reviewStore` (start session, submit review, calculate SM-2, end session)
- Test `analyticsStore` (fetch stats, filter by date range, calculate metrics)
- Test `mockAuthAPI` service (login, register, error handling)
- Test `mockDeckAPI` service (getAllDecks, getDeckById, simulated delays)
- Achieve 80%+ coverage for stores and services

**Files**: 6-8 test files in `src/stores/__tests__/`, `src/services/__tests__/`

---

### Phase 4: Integration Tests - Components (Subtasks 10.06-10.07)

#### 10.06: Authentication Flow Integration Tests (150 min)
**Goal**: Write integration tests for authentication user flows (login, register, logout, protected routes).

**Deliverables**:
- Test Login flow (form validation, submission, success redirect, error handling)
- Test Register flow (password strength, confirm password, success redirect)
- Test Protected route access (redirect to login when unauthenticated)
- Test Session timeout (auto-logout after 30 minutes)
- Test Logout flow (clear session, redirect to login)
- Test "Remember Me" functionality (persistent vs session storage)
- Mock API responses with MSW (success, 401, 500 errors)

**Files**: `tests/integration/auth-flow.test.tsx`

---

#### 10.07: Flashcard Review System Integration Tests (180 min)
**Goal**: Write integration tests for the complete flashcard review user journey.

**Deliverables**:
- Test Review session initialization (fetch due cards, start session)
- Test Card flip interaction (show answer, keyboard shortcut)
- Test Quality rating submission (1-5 buttons, SM-2 calculation, next card)
- Test Session completion (summary screen, statistics, return to dashboard)
- Test Keyboard shortcuts (Space=flip, 1-5=rate, Esc=exit)
- Test Empty state (no due cards, show encouraging message)
- Test Session pause/resume functionality
- Achieve 70%+ coverage for review components

**Files**: `tests/integration/review-session.test.tsx`

---

### Phase 5: Integration Tests - Features (Subtask 10.08)

#### 10.08: Deck Management & Settings Integration Tests (150 min)
**Goal**: Write integration tests for deck browsing, filtering, and settings management.

**Deliverables**:
- Test Deck browsing (fetch decks, display cards, loading states)
- Test Deck filtering (level A1/A2, status filters, search by name)
- Test Deck detail page (card count, description, start review button)
- Test Settings - Account section (email update, password change)
- Test Settings - Preferences section (daily goal slider, auto-save)
- Test Settings - Danger Zone (reset progress, delete account confirmations)
- Mock API interactions with MSW

**Files**: `tests/integration/deck-management.test.tsx`, `tests/integration/settings.test.tsx`

---

### Phase 6: E2E Tests - Critical User Journeys (Subtasks 10.09-10.10)

#### 10.09: Core E2E User Journeys (240 min)
**Goal**: Write E2E tests for the top 5 critical user journeys using Playwright.

**Deliverables**:
- **E2E-01**: Complete authentication flow (register → login → dashboard)
- **E2E-02**: Full review session (login → select deck → review 5 cards → view summary)
- **E2E-03**: Deck browsing and filtering (browse → filter by level → search → view details)
- **E2E-04**: Settings management (change password → update daily goal → save preferences)
- **E2E-05**: Analytics dashboard (view charts → filter date range → check widgets)
- Each test runs in isolated context (fresh browser, clean localStorage)
- Screenshots on failure for debugging
- Cross-browser testing (Chromium, Firefox, WebKit)

**Files**: 5 test files in `tests/e2e/` (auth.spec.ts, review.spec.ts, decks.spec.ts, settings.spec.ts, analytics.spec.ts)

---

#### 10.10: Accessibility & Mobile E2E Tests + Documentation (180 min)
**Goal**: Write accessibility tests, mobile responsive tests, and finalize testing documentation.

**Deliverables**:
- **Accessibility Tests**:
  - Automated axe-core scans on all major pages (login, dashboard, review, settings)
  - Keyboard navigation testing (Tab, Enter, Esc, Arrow keys)
  - Screen reader announcement testing (ARIA labels, live regions)
  - Focus management testing (modal traps, focus restoration)
- **Mobile Responsive Tests**:
  - Test key flows on mobile viewport (375px width)
  - Test touch interactions (swipe, tap, pinch)
  - Test responsive layout breakpoints (375px, 768px, 1024px)
- **Documentation**:
  - Update `docs/testing-guide.md` with examples and best practices
  - Create `tests/README.md` with quick start instructions
  - Document CI/CD pipeline integration
  - Add test coverage badge to main README.md
- **Final Verification**:
  - Run full test suite (unit + integration + E2E)
  - Verify coverage targets met (70%+ overall)
  - Validate CI/CD pipeline passes
  - Fix any failing tests

**Files**: tests/e2e/accessibility.spec.ts, tests/e2e/mobile.spec.ts, docs/testing-guide.md, tests/README.md

---

## Files to Create/Modify

### Files to Create (40-50 new test files)

#### Configuration Files (4 files):
1. `vitest.config.ts` - Vitest configuration (~60 lines)
2. `playwright.config.ts` - Playwright configuration (~80 lines)
3. `.github/workflows/test.yml` - CI/CD test workflow (~100 lines)
4. `src/lib/test-utils.tsx` - Shared test utilities (~120 lines)

#### Documentation (3 files):
5. `docs/testing-guide.md` - Comprehensive testing documentation (~500 lines)
6. `tests/README.md` - Quick start guide (~150 lines)
7. `docs/ci-cd-guide.md` - CI/CD pipeline documentation (~200 lines)

#### Unit Tests - Utilities (8-10 files):
8. `src/utils/__tests__/sm2-algorithm.test.ts` (~200 lines)
9. `src/utils/__tests__/date-helpers.test.ts` (~150 lines)
10. `src/utils/__tests__/formatters.test.ts` (~120 lines)
11. `src/utils/__tests__/validators.test.ts` (~100 lines)
12. `src/utils/__tests__/storage-helpers.test.ts` (~80 lines)
13-15. Additional utility test files (~400 lines total)

#### Unit Tests - Hooks (6-8 files):
16. `src/hooks/__tests__/useDebounce.test.ts` (~100 lines)
17. `src/hooks/__tests__/useLocalStorage.test.ts` (~120 lines)
18. `src/hooks/__tests__/useForm.test.ts` (~150 lines)
19. `src/hooks/__tests__/useKeyboardShortcut.test.ts` (~80 lines)
20. `src/hooks/__tests__/useMediaQuery.test.ts` (~70 lines)
21-23. Additional hook test files (~300 lines total)

#### Unit Tests - Stores & Services (6-8 files):
24. `src/stores/__tests__/authStore.test.ts` (~250 lines)
25. `src/stores/__tests__/deckStore.test.ts` (~200 lines)
26. `src/stores/__tests__/reviewStore.test.ts` (~220 lines)
27. `src/stores/__tests__/analyticsStore.test.ts` (~180 lines)
28. `src/services/__tests__/mockAuthAPI.test.ts` (~150 lines)
29. `src/services/__tests__/mockDeckAPI.test.ts` (~130 lines)
30-31. Additional store/service test files (~200 lines total)

#### Integration Tests (3-4 files):
32. `tests/integration/auth-flow.test.tsx` (~300 lines)
33. `tests/integration/review-session.test.tsx` (~350 lines)
34. `tests/integration/deck-management.test.tsx` (~250 lines)
35. `tests/integration/settings.test.tsx` (~200 lines)

#### E2E Tests (7-8 files):
36. `tests/e2e/auth.spec.ts` (~200 lines)
37. `tests/e2e/flashcard-review.spec.ts` (~250 lines)
38. `tests/e2e/deck-browsing.spec.ts` (~180 lines)
39. `tests/e2e/settings.spec.ts` (~150 lines)
40. `tests/e2e/analytics.spec.ts` (~120 lines)
41. `tests/e2e/accessibility.spec.ts` (~200 lines)
42. `tests/e2e/mobile.spec.ts` (~150 lines)
43. `tests/e2e/helpers.ts` - Shared E2E helpers (~100 lines)

**Total New Files**: ~43 files, ~6,500-7,500 lines of test code

### Files to Modify (2 files)

1. `package.json` - Add test scripts and dependencies (~30 lines added)
2. `README.md` - Add test coverage badge and testing section (~20 lines added)

**Total Modified**: 2 files, ~50 lines added

### Total Impact

- **New Files**: 43 files (config, docs, tests)
- **Modified Files**: 2 files (package.json, README)
- **New Code**: ~6,500-7,500 lines (test code + configuration)
- **Modified Code**: ~50 lines
- **Total Lines**: ~6,550-7,550 lines
- **Coverage Target**: 70%+ overall (1,400 unit + 400 integration + 200 E2E ≈ 2,000 tests)

---

## Success Criteria

### Functional Requirements

#### Test Framework Setup
- ✅ Vitest configured with TypeScript support and coverage reporting
- ✅ React Testing Library configured with custom render utilities
- ✅ Playwright configured with cross-browser support (Chromium, Firefox, WebKit)
- ✅ Test scripts work (`npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run test:e2e`)
- ✅ CI/CD pipeline configured in GitHub Actions (runs on PR, blocks merge if tests fail)

#### Coverage Targets
- ✅ **Overall**: 70%+ code coverage (measured by Vitest coverage reports)
- ✅ **Utils**: 90%+ coverage (SM-2 algorithm, date helpers, validators)
- ✅ **Hooks**: 85%+ coverage (all custom hooks tested)
- ✅ **Stores**: 80%+ coverage (auth, deck, review, analytics stores)
- ✅ **Components**: 60%+ coverage (focus on critical components)
- ✅ **E2E**: 100% coverage of critical user journeys (5 core flows)

#### Test Quality
- ✅ All tests pass (`npm test`, `npm run test:e2e` exit with code 0)
- ✅ No flaky tests (tests pass consistently across 10 consecutive runs)
- ✅ Fast execution (unit tests <30s, integration <2min, E2E <10min)
- ✅ Tests follow AAA pattern (Arrange, Act, Assert)
- ✅ Tests use realistic user interactions (no implementation detail testing)
- ✅ Tests have clear descriptions (`it('should log in user when credentials are valid')`)

### Specific Test Coverage

#### Authentication (Priority: Critical)
- ✅ Login with valid credentials redirects to dashboard
- ✅ Login with invalid credentials shows error message
- ✅ Register with strong password creates account
- ✅ Register with weak password shows validation error
- ✅ Protected routes redirect to login when unauthenticated
- ✅ Session timeout logs out user after 30 minutes
- ✅ Logout clears session and redirects to login

#### Flashcard Review (Priority: Critical)
- ✅ Review session fetches due cards correctly
- ✅ Card flip shows answer (keyboard Space and button click)
- ✅ Quality rating (1-5) triggers SM-2 calculation
- ✅ SM-2 algorithm calculates next review interval correctly
- ✅ Session summary shows accurate statistics (cards reviewed, accuracy)
- ✅ Keyboard shortcuts work (Space=flip, 1-5=rate, Esc=exit)
- ✅ Empty state shown when no due cards

#### Deck Management (Priority: High)
- ✅ Decks load and display correctly
- ✅ Level filters (A1, A2, B1, B2) filter decks
- ✅ Status filters (Not Started, In Progress, Completed) work
- ✅ Search filters decks by name
- ✅ Deck detail page shows correct card count and description
- ✅ Progress bar updates after review session

#### Analytics Dashboard (Priority: Medium)
- ✅ Charts render with correct data (Progress, Accuracy, Deck Performance)
- ✅ Widgets display accurate metrics (Streak, Retention, Words Learned)
- ✅ Date range filter updates charts
- ✅ Activity feed shows recent sessions

#### Settings (Priority: Medium)
- ✅ Password change validates current password
- ✅ Daily goal slider updates and auto-saves
- ✅ Reset Progress confirmation dialog works (requires "RESET" input)
- ✅ Delete Account confirmation requires password and "DELETE" input
- ✅ Account deletion clears all data and logs out

### Accessibility (WCAG 2.1 AA)
- ✅ Automated axe-core scans pass on all pages (0 violations)
- ✅ Keyboard navigation works (Tab, Enter, Esc, Arrow keys)
- ✅ Focus indicators visible (2px blue outline)
- ✅ ARIA labels present on all interactive elements
- ✅ Screen reader announcements tested (form errors, toasts)
- ✅ Modal focus traps work (focus stays within dialog)

### Documentation
- ✅ `docs/testing-guide.md` created with examples and best practices
- ✅ `tests/README.md` created with quick start instructions
- ✅ `docs/ci-cd-guide.md` documents GitHub Actions pipeline
- ✅ Test coverage badge added to main README.md
- ✅ All test files have descriptive comments

### CI/CD Integration
- ✅ GitHub Actions workflow runs on every PR
- ✅ Tests run in parallel (unit, integration, E2E in separate jobs)
- ✅ Coverage report generated and uploaded
- ✅ PR blocked if tests fail or coverage drops below 70%
- ✅ E2E tests run in headless mode in CI
- ✅ Test results visible in PR comments

---

## Testing Best Practices & Conventions

### 1. Test Naming Conventions

**Good**:
```typescript
describe('SM-2 Algorithm', () => {
  it('should calculate quality factor correctly for quality rating 3', () => {
    // Test implementation
  });

  it('should increase interval after successful review (quality 4+)', () => {
    // Test implementation
  });

  it('should reset interval to 1 day when quality is 0-2', () => {
    // Test implementation
  });
});
```

**Bad**:
```typescript
describe('SM2', () => {
  it('works', () => { /* unclear what "works" means */ });
  it('test1', () => { /* non-descriptive */ });
});
```

### 2. AAA Pattern (Arrange, Act, Assert)

```typescript
it('should log in user when credentials are valid', async () => {
  // ARRANGE: Set up test data and render component
  const mockUser = { email: 'test@example.com', password: 'Test1234!' };
  render(<LoginForm />);

  // ACT: Perform user action
  await userEvent.type(screen.getByLabelText(/email/i), mockUser.email);
  await userEvent.type(screen.getByLabelText(/password/i), mockUser.password);
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));

  // ASSERT: Verify expected outcome
  await waitFor(() => {
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });
});
```

### 3. User-Centric Queries (React Testing Library)

**Prefer** (accessible, user-centric):
```typescript
screen.getByRole('button', { name: /log in/i })
screen.getByLabelText(/email address/i)
screen.getByText(/welcome back/i)
```

**Avoid** (implementation details):
```typescript
screen.getByTestId('login-button')      // Don't add test IDs unless necessary
screen.getByClassName('btn-primary')    // Classes can change
document.querySelector('.login-form')   // Too coupled to DOM structure
```

### 4. Async Testing

**Good** (wait for assertions):
```typescript
await waitFor(() => {
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

**Bad** (no waiting):
```typescript
// This will fail - component hasn't updated yet
expect(screen.getByText(/success/i)).toBeInTheDocument();
```

### 5. Mocking External Dependencies

```typescript
// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

// Mock API calls with MSW
const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({ token: 'mock-token' }));
  })
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 6. E2E Test Isolation

```typescript
// Each test gets fresh state
test('should complete flashcard review session', async ({ page }) => {
  // Start with clean localStorage
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());

  // Navigate and perform test
  await page.goto('http://localhost:5173');
  // ... test steps
});
```

---

## Timeline and Dependencies

### Estimated Timeline (Total: 20-30 hours)

| Subtask | Duration | Cumulative | Priority |
|---------|----------|------------|----------|
| 10.01: Vitest + RTL Setup | 120 min (2h) | 2h | Critical |
| 10.02: Playwright E2E Setup | 90 min (1.5h) | 3.5h | Critical |
| 10.03: Core Utilities Testing | 180 min (3h) | 6.5h | High |
| 10.04: Custom Hooks Testing | 120 min (2h) | 8.5h | High |
| 10.05: Stores & Services Testing | 180 min (3h) | 11.5h | High |
| 10.06: Auth Flow Integration | 150 min (2.5h) | 14h | Critical |
| 10.07: Review System Integration | 180 min (3h) | 17h | Critical |
| 10.08: Deck/Settings Integration | 150 min (2.5h) | 19.5h | Medium |
| 10.09: Core E2E Journeys | 240 min (4h) | 23.5h | Critical |
| 10.10: Accessibility + Docs | 180 min (3h) | 26.5h | High |
| **Total** | **1,590 min** | **26.5 hours** | - |

**Buffer**: +3.5 hours for debugging, fixing flaky tests, refactoring = **30 hours total**

### Dependencies

**Prerequisite Tasks** (All Completed ✅):
- ✅ Task 01-09: All frontend features complete (provides code to test)

**External Dependencies**:
- Node.js >=18.0.0 (already satisfied)
- npm >=9.0.0 (already satisfied)
- Browsers for Playwright (installed via `npx playwright install`)

**Internal Dependencies**:
- 10.01 → 10.03, 10.04, 10.05 (Vitest setup required for unit tests)
- 10.02 → 10.09, 10.10 (Playwright setup required for E2E tests)
- 10.03-10.05 → 10.06-10.08 (Unit tests foundation for integration tests)
- 10.06-10.08 → 10.09 (Integration tests validate components for E2E)
- All → 10.10 (Documentation requires all tests complete)

**Recommended Execution Order**:
1. **Sequential**: 10.01 → 10.02 (setup frameworks first)
2. **Parallel**: 10.03, 10.04, 10.05 (independent unit test groups)
3. **Sequential**: 10.06 → 10.07 → 10.08 (integration tests build on each other)
4. **Sequential**: 10.09 → 10.10 (E2E tests, then finalize docs)

---

## Risk Assessment

### High Risk Items

1. **Flaky E2E Tests**:
   - **Risk**: Playwright tests fail intermittently due to timing issues
   - **Mitigation**: Use Playwright's auto-wait, avoid `setTimeout`, enable retries in CI
   - **Probability**: Medium | **Impact**: High

2. **Low Coverage in Legacy Code**:
   - **Risk**: Some complex components have untested edge cases
   - **Mitigation**: Prioritize critical paths (auth, review), accept 60% coverage for non-critical components
   - **Probability**: High | **Impact**: Medium

### Medium Risk Items

1. **CI/CD Pipeline Performance**:
   - **Risk**: Tests take too long in CI (>15 minutes), slowing down PRs
   - **Mitigation**: Run unit/integration/E2E in parallel, cache dependencies, use matrix strategy
   - **Probability**: Medium | **Impact**: Medium

2. **Mock vs Real API Divergence**:
   - **Risk**: Tests pass with mocks but fail with real backend
   - **Mitigation**: Use MSW for realistic request/response mocking, document API contract
   - **Probability**: Low (no backend yet) | **Impact**: High (when backend exists)

### Low Risk Items

1. **Test Maintenance Overhead**:
   - **Risk**: Tests become outdated as features evolve
   - **Mitigation**: Follow user-centric testing (tests break when behavior changes, not implementation)
   - **Probability**: Low | **Impact**: Low

2. **Coverage Gaps**:
   - **Risk**: Some edge cases not covered by tests
   - **Mitigation**: Continuous improvement - add tests when bugs are found
   - **Probability**: Medium | **Impact**: Low

---

## Future Enhancements (Post-MVP)

### 1. Visual Regression Testing
- Tool: Playwright's screenshot comparison or Percy
- Use case: Detect unintended UI changes
- Effort: 2-3 hours setup + ongoing maintenance

### 2. Performance Testing
- Tool: Lighthouse CI
- Metrics: Page load time, Time to Interactive, Core Web Vitals
- Effort: 2-4 hours setup

### 3. Contract Testing (Backend Integration)
- Tool: Pact or MSW + TypeScript
- Use case: Validate frontend/backend API contracts
- Effort: 4-6 hours setup

### 4. Mutation Testing
- Tool: Stryker
- Use case: Verify test quality (detect untested code paths)
- Effort: 3-5 hours setup

### 5. Security Testing
- Tool: OWASP ZAP or Snyk
- Use case: Detect XSS, CSRF, dependency vulnerabilities
- Effort: 2-3 hours setup

---

## Open Questions

1. **Coverage Threshold Enforcement**:
   - Should we enforce 70% coverage in CI (fail build if below)?
   - **Recommendation**: Yes - enforce 70% minimum, with exceptions for generated code

2. **Test Execution in Pre-Commit Hook**:
   - Should we run tests before every commit (via Husky)?
   - **Recommendation**: Run unit tests only (fast), not E2E (too slow for pre-commit)

3. **Snapshot Testing**:
   - Should we use snapshot testing for component rendering?
   - **Recommendation**: No - snapshots are brittle and don't validate behavior

4. **Visual Testing for Responsive Design**:
   - Should we add visual regression tests for breakpoints?
   - **Recommendation**: Phase 2 - focus on functional tests first

---

## References

### Testing Documentation
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Guide](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Industry Standards
- [Testing Pyramid - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Test Coverage Standards](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- [WCAG 2.1 AA Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)

### Project Context
- [Architecture Decisions](../Architecture-Decisions.md) - State management and backend migration
- [Frontend Tasks Progress](../frontend/Frontend-Tasks-Progress.md) - Completed features to test
- [Components Reference](../../learn-greek-easy-frontend/docs/Components-Reference.md) - Component inventory

---

## Notes

1. **Testing Philosophy**:
   - Tests should validate **behavior**, not implementation
   - Write tests from **user's perspective** (what they see/do)
   - Prefer **integration tests** over unit tests for components (test interactions)
   - Keep E2E tests for **critical happy paths only** (slow and expensive)

2. **Coverage vs Quality**:
   - 70% coverage is a **minimum**, not a goal
   - 100% coverage doesn't guarantee bug-free code
   - Focus on **high-value tests** (critical user journeys, complex logic)
   - Accept lower coverage for trivial code (simple getters, formatters)

3. **Test Maintenance**:
   - Tests are **production code** - maintain with same rigor
   - Refactor tests when refactoring implementation
   - Delete outdated tests (don't let them rot)
   - Update tests when requirements change

4. **CI/CD Integration**:
   - Tests **must pass** before merge (no exceptions)
   - Coverage **must not decrease** from baseline
   - Flaky tests **must be fixed or deleted** (don't disable or skip)
   - Failed tests in CI = **block deployment**

5. **Time Estimate Assumptions**:
   - Assumes developer familiar with Vitest, React Testing Library, Playwright
   - Assumes existing code is testable (no major refactoring needed)
   - Assumes tests written incrementally (not all at once)
   - Buffer time accounts for debugging flaky tests and edge cases

---

**Document Version**: 1.0
**Created**: 2025-11-08
**Last Updated**: 2025-11-08
**Created By**: Claude (System Analyst Mode)
**Status**: Ready for Execution - Production Testing Framework
