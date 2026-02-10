import { describe, expect, it } from 'vitest';

import { ProgressBar } from '../ProgressBar';
import { render, screen } from '@/lib/test-utils';

describe('ProgressBar', () => {
  describe('Rendering', () => {
    it('renders the counter text with current and total', () => {
      render(<ProgressBar current={3} total={10} />);

      const counter = screen.getByTestId('progress-bar-counter');
      expect(counter).toHaveTextContent('3 / 10');
    });

    it('renders the progress bar with correct ARIA attributes', () => {
      render(<ProgressBar current={5} total={20} />);

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '5');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '20');
      expect(bar).toHaveAttribute('aria-label', 'Session progress');
    });

    it('renders the fill indicator with correct width', () => {
      render(<ProgressBar current={5} total={10} />);

      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '50%' });
    });

    it('renders with monospace font class on counter', () => {
      render(<ProgressBar current={1} total={5} />);

      const counter = screen.getByTestId('progress-bar-counter');
      expect(counter.className).toContain('font-cult-mono');
    });

    it('renders the 3px height bar', () => {
      render(<ProgressBar current={1} total={5} />);

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveStyle({ height: '3px' });
    });

    it('applies custom className', () => {
      render(<ProgressBar current={1} total={5} className="mb-6" />);

      const container = screen.getByTestId('progress-bar');
      expect(container.className).toContain('mb-6');
    });
  });

  describe('Progress calculation', () => {
    it('shows 0% fill when current is 0', () => {
      render(<ProgressBar current={0} total={10} />);

      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
    });

    it('shows 100% fill when current equals total', () => {
      render(<ProgressBar current={10} total={10} />);

      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });

    it('handles total of 0 without division by zero', () => {
      render(<ProgressBar current={0} total={0} />);

      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
      expect(screen.getByTestId('progress-bar-counter')).toHaveTextContent('0 / 0');
    });

    it('clamps percentage to 100 when current exceeds total', () => {
      render(<ProgressBar current={15} total={10} />);

      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });
  });

  describe('Accessibility', () => {
    it('has a progressbar role', () => {
      render(<ProgressBar current={3} total={10} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('has an accessible label', () => {
      render(<ProgressBar current={3} total={10} />);

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Session progress');
    });
  });
});
