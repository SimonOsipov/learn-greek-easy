import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

import { PracticeHeader } from '../PracticeHeader';

describe('PracticeHeader', () => {
  const defaultProps = {
    onExit: vi.fn(),
  };

  describe('Rendering', () => {
    it('renders exit button with default label "Exit"', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} />);
      expect(screen.getByRole('button', { name: /exit/i })).toBeInTheDocument();
    });

    it('renders exit button with custom exitLabel', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} exitLabel="Go Back" />);
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });

    it('renders rightSlot content', () => {
      renderWithProviders(
        <PracticeHeader {...defaultProps} rightSlot={<span>Right Content</span>} />
      );
      expect(screen.getByText('Right Content')).toBeInTheDocument();
    });

    it('renders correctly with no rightSlot', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} />);
      expect(screen.getByTestId('practice-header')).toBeInTheDocument();
    });

    it('applies custom className to root element', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('practice-header')).toHaveClass('custom-class');
    });
  });

  describe('Interactions', () => {
    it('calls onExit when exit button is clicked', async () => {
      const user = userEvent.setup();
      const onExit = vi.fn();
      renderWithProviders(<PracticeHeader onExit={onExit} />);
      await user.click(screen.getByRole('button', { name: /exit/i }));
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('data-testid attributes', () => {
    it('has data-testid="practice-header" on root', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} />);
      expect(screen.getByTestId('practice-header')).toBeInTheDocument();
    });

    it('has data-testid="practice-exit-button" on exit button', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} />);
      expect(screen.getByTestId('practice-exit-button')).toBeInTheDocument();
    });

    it('has data-exit-testid attribute with alias testids on exit button', () => {
      renderWithProviders(<PracticeHeader {...defaultProps} />);
      const exitButton = screen.getByTestId('practice-exit-button');
      expect(exitButton).toHaveAttribute('data-exit-testid', 'exit-button practice-close-button');
    });
  });
});
