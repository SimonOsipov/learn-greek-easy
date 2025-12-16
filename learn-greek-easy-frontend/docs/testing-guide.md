# Testing Guide - Learn Greek Easy Frontend

This guide covers testing conventions, best practices, and examples for the Learn Greek Easy frontend.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Open Vitest UI (browser-based test runner)
npm run test:ui

# Run tests related to changed files
npm run test:changed
```

## Tech Stack

- **Test Runner**: Vitest 2.1+ (fast, Vite-native)
- **Component Testing**: React Testing Library 16+
- **User Interactions**: @testing-library/user-event
- **Assertions**: Jest-compatible matchers (@testing-library/jest-dom)
- **Coverage**: V8 (built into Vitest)
- **DOM Environment**: happy-dom (lightweight, faster than jsdom)

## File Organization

```
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   └── __tests__/
│   │       └── button.test.tsx    # Component tests
├── hooks/
│   ├── useDebounce.ts
│   └── __tests__/
│       └── useDebounce.test.ts    # Hook tests
├── lib/
│   ├── dateUtils.ts
│   ├── __tests__/
│   │   └── dateUtils.test.ts      # Utility tests
│   ├── test-setup.ts              # Global test setup
│   └── test-utils.tsx              # Custom render utilities
└── stores/
    ├── authStore.ts
    └── __tests__/
        └── authStore.test.ts       # Store tests
```

## Testing Patterns

### 1. Component Testing

```typescript
import { render, screen } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('should submit form with valid credentials', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<LoginForm onSubmit={handleSubmit} />);

    // Fill form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');

    // Submit
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Assert
    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!',
    });
  });
});
```

### 2. Utility Function Testing

```typescript
import { formatDuration } from '@/utils/formatters';

describe('formatDuration', () => {
  it('should format seconds correctly', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3665)).toBe('1h 1m 5s');
  });
});
```

### 3. Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Still old value

    await waitFor(() => expect(result.current).toBe('updated'), { timeout: 600 });
  });
});
```

