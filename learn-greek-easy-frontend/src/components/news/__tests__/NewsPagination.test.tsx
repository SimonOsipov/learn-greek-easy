/**
 * NewsPagination Component Tests
 *
 * Tests for the reusable pagination component including:
 * - Page number generation algorithm with ellipsis logic
 * - Previous/Next button disabled states
 * - "Showing X-Y of Z" text display
 * - Mobile responsive behavior
 * - Loading state interactions
 * - Accessibility attributes
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NewsPagination, NewsPaginationProps } from '@/components/news/NewsPagination';
import { render, screen, within } from '@/lib/test-utils';

// Default props factory
const createProps = (overrides: Partial<NewsPaginationProps> = {}): NewsPaginationProps => ({
  currentPage: 1,
  totalPages: 10,
  totalItems: 100,
  itemsPerPage: 10,
  onPageChange: vi.fn(),
  isLoading: false,
  ...overrides,
});

describe('NewsPagination Component', () => {
  let onPageChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPageChange = vi.fn();
  });

  describe('Rendering', () => {
    it('should render with test-id for container', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
    });

    it('should render "Showing X-Y of Z" text correctly for first page', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
        'Showing 1-10 of 100 articles'
      );
    });

    it('should render "Showing X-Y of Z" text correctly for middle page', () => {
      render(<NewsPagination {...createProps({ currentPage: 5, onPageChange })} />);
      expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
        'Showing 41-50 of 100 articles'
      );
    });

    it('should render "Showing X-Y of Z" text correctly for last page with partial results', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 3,
            totalPages: 3,
            totalItems: 25,
            onPageChange,
          })}
        />
      );
      expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
        'Showing 21-25 of 25 articles'
      );
    });

    it('should not render when totalItems is 0', () => {
      render(
        <NewsPagination
          {...createProps({
            totalItems: 0,
            totalPages: 0,
            onPageChange,
          })}
        />
      );
      expect(screen.queryByTestId('news-pagination')).not.toBeInTheDocument();
    });

    it('should display Previous and Next buttons', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('news-pagination-prev')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-next')).toBeInTheDocument();
    });
  });

  describe('Page Number Generation (Desktop View)', () => {
    it('should show all page numbers when totalPages <= 7', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 3,
            totalPages: 5,
            totalItems: 50,
            onPageChange,
          })}
        />
      );

      // Check for page numbers 1-5
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`news-pagination-page-${i}`)).toBeInTheDocument();
      }
    });

    it('should show ellipsis near end when currentPage <= 3', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 2,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      // Near start pattern: 1, 2, 3, 4, 5, ..., 10
      expect(screen.getByTestId('news-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-2')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-3')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-4')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-5')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-10')).toBeInTheDocument();
      // Should not have middle pages
      expect(screen.queryByTestId('news-pagination-page-6')).not.toBeInTheDocument();
    });

    it('should show ellipsis near start when currentPage >= totalPages - 2', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 9,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      // Near end pattern: 1, ..., 6, 7, 8, 9, 10
      expect(screen.getByTestId('news-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-6')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-7')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-8')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-9')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-10')).toBeInTheDocument();
      // Should not have early middle pages
      expect(screen.queryByTestId('news-pagination-page-2')).not.toBeInTheDocument();
    });

    it('should show ellipsis on both sides when currentPage is in middle', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      // Middle pattern: 1, ..., 4, 5, 6, ..., 10
      expect(screen.getByTestId('news-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-4')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-5')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-6')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-10')).toBeInTheDocument();
      // Should not have pages 2, 3, 7, 8, 9
      expect(screen.queryByTestId('news-pagination-page-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('news-pagination-page-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('news-pagination-page-7')).not.toBeInTheDocument();
    });

    it('should highlight current page with default variant', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      const currentPageButton = screen.getByTestId('news-pagination-page-5');
      expect(currentPageButton).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Button Disabled States', () => {
    it('should disable Previous button on first page', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-prev')).toBeDisabled();
    });

    it('should enable Previous button when not on first page', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-prev')).not.toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 10,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-next')).toBeDisabled();
    });

    it('should enable Next button when not on last page', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-next')).not.toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should disable Previous button when loading', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            isLoading: true,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-prev')).toBeDisabled();
    });

    it('should disable Next button when loading', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            isLoading: true,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-next')).toBeDisabled();
    });

    it('should disable page number buttons when loading', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 5,
            totalItems: 50,
            isLoading: true,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-page-2')).toBeDisabled();
      expect(screen.getByTestId('news-pagination-page-3')).toBeDisabled();
    });

    it('should not call onPageChange when clicking Previous while loading', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            isLoading: true,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-prev'));
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('Click Handlers', () => {
    it('should call onPageChange with previous page when Previous is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-prev'));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('should call onPageChange with next page when Next is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-next'));
      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it('should call onPageChange with page number when page button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 5,
            totalItems: 50,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-page-3'));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('should not call onPageChange when clicking current page', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 3,
            totalPages: 5,
            totalItems: 50,
            onPageChange,
          })}
        />
      );

      // The current page button has pointer-events-none
      await user.click(screen.getByTestId('news-pagination-page-3'));
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('Mobile View', () => {
    it('should render mobile pagination buttons', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);

      expect(screen.getByTestId('news-pagination-prev-mobile')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-next-mobile')).toBeInTheDocument();
    });

    it('should display "Page X of Y" text on mobile', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 3,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      // Mobile view shows "Page X of Y" text
      expect(screen.getByText('Page 3 of 10')).toBeInTheDocument();
    });

    it('should call onPageChange when clicking mobile Previous button', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-prev-mobile'));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('should call onPageChange when clicking mobile Next button', async () => {
      const user = userEvent.setup();
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            onPageChange,
          })}
        />
      );

      await user.click(screen.getByTestId('news-pagination-next-mobile'));
      expect(onPageChange).toHaveBeenCalledWith(6);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on Previous button', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('news-pagination-prev')).toHaveAttribute('aria-label', 'Previous');
    });

    it('should have aria-label on Next button', () => {
      render(<NewsPagination {...createProps({ onPageChange })} />);
      expect(screen.getByTestId('news-pagination-next')).toHaveAttribute('aria-label', 'Next');
    });

    it('should have aria-label on page number buttons', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 5,
            totalItems: 50,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-page-3')).toHaveAttribute('aria-label', 'Page 3');
    });

    it('should mark ellipsis as aria-hidden', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 5,
            totalPages: 10,
            onPageChange,
          })}
        />
      );

      // Find the desktop pagination container and look for ellipsis
      const container = screen.getByTestId('news-pagination');
      const ellipsisElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(ellipsisElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single page correctly', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 1,
            totalItems: 5,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
        'Showing 1-5 of 5 articles'
      );
      expect(screen.getByTestId('news-pagination-prev')).toBeDisabled();
      expect(screen.getByTestId('news-pagination-next')).toBeDisabled();
    });

    it('should handle two pages correctly', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 1,
            totalPages: 2,
            totalItems: 15,
            onPageChange,
          })}
        />
      );

      expect(screen.getByTestId('news-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-2')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-prev')).toBeDisabled();
      expect(screen.getByTestId('news-pagination-next')).not.toBeDisabled();
    });

    it('should handle exactly 7 pages without ellipsis', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 4,
            totalPages: 7,
            totalItems: 70,
            onPageChange,
          })}
        />
      );

      // All 7 page numbers should be visible
      for (let i = 1; i <= 7; i++) {
        expect(screen.getByTestId(`news-pagination-page-${i}`)).toBeInTheDocument();
      }
    });

    it('should handle 8 pages with ellipsis (boundary case)', () => {
      render(
        <NewsPagination
          {...createProps({
            currentPage: 4,
            totalPages: 8,
            totalItems: 80,
            onPageChange,
          })}
        />
      );

      // Should show ellipsis pattern since 8 > 7
      expect(screen.getByTestId('news-pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-pagination-page-8')).toBeInTheDocument();
    });
  });
});
