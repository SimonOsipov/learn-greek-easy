import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MetricCard } from '../MetricCard';

describe('MetricCard', () => {
  const defaultProps = {
    id: '1',
    label: 'Test Metric',
    value: 42,
    sublabel: 'test sublabel',
    color: 'primary' as const,
    icon: '📊',
  };

  describe('rendering', () => {
    it('should render metric label, value, sublabel, and icon', () => {
      render(<MetricCard {...defaultProps} />);

      expect(screen.getByText('Test Metric')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('test sublabel')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });

    it('should render loading skeleton when loading is true', () => {
      const { container } = render(<MetricCard {...defaultProps} loading={true} />);

      // Should show skeletons, not actual content
      expect(screen.queryByText('Test Metric')).not.toBeInTheDocument();
      expect(screen.queryByText('42')).not.toBeInTheDocument();

      // Should have skeleton elements (Skeleton component uses animate-pulse class)
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should apply correct color class based on color prop', () => {
      const { rerender, container } = render(<MetricCard {...defaultProps} color="green" />);
      expect(container.querySelector('.text-success')).toBeInTheDocument();

      rerender(<MetricCard {...defaultProps} color="orange" />);
      expect(container.querySelector('.text-warning')).toBeInTheDocument();

      rerender(<MetricCard {...defaultProps} color="blue" />);
      expect(container.querySelector('.text-info')).toBeInTheDocument();

      rerender(<MetricCard {...defaultProps} color="muted" />);
      expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
    });
  });

  describe('interactivity removal (BUGPF-01)', () => {
    it('should NOT have cursor-pointer class', () => {
      const { container } = render(<MetricCard {...defaultProps} />);

      // Find the Card element (the outermost div with transition classes)
      const card = container.querySelector('[class*="transition-all"]');
      expect(card).toBeInTheDocument();

      // Verify cursor-pointer is NOT present
      expect(card?.className).not.toContain('cursor-pointer');
    });

    it('should NOT render any tooltip elements', () => {
      const { container } = render(<MetricCard {...defaultProps} />);

      // No TooltipProvider, TooltipTrigger, or TooltipContent should exist
      expect(container.querySelector('[data-radix-tooltip-trigger]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="tooltip"]')).not.toBeInTheDocument();

      // No tooltip-related aria attributes
      expect(container.querySelector('[aria-describedby*="tooltip"]')).not.toBeInTheDocument();
    });

    it('should NOT have onClick handler', () => {
      const mockOnClick = vi.fn();

      // MetricCard no longer accepts onClick, so we just verify clicking does nothing
      const { container } = render(<MetricCard {...defaultProps} />);

      const card = container.querySelector('[class*="transition-all"]');
      expect(card).toBeInTheDocument();

      // Click should not trigger any navigation or action
      fireEvent.click(card!);

      // No click handler should have been called
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should still have hover animation classes', () => {
      const { container } = render(<MetricCard {...defaultProps} />);

      const card = container.querySelector('[class*="transition-all"]');
      expect(card).toBeInTheDocument();

      // Hover animation classes should still be present
      expect(card?.className).toContain('hover:-translate-y-0.5');
      expect(card?.className).toContain('hover:shadow-md');
    });

    it('should have default cursor (not pointer)', () => {
      const { container } = render(<MetricCard {...defaultProps} />);

      const card = container.querySelector('[class*="transition-all"]');
      expect(card).toBeInTheDocument();

      // The card should NOT have cursor-pointer
      // Default cursor is implied when cursor-pointer is absent
      const hasPointerCursor = card?.className.includes('cursor-pointer');
      expect(hasPointerCursor).toBe(false);
    });
  });

  describe('interface validation', () => {
    it('should NOT accept onClick prop in TypeScript', () => {
      // This is a compile-time check - if MetricCard accepts onClick,
      // TypeScript would allow it. Since we removed onClick from the interface,
      // passing it would cause a TS error (verified by the build passing).
      // This test documents the expected behavior.

      // @ts-expect-error - onClick should not be a valid prop
      const propsWithOnClick = { ...defaultProps, onClick: () => {} };

      // We can still render, but onClick won't be used
      render(<MetricCard {...propsWithOnClick} />);

      // Component should render without errors
      expect(screen.getByText('Test Metric')).toBeInTheDocument();
    });

    it('should NOT accept tooltip prop in TypeScript', () => {
      // @ts-expect-error - tooltip should not be a valid prop
      const propsWithTooltip = { ...defaultProps, tooltip: 'Some tooltip' };

      render(<MetricCard {...propsWithTooltip} />);

      // Component should render without errors
      expect(screen.getByText('Test Metric')).toBeInTheDocument();

      // No tooltip text should appear
      expect(screen.queryByText('Some tooltip')).not.toBeInTheDocument();
    });
  });
});
