import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

import { ProgressIndicator } from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  describe('Rendering', () => {
    it('renders "{label} {current} of {total}" text', () => {
      renderWithProviders(<ProgressIndicator label="Question" current={3} total={10} />);
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Question 3 of 10');
    });

    it('renders with different label values', () => {
      renderWithProviders(<ProgressIndicator label="Card" current={1} total={5} />);
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Card 1 of 5');
    });

    it('has data-testid="progress-indicator"', () => {
      renderWithProviders(<ProgressIndicator label="Item" current={1} total={1} />);
      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    });

    it('handles current = 0', () => {
      renderWithProviders(<ProgressIndicator label="Question" current={0} total={10} />);
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Question 0 of 10');
    });

    it('applies custom className', () => {
      renderWithProviders(
        <ProgressIndicator label="Q" current={1} total={5} className="custom-progress" />
      );
      expect(screen.getByTestId('progress-indicator')).toHaveClass('custom-progress');
    });
  });
});
