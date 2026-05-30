// src/features/practice/pf/__tests__/Toast.test.tsx
//
// Tests for Toast.tsx (PRACT2-1-07):
//   - Renders the real interval text (never hardcoded placeholder)
//   - formatReviewInterval covers all ranges
//   - Auto-dismisses after autoDismissMs
//   - onDismiss callback fires

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Toast, formatReviewInterval } from '../Toast';

// ── formatReviewInterval ──────────────────────────────────────────────────────

describe('formatReviewInterval', () => {
  it('0 days → "today"', () => expect(formatReviewInterval(0)).toBe('today'));
  it('1 day → "1 day"', () => expect(formatReviewInterval(1)).toBe('1 day'));
  it('3 days → "3 days"', () => expect(formatReviewInterval(3)).toBe('3 days'));
  it('6 days → "6 days"', () => expect(formatReviewInterval(6)).toBe('6 days'));
  it('7 days → "1 week"', () => expect(formatReviewInterval(7)).toBe('1 week'));
  it('14 days → "2 weeks"', () => expect(formatReviewInterval(14)).toBe('2 weeks'));
  it('21 days → "3 weeks"', () => expect(formatReviewInterval(21)).toBe('3 weeks'));
  it('30 days → "1 month"', () => expect(formatReviewInterval(30)).toBe('1 month'));
  it('60 days → "2 months"', () => expect(formatReviewInterval(60)).toBe('2 months'));
  it('365 days → "1 year"', () => expect(formatReviewInterval(365)).toBe('1 year'));
  it('730 days → "2 years"', () => expect(formatReviewInterval(730)).toBe('2 years'));
  it('negative → "today"', () => expect(formatReviewInterval(-1)).toBe('today'));
});

// ── Toast component ───────────────────────────────────────────────────────────

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with real interval text (never hardcoded)', () => {
    render(<Toast interval={3} />);
    expect(screen.getByTestId('pf-toast-interval')).toHaveTextContent('3 days');
  });

  it('renders interval=1 as "1 day"', () => {
    render(<Toast interval={1} />);
    expect(screen.getByTestId('pf-toast-interval')).toHaveTextContent('1 day');
  });

  it('renders interval=30 as "1 month"', () => {
    render(<Toast interval={30} />);
    expect(screen.getByTestId('pf-toast-interval')).toHaveTextContent('1 month');
  });

  it('renders interval=0 as "today"', () => {
    render(<Toast interval={0} />);
    expect(screen.getByTestId('pf-toast-interval')).toHaveTextContent('today');
  });

  it('auto-dismisses after autoDismissMs', () => {
    render(<Toast interval={3} autoDismissMs={1000} />);
    expect(screen.getByTestId('pf-toast')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('pf-toast')).toBeNull();
  });

  it('calls onDismiss when auto-dismissed', () => {
    const onDismiss = vi.fn();
    render(<Toast interval={1} autoDismissMs={500} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('is still visible before auto-dismiss timeout', () => {
    render(<Toast interval={5} autoDismissMs={3000} />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId('pf-toast')).toBeInTheDocument();
  });
});
