/**
 * ChangelogPagination Component Tests
 *
 * Tests for the ChangelogPagination component including:
 * - Basic rendering: container, showing text, page buttons
 * - Page aria-labels use translated format ("Page N")
 * - Previous/Next buttons have translated aria-labels
 * - Click handlers call onPageChange correctly
 * - Loading state disables buttons
 * - Disabled state on first/last page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

import { ChangelogPagination, ChangelogPaginationProps } from '../ChangelogPagination';
import { render, screen } from '@/lib/test-utils';

// Default props factory
const createProps = (
  overrides: Partial<ChangelogPaginationProps> = {}
): ChangelogPaginationProps => ({
  currentPage: 1,
  totalPages: 5,
  totalItems: 25,
  itemsPerPage: 5,
  onPageChange: vi.fn(),
  isLoading: false,
  ...overrides,
});

describe('ChangelogPagination', () => {
  let onPageChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPageChange = vi.fn();
  });

  describe('Rendering', () => {
    it('should render the pagination container with correct testid', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination')).toBeInTheDocument();
    });

    it('should render showing text with correct range on first page', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination-showing')).toHaveTextContent('1-5');
      expect(screen.getByTestId('changelog-pagination-showing')).toHaveTextContent('25');
    });

    it('should render showing text correctly on middle page', () => {
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 2, totalPages: 5, totalItems: 25, onPageChange })}
        />
      );
      expect(screen.getByTestId('changelog-pagination-showing')).toHaveTextContent('6-10');
    });

    it('should render page number buttons when totalPages <= 7', () => {
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 1, totalPages: 3, totalItems: 15, onPageChange })}
        />
      );
      expect(screen.getByTestId('changelog-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-pagination-page-2')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-pagination-page-3')).toBeInTheDocument();
    });

    it('should not render when totalItems is 0', () => {
      render(
        <ChangelogPagination {...createProps({ totalItems: 0, totalPages: 0, onPageChange })} />
      );
      expect(screen.queryByTestId('changelog-pagination')).not.toBeInTheDocument();
    });

    it('should render Previous and Next buttons (desktop)', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination-prev')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-pagination-next')).toBeInTheDocument();
    });

    it('should render mobile Previous and Next buttons', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination-prev-mobile')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-pagination-next-mobile')).toBeInTheDocument();
    });
  });

  describe('Accessibility - Aria Labels', () => {
    it('should have translated aria-label on Previous button', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination-prev')).toHaveAttribute(
        'aria-label',
        'Previous'
      );
    });

    it('should have translated aria-label on Next button', () => {
      render(<ChangelogPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('changelog-pagination-next')).toHaveAttribute('aria-label', 'Next');
    });

    it('should have aria-label in format "Page N" on page number buttons', () => {
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 1, totalPages: 3, totalItems: 15, onPageChange })}
        />
      );
      expect(screen.getByTestId('changelog-pagination-page-2')).toHaveAttribute(
        'aria-label',
        'Page 2'
      );
    });

    it('should mark current page with aria-current="page"', () => {
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 2, totalPages: 5, totalItems: 25, onPageChange })}
        />
      );
      expect(screen.getByTestId('changelog-pagination-page-2')).toHaveAttribute(
        'aria-current',
        'page'
      );
    });
  });

  describe('Button Disabled States', () => {
    it('should disable Previous button on first page', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 1, totalPages: 5, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-prev')).toBeDisabled();
    });

    it('should enable Previous button when not on first page', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 3, totalPages: 5, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-prev')).not.toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 5, totalPages: 5, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-next')).toBeDisabled();
    });

    it('should enable Next button when not on last page', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 1, totalPages: 5, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-next')).not.toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should disable Previous button when loading', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 3, isLoading: true, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-prev')).toBeDisabled();
    });

    it('should disable Next button when loading', () => {
      render(
        <ChangelogPagination {...createProps({ currentPage: 3, isLoading: true, onPageChange })} />
      );
      expect(screen.getByTestId('changelog-pagination-next')).toBeDisabled();
    });

    it('should disable page number buttons when loading', () => {
      render(
        <ChangelogPagination
          {...createProps({
            currentPage: 1,
            totalPages: 3,
            totalItems: 15,
            isLoading: true,
            onPageChange,
          })}
        />
      );
      expect(screen.getByTestId('changelog-pagination-page-2')).toBeDisabled();
    });
  });

  describe('Click Handlers', () => {
    it('should call onPageChange with previous page when Previous is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChangelogPagination {...createProps({ currentPage: 3, totalPages: 5, onPageChange })} />
      );
      await user.click(screen.getByTestId('changelog-pagination-prev'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange with next page when Next is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChangelogPagination {...createProps({ currentPage: 3, totalPages: 5, onPageChange })} />
      );
      await user.click(screen.getByTestId('changelog-pagination-next'));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('should call onPageChange with page number when page button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 1, totalPages: 3, totalItems: 15, onPageChange })}
        />
      );
      await user.click(screen.getByTestId('changelog-pagination-page-3'));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('should not call onPageChange when clicking current page', async () => {
      const user = userEvent.setup();
      render(
        <ChangelogPagination
          {...createProps({ currentPage: 2, totalPages: 3, totalItems: 15, onPageChange })}
        />
      );
      // Current page button has pointer-events-none
      await user.click(screen.getByTestId('changelog-pagination-page-2'));
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});
