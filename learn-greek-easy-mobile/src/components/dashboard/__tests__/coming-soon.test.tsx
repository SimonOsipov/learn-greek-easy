/// <reference types="jest" />
/**
 * DASH-04 — RNTL component tests for the coming-soon affordance.
 *
 * Tests:
 *   1. ComingSoonDot — renders; className does NOT contain a /NN opacity modifier
 *      on the `danger` token (MOB-13 guard).
 *   2. Kicker with `comingSoon` — dot and "Coming soon" label are present.
 *   3. Kicker without `comingSoon` — neither dot nor label is present.
 *   4. ToastProvider + showComingSoonToast — toast message appears and
 *      auto-dismisses after the timer fires (fake timers).
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock: nativewind (via manual __mocks__/nativewind.js) — no-op cssInterop.
// ---------------------------------------------------------------------------
jest.mock('nativewind');

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks.
// ---------------------------------------------------------------------------
import { ComingSoonDot } from '@/components/dashboard/coming-soon-dot';
import { Kicker } from '@/components/dashboard/kicker';
import { ToastProvider, useToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// 1. ComingSoonDot
// ---------------------------------------------------------------------------
describe('ComingSoonDot', () => {
  it('renders without throwing', () => {
    // accessibilityElementsHidden hides the dot from the accessibility tree,
    // so we use UNSAFE_getByProps to reach it in tests.
    const { UNSAFE_getByProps } = render(<ComingSoonDot />);
    expect(UNSAFE_getByProps({ testID: 'coming-soon-dot' })).toBeTruthy();
  });

  it('className contains bg-danger without a /NN opacity modifier (MOB-13)', () => {
    const { UNSAFE_getByProps } = render(<ComingSoonDot />);
    const el = UNSAFE_getByProps({ testID: 'coming-soon-dot' });
    const cn: string = el.props.className ?? '';
    // Must contain bg-danger (solid token)
    expect(cn).toContain('bg-danger');
    // Must NOT contain bg-danger/<digits> (opacity modifier)
    expect(cn).not.toMatch(/bg-danger\/\d/);
  });
});

// ---------------------------------------------------------------------------
// 2 & 3. Kicker
// ---------------------------------------------------------------------------
describe('Kicker', () => {
  it('renders the eyebrow label text', () => {
    render(<Kicker>VOCABULARY</Kicker>);
    expect(screen.getByTestId('kicker-label')).toBeTruthy();
  });

  it('with comingSoon — shows the ComingSoonDot', () => {
    const { UNSAFE_getByProps } = render(<Kicker comingSoon>MOCK EXAM</Kicker>);
    expect(UNSAFE_getByProps({ testID: 'coming-soon-dot' })).toBeTruthy();
  });

  it('with comingSoon — shows "Coming soon" micro-label', () => {
    render(<Kicker comingSoon>MOCK EXAM</Kicker>);
    expect(screen.getByTestId('kicker-coming-soon-label')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('without comingSoon — NO dot rendered', () => {
    const { UNSAFE_queryByProps } = render(<Kicker>VOCABULARY</Kicker>);
    expect(UNSAFE_queryByProps({ testID: 'coming-soon-dot' })).toBeNull();
  });

  it('without comingSoon — NO "Coming soon" label rendered', () => {
    render(<Kicker>VOCABULARY</Kicker>);
    expect(screen.queryByTestId('kicker-coming-soon-label')).toBeNull();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. ToastProvider + showComingSoonToast
// ---------------------------------------------------------------------------

/**
 * Helper component: calls showComingSoonToast() on mount via a button.
 */
function ToastTrigger() {
  const { showComingSoonToast } = useToast();
  return (
    <React.Fragment>
      {/* Rendered so tests can fire it */}
      <button
        // @ts-expect-error — using plain button for testability; RN Pressable works the same
        testID="trigger"
        onClick={showComingSoonToast}
      />
    </React.Fragment>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('showComingSoonToast surfaces the toast message', async () => {
    const { getByTestId } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    // Fire the toast imperatively via act
    const { useToast: useToastDirect } = require('@/components/ui/toast');
    // Trigger via the context directly — render a consumer that fires on mount
    const Consumer = () => {
      const { showComingSoonToast } = useToastDirect();
      React.useEffect(() => {
        showComingSoonToast();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    };

    const { getByTestId: getById } = render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    // After state update the overlay should be visible
    await act(async () => {});
    expect(getById('toast-message')).toBeTruthy();
    expect(getById('toast-message').props.children).toContain('Coming soon');
  });

  it('toast auto-dismisses after timeout', async () => {
    const Consumer = () => {
      const { showComingSoonToast } = useToast();
      React.useEffect(() => {
        showComingSoonToast();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    };

    const { queryByTestId } = render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    // Toast appears immediately after the effect
    await act(async () => {});
    expect(queryByTestId('toast-overlay')).toBeTruthy();

    // Advance past the dismiss delay + fade duration
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(queryByTestId('toast-overlay')).toBeNull();
  });

  it('useToast throws when used outside ToastProvider', () => {
    // Suppress expected error output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const BadConsumer = () => {
      useToast();
      return null;
    };
    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
    spy.mockRestore();
  });
});
