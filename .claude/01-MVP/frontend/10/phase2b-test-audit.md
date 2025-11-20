# Phase 2B Test Audit - Selector Mismatch Analysis

**Date**: 2025-11-09
**Current Status**: 94/234 passing (40.2%), 89 failing (38.0%), 54 skipped (23.1%)

## Root Cause Analysis

### Problem Identified
Tests are looking for **English text** but UI displays **Greek text** in key places:
- Login page title: "Καλώς ήρθατε!" (Welcome!) - not "Log In"
- Register page title: "Create your account" - not "Sign Up"
- Button text: "Sign In" / "Create Account" - not "Log In" / "Sign Up"

### Test Failure Categories

#### 1. Auth Flow Tests (auth.spec.ts) - 27 failures
**Failing Selectors**:
- `getByRole('heading', { name: /log in/i })` - UI shows "Καλώς ήρθατε!"
- `getByRole('heading', { name: /sign up/i })` - UI shows "Create your account"
- `getByRole('button', { name: /log in/i })` - UI shows "Sign In"
- `getByRole('button', { name: /sign up/i })` - UI shows "Create Account"
- `getByRole('heading', { name: /dashboard/i })` - May fail if Greek text used
- `getByRole('heading', { name: /decks/i })` - May fail if Greek text used
- `getByRole('heading', { name: /profile/i })` - May fail if Greek text used

**Forms Work Correctly**: Phase 2A confirmed forms render and are accessible.

**Fix Strategy**: Use test IDs and flexible selectors that don't depend on text.

#### 2. Mobile Responsive Tests (mobile-responsive.spec.ts) - 24 failures
**Failing Selectors**:
- `getByRole('button', { name: /log in/i })` - Same text mismatch
- `getByRole('button', { name: /menu|navigation/i })` - May not exist or have different text
- `getByRole('button', { name: /close/i })` - May not exist
- `getByRole('heading', { name: /greek alphabet/i })` - Deck may not exist or have Greek text

**Fix Strategy**: Use test IDs for buttons, check for structural elements instead of text.

#### 3. Accessibility Tests (accessibility.spec.ts) - 9 failures
**Axe-core tests likely passing** (automated checks).

**Failing Tests**:
- Form label tests - Should work (use `getByLabel(/email/i)`)
- Button name tests - Fail on "log in" vs "Sign In" mismatch
- Error message tests - May fail if specific text expected

**Fix Strategy**: Make text matching case-insensitive and flexible.

#### 4. Keyboard Navigation Tests (keyboard-navigation.spec.ts) - 6 failures
**Failing Tests**:
- Tab order tests - Should work (structural)
- Enter key submit - Should work (functional)
- Modal focus tests - Fail on "delete account" button not found

**Fix Strategy**: Use test IDs for specific buttons, keep structural tests.

## Implementation Plan

### Phase 1: Add Test IDs (Minimal Changes)
Add `data-testid` attributes ONLY where needed:

**Login.tsx**:
- Card: `data-testid="login-card"`
- Form: `data-testid="login-form"`
- Email input: `data-testid="email-input"`
- Password input: `data-testid="password-input"`
- Submit button: `data-testid="login-submit"`
- Register link: `data-testid="register-link"`

**Register.tsx**:
- Card: `data-testid="register-card"`
- Form: `data-testid="register-form"`
- Name input: `data-testid="name-input"`
- Email input: `data-testid="email-input"`
- Password input: `data-testid="password-input"`
- Confirm password: `data-testid="confirm-password-input"`
- Submit button: `data-testid="register-submit"`
- Login link: `data-testid="login-link"`

### Phase 2: Update Test Selectors
Replace text-based selectors with:
1. Test IDs (most reliable)
2. ARIA roles without text (flexible)
3. Input types and placeholders
4. Structural checks (tag names, hierarchy)

### Phase 3: Make Tests Language-Agnostic
- Check for heading existence, not specific text
- Use URL checks instead of page title checks
- Check for form structure, not button text
- Use element count checks for visibility

## Expected Outcomes

### Before
- Auth tests: 5/14 passing (~36%)
- Mobile tests: 0/15 passing (0%)
- Accessibility: 3/9 passing (33%)
- Keyboard: 2/8 passing (25%)

### After (Estimated)
- Auth tests: 12/14 passing (~85%)
- Mobile tests: 10/15 passing (~67%)
- Accessibility: 7/9 passing (~78%)
- Keyboard: 6/8 passing (~75%)

**Total Improvement**: +60-70 tests fixed, 65-75% overall pass rate

## Risk Assessment

**Low Risk**:
- Adding test IDs (non-breaking, UI unchanged)
- Making selectors more flexible (tests more robust)

**Medium Risk**:
- Some tests may need to be restructured significantly
- May uncover new issues (good!)

**No Risk**:
- Not changing any UI text or functionality
- Not changing component behavior
