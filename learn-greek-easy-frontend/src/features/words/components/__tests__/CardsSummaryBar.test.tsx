import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CardsSummaryBar } from '../CardsSummaryBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

// Mock Progress component
vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress-bar" data-value={value} className={className} role="progressbar" />
  ),
}));

describe('CardsSummaryBar', () => {
  it('renders with correct data-testid', () => {
    render(<CardsSummaryBar mastered={2} total={5} />);
    expect(screen.getByTestId('cards-summary-bar')).toBeInTheDocument();
  });

  it('renders mastery summary text with correct values', () => {
    render(<CardsSummaryBar mastered={3} total={7} />);
    const text = screen.getByText(/cardsMasterySummary/);
    expect(text).toBeInTheDocument();
    expect(text.textContent).toContain('"mastered":3');
    expect(text.textContent).toContain('"total":7');
  });

  it('renders progress bar', () => {
    render(<CardsSummaryBar mastered={2} total={4} />);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('passes correct progress value to Progress bar', () => {
    render(<CardsSummaryBar mastered={1} total={4} />);
    const bar = screen.getByTestId('progress-bar');
    expect(Number(bar.getAttribute('data-value'))).toBeCloseTo(25);
  });

  it('handles zero total safely (no division by zero)', () => {
    render(<CardsSummaryBar mastered={0} total={0} />);
    const bar = screen.getByTestId('progress-bar');
    expect(Number(bar.getAttribute('data-value'))).toBe(0);
  });
});