### 4. Zustand Store Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout(); // Reset state
  });

  it('should login user', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });
});
```

### 5. Async Testing

```typescript
import { render, screen, waitFor } from '@/lib/test-utils';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('should load and display user data', async () => {
    render(<UserProfile userId="123" />);

    // Initially shows loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
    });

    // Loading indicator should be gone
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
```

## Best Practices

### 1. Use Accessible Queries

**Good** (query by role, label, text):
```typescript
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email address/i)
screen.getByText(/welcome back/i)
```

**Avoid** (test IDs, classes, selectors):
```typescript
screen.getByTestId('submit-button')      // Only when no accessible query works
screen.getByClassName('btn-primary')     // Too coupled to styles
document.querySelector('.form')          // Not user-centric
```

### 2. Follow AAA Pattern

```typescript
it('should do something', () => {
  // ARRANGE: Set up test data
  const mockData = { ... };
  render(<Component data={mockData} />);

  // ACT: Perform action
  await userEvent.click(screen.getByRole('button'));

  // ASSERT: Verify outcome
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

### 3. Test User Behavior, Not Implementation

**Good**: Test what user sees/does
```typescript
expect(screen.getByText(/logged in as/i)).toBeInTheDocument();
```

**Avoid**: Test internal state
```typescript
expect(component.state.isLoggedIn).toBe(true);
```

### 4. Use userEvent, Not fireEvent

**Good**: Realistic user interactions
```typescript
const user = userEvent.setup();
await user.type(input, 'hello');
await user.click(button);
```

**Avoid**: Low-level events
```typescript
fireEvent.change(input, { target: { value: 'hello' } });
fireEvent.click(button);
```

### 5. Clean Up After Tests

```typescript
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatic cleanup is configured in test-setup.ts
afterEach(() => {
  cleanup();
});
```

### 6. Mock External Dependencies

```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('@/services/api', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: 1, name: 'John' })),
}));

// Mock function
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');
mockFn.mockResolvedValue('async mocked value');
```

## Custom Test Utilities

### Custom Render with Providers

Use `@/lib/test-utils` for components that need providers:

```typescript
import { render, screen } from '@/lib/test-utils';

// Automatically wraps component with BrowserRouter and Toaster
render(<YourComponent />);

// Set initial route
render(<YourComponent />, { initialRoute: '/dashboard' });
```

### Reset Zustand Stores

```typescript
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  // Reset store to initial state
  useAuthStore.getState().logout();
});
```

## Coverage Targets

- **Overall**: 70%+ (enforced in CI)
- **Utils**: 90%+
- **Hooks**: 85%+
- **Stores**: 80%+
- **Components**: 60%+

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Common Matchers

### DOM Matchers (@testing-library/jest-dom)

```typescript
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveTextContent('Hello');
expect(element).toHaveClass('btn-primary');
expect(element).toHaveAttribute('href', '/home');
expect(input).toHaveValue('test@example.com');
```

### Standard Matchers (Vitest)

```typescript
expect(value).toBe(2);
expect(value).toEqual({ name: 'John' });
expect(array).toContain('item');
expect(array).toHaveLength(3);
expect(string).toMatch(/pattern/);
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledTimes(2);
expect(fn).toHaveBeenCalledWith('arg');
expect(promise).resolves.toBe('value');
expect(promise).rejects.toThrow('error');
```

## Common Issues

### Issue: "Cannot find module '@/lib/test-utils'"

**Solution**: Check `tsconfig.json` and `vitest.config.ts` path aliases match.

### Issue: "window.matchMedia is not a function"

**Solution**: Already mocked in `test-setup.ts`. If still failing, check import order.

### Issue: "Tests timeout after 10000ms"

**Solution**: Increase timeout in `vitest.config.ts` or specific test:
```typescript
it('slow test', async () => { ... }, 20000); // 20s timeout
```

### Issue: "localStorage is not defined"

**Solution**: Already mocked in `test-setup.ts`. Use `vi.mocked(localStorage.getItem)` to control behavior.

### Issue: "ResizeObserver is not defined"

**Solution**: Already mocked in `test-setup.ts` for chart components.

## Debugging Tests

### 1. Debug in VS Code

Add breakpoint and run:
```bash
npm run test:watch
```

### 2. Use Vitest UI

```bash
npm run test:ui
```

Opens browser with interactive test runner.

### 3. Debug Specific Test

```bash
npm test -- button.test.tsx
```

### 4. Print Debug Output

```typescript
import { screen } from '@testing-library/react';

// Print current DOM
screen.debug();

// Print specific element
screen.debug(screen.getByRole('button'));
```

### 5. Inspect Queries

```typescript
// See all available queries
screen.logTestingPlaygroundURL();
```

## CI/CD Integration

Tests run automatically in CI via:
```json
"check-all": "npm run type-check && npm run lint && npm run test"
```

Coverage thresholds enforced (70%):
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event API](https://testing-library.com/docs/user-event/intro)

## Accessibility Testing

### Running Accessibility Tests

```bash
# Run all accessibility tests
npm run test:e2e -- accessibility.spec

# Run in headed mode (see the browser)
npm run test:e2e:headed -- accessibility.spec

# Run on specific browser
npm run test:e2e:chromium -- accessibility.spec
```

### Axe-core Integration

We use `@axe-core/playwright` to automatically scan pages for WCAG 2.1 AA violations:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('Page should have no accessibility violations', async ({ page }) => {
  await page.goto('/login');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### WCAG Compliance Checklist

- **Level A (Critical)**:
  - Keyboard accessibility
  - Text alternatives for images
  - Proper heading hierarchy
  - Form labels

- **Level AA (Required)**:
  - Color contrast (4.5:1 for normal text, 3:1 for large text)
  - Focus indicators
  - Accessible error messages
  - ARIA landmarks

### Interpreting Violations

When a test fails, Axe provides detailed violation reports:

```typescript
// Example violation output:
{
  id: 'color-contrast',
  impact: 'serious',
  description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
  nodes: [
    {
      html: '<button class="btn-primary">Submit</button>',
      target: ['.btn-primary']
    }
  ]
}
```

**Impact Levels**:
- `critical`: Must fix immediately
- `serious`: Should fix before production
- `moderate`: Fix when possible
- `minor`: Nice to have

### Manual Testing Required

Automated tests catch ~57% of accessibility issues. Manual testing needed for:
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation flow
- Focus management in complex interactions
- Video/audio captions (if applicable)

## Mobile Responsive Testing

### Running Mobile Tests

```bash
# Run all mobile responsive tests
npm run test:e2e -- mobile-responsive.spec

# Test specific viewport
npm run test:e2e -- mobile-responsive.spec -g "iPhone SE"
npm run test:e2e -- mobile-responsive.spec -g "iPad"
npm run test:e2e -- mobile-responsive.spec -g "Desktop"
```

### Responsive Breakpoints

We test at these standard breakpoints:

| Device | Width | Height | Use Case |
|--------|-------|--------|----------|
| iPhone SE | 375px | 667px | Small mobile |
| iPad | 768px | 1024px | Tablet |
| Desktop | 1024px | 768px | Desktop |

### Device Emulation

```typescript
import { devices } from '@playwright/test';

test.use({ ...devices['iPhone SE'] });

test('Mobile layout test', async ({ page }) => {
  await page.goto('/dashboard');

  // Test mobile-specific UI
  const menuButton = page.getByRole('button', { name: /menu/i });
  await expect(menuButton).toBeVisible();
});
```

### Testing Touch Interactions

```typescript
test('Button should respond to tap', async ({ page }) => {
  const button = page.getByRole('button', { name: /submit/i });

  // Use tap() for mobile touch events
  await button.tap();

  await expect(page.getByText(/success/i)).toBeVisible();
});
```

### Common Responsive Issues

1. **Horizontal Scroll**: Cards/images too wide for viewport
2. **Tiny Touch Targets**: Buttons < 44x44px
3. **Hidden Content**: Desktop-only UI blocking mobile flow
4. **Overlapping Elements**: Fixed positioning issues
5. **Font Sizes**: Text too small to read on mobile

## Keyboard Navigation Testing

### Running Keyboard Tests

```bash
# Run all keyboard navigation tests
npm run test:e2e -- keyboard-navigation.spec

# Debug specific test
npm run test:e2e:debug -- keyboard-navigation.spec -g "Tab order"
```

### Keyboard Shortcuts Reference

| Key | Action | Use Case |
|-----|--------|----------|
| `Tab` | Move focus forward | Navigate between elements |
| `Shift+Tab` | Move focus backward | Navigate in reverse |
| `Enter` | Activate button/link | Submit forms, click buttons |
| `Space` | Activate button/checkbox | Flip cards, toggle |
| `Esc` | Close modal/dialog | Exit overlays |
| `Arrow Keys` | Navigate lists/grids | Move between cards |
| `1-5` | Rate flashcard | Quick review ratings |

### Testing Tab Order

```typescript
test('Tab order should be logical', async ({ page }) => {
  await page.goto('/login');

  await page.keyboard.press('Tab'); // Email
  let focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('INPUT');

  await page.keyboard.press('Tab'); // Password
  focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('INPUT');

  await page.keyboard.press('Tab'); // Submit
  focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('BUTTON');
});
```

### Focus Management Patterns

**Focus Trap in Modals**:
```typescript
test('Modal should trap focus', async ({ page }) => {
  await page.getByRole('button', { name: /delete/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Tab multiple times
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // Focus should stay inside dialog
  const isInsideDialog = await page.evaluate(() => {
    return document.activeElement?.closest('[role="dialog"]') !== null;
  });
  expect(isInsideDialog).toBe(true);
});
```

**Escape to Close**:
```typescript
test('Esc should close modal', async ({ page }) => {
  await page.getByRole('button', { name: /delete/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

### ARIA Best Practices

1. **Use Semantic HTML First**: `<button>` not `<div role="button">`
2. **Provide Accessible Names**: `aria-label`, `aria-labelledby`
3. **Manage ARIA States**: `aria-expanded`, `aria-checked`, `aria-selected`
4. **Live Regions**: `aria-live="polite"` for dynamic content
5. **Landmarks**: `<main>`, `<nav>`, `<aside>` for structure

## Examples

See test files for examples:
- `src/utils/__tests__/sample.test.ts` - Basic assertions
- `src/lib/__tests__/dateUtils.test.ts` - Utility function tests
- `src/components/ui/__tests__/button.test.tsx` - Component tests
- `tests/e2e/accessibility.spec.ts` - Accessibility tests
- `tests/e2e/mobile-responsive.spec.ts` - Mobile tests
- `tests/e2e/keyboard-navigation.spec.ts` - Keyboard tests

## E2E Test Fixes

This section documents resolved E2E test issues and their solutions to help with future debugging.

### Profile Heading Visibility (Dec 2024)

**Failed Test**: `auth.spec.ts:169 - should access protected routes when authenticated`

**Error**: `expect(locator).toBeVisible() failed` for `getByRole('heading', { name: /profile/i })`

**Root Cause**: The Profile page had `<h1>Profile</h1>` inside a `md:hidden` container, making it invisible on desktop viewports (1280x720). E2E tests run in desktop viewport and check for visible heading elements to verify page loads correctly.

**Files Affected**:
- `src/pages/Profile.tsx` (line 59-65)
- `tests/e2e/deck-browsing.spec.ts` (had workaround using testId)

**Solution**:
- Moved `md:hidden` from the container to the mobile menu button only
- Heading now always visible with responsive sizing (`text-2xl md:text-3xl`)
- Added `aria-label` to mobile menu button for accessibility
- Removed testId workaround from `deck-browsing.spec.ts`

**Lesson Learned**: Page headings should always be visible regardless of viewport for both accessibility (WCAG) and E2E testing reliability. Mobile-only UI controls can be hidden, but main content structure should remain visible.

**Commit**: `f7e9845` - `fix(e2e): Make Profile heading always visible for desktop viewport`

---

## Next Steps

1. Write tests for existing utilities in `src/lib/` and `src/utils/`
2. Add component tests for UI components in `src/components/`
3. Test Zustand stores in `src/stores/`
4. Add E2E tests with Playwright (Task 10.02)
5. Integrate with CI/CD pipeline
