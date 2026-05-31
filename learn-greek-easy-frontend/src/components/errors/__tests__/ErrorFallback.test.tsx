import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorFallback } from '../ErrorFallback';

// Mock sentry-queue to control isSentryLoaded behavior
const mockIsSentryLoaded = vi.fn().mockReturnValue(false);
const mockGetSentry = vi.fn().mockReturnValue(null);

vi.mock('@/lib/sentry-queue', () => ({
  isSentryLoaded: () => mockIsSentryLoaded(),
  getSentry: () => mockGetSentry(),
}));

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSentryLoaded.mockReturnValue(false);
    mockGetSentry.mockReturnValue(null);
  });

  describe('always-visible elements', () => {
    it('renders the Try Again button', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('renders the Go Home button', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('calls onReset when Try Again is clicked', async () => {
      const onReset = vi.fn();
      render(<ErrorFallback error={null} onReset={onReset} />);
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onReset).toHaveBeenCalledOnce();
    });
  });

  describe('development mode — error details panel', () => {
    it('shows error message in dev mode (import.meta.env.DEV is true in tests)', () => {
      // In vitest, import.meta.env.DEV is true by default — the error details panel renders
      const error = new Error('Something exploded');
      const { container } = render(<ErrorFallback error={error} />);
      // Look for the "Error:" label inside the Alert description
      const errorLabel = container.querySelector('strong');
      expect(errorLabel).not.toBeNull();
      expect(errorLabel?.textContent).toBe('Error:');
    });

    it('shows error message text inside the details panel', () => {
      const error = new Error('CustomErrorText12345');
      const { container } = render(<ErrorFallback error={error} />);
      const alertDescription = container.querySelector('.font-mono');
      expect(alertDescription?.textContent).toContain('CustomErrorText12345');
    });

    it('shows stack trace label when error has a stack', () => {
      const error = new Error('Oops');
      error.stack = 'Error: Oops\n    at SomeComponent (SomeComponent.tsx:42)';
      const { container } = render(<ErrorFallback error={error} />);
      const strongs = container.querySelectorAll('strong');
      const stackLabel = Array.from(strongs).find((el) => el.textContent === 'Stack:');
      expect(stackLabel).toBeTruthy();
    });

    it('does not render error details when error is null', () => {
      const { container } = render(<ErrorFallback error={null} />);
      // No font-mono alert description rendered when error is null
      expect(container.querySelector('.font-mono')).toBeNull();
    });
  });

  describe('production mode — report issue button', () => {
    it('does not show report button when import.meta.env.PROD is false (test env)', () => {
      // In vitest, PROD is false — the report button should be hidden
      mockIsSentryLoaded.mockReturnValue(true);
      render(<ErrorFallback error={new Error('x')} eventId="evt-123" />);
      expect(screen.queryByRole('button', { name: /report issue/i })).toBeNull();
    });

    it('does not show report button when eventId is absent', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.queryByRole('button', { name: /report issue/i })).toBeNull();
    });
  });
});
