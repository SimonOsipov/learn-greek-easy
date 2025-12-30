import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '../PageLoader';

describe('PageLoader', () => {
  describe('default variant', () => {
    it('should render with default loading text', () => {
      render(<PageLoader />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render with custom loading text', () => {
      render(<PageLoader text="Please wait..." />);

      expect(screen.getByText('Please wait...')).toBeInTheDocument();
    });

    it('should have aria-busy attribute', () => {
      render(<PageLoader />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('should have aria-label matching the text', () => {
      render(<PageLoader text="Custom loading" />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('should apply full height classes for default variant', () => {
      render(<PageLoader />);

      const container = screen.getByRole('status');
      expect(container).toHaveClass('min-h-screen');
    });
  });

  describe('minimal variant', () => {
    it('should render minimal spinner without text visible', () => {
      render(<PageLoader variant="minimal" />);

      const container = screen.getByRole('status');
      expect(container).toBeInTheDocument();
      // Text should be in aria-label but not visible
      expect(container).toHaveAttribute('aria-label', 'Loading...');
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should have smaller container classes', () => {
      render(<PageLoader variant="minimal" />);

      const container = screen.getByRole('status');
      expect(container).toHaveClass('p-8');
      expect(container).not.toHaveClass('min-h-screen');
    });

    it('should be accessible with custom text', () => {
      render(<PageLoader variant="minimal" text="Fetching data" />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching data');
    });
  });

  describe('skeleton variant', () => {
    it('should render skeleton UI elements', () => {
      render(<PageLoader variant="skeleton" />);

      const container = screen.getByRole('status');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('aria-busy', 'true');
    });

    it('should have skeleton-specific classes', () => {
      render(<PageLoader variant="skeleton" />);

      const container = screen.getByRole('status');
      expect(container).toHaveClass('min-h-screen');
      expect(container).toHaveClass('p-6');
    });

    it('should render multiple skeleton cards', () => {
      const { container } = render(<PageLoader variant="skeleton" />);

      // Should have 3 card skeletons (based on implementation)
      const cards = container.querySelectorAll('.rounded-lg.border');
      expect(cards.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it.each(['default', 'minimal', 'skeleton'] as const)(
      'should have proper accessibility for %s variant',
      (variant) => {
        render(<PageLoader variant={variant} />);

        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status).toHaveAttribute('aria-busy', 'true');
        expect(status).toHaveAttribute('aria-label');
      }
    );
  });
});
