/**
 * ChangelogPagination Component
 *
 * Reusable pagination component for the Changelog Page with:
 * - "Showing X-Y of Z entries" text
 * - Previous/Next buttons with icons
 * - Page numbers with ellipsis for large page counts
 * - Mobile-responsive design (simplified on small screens)
 * - Loading state that disables all interactions
 */

import React, { useMemo } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ChangelogPaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Number of items displayed per page */
  itemsPerPage: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Whether data is currently loading */
  isLoading?: boolean;
}

/**
 * Generate page numbers to display with ellipsis
 * Returns an array of page numbers and 'ellipsis' markers
 * Maximum 7 items displayed
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  // For 7 or fewer pages, show all
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage <= 3) {
    // Near start: 1, 2, 3, 4, 5, ..., last
    pages.push(2, 3, 4, 5, 'ellipsis', totalPages);
  } else if (currentPage >= totalPages - 2) {
    // Near end: 1, ..., last-4, last-3, last-2, last-1, last
    pages.push(
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    );
  } else {
    // Middle: 1, ..., current-1, current, current+1, ..., last
    pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
  }

  return pages;
}

export const ChangelogPagination: React.FC<ChangelogPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
}) => {
  const { t } = useTranslation('common');

  // Calculate "from" and "to" for showing text
  const from = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo(
    () => generatePageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  // Don't render if no items
  if (totalItems === 0) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1 && !isLoading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && !isLoading) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage && !isLoading) {
      onPageChange(page);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="changelog-pagination"
    >
      {/* Showing text */}
      <p
        className="text-center text-sm text-muted-foreground sm:text-left"
        data-testid="changelog-pagination-showing"
      >
        {t('changelog.pagination.showing', { from, to, total: totalItems })}
      </p>

      {/* Desktop: Full pagination with page numbers */}
      <div className="hidden items-center gap-1 md:flex">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1 || isLoading}
          data-testid="changelog-pagination-prev"
          aria-label={t('changelog.pagination.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">{t('changelog.pagination.previous')}</span>
        </Button>

        {/* Page numbers */}
        {totalPages > 1 &&
          pageNumbers.map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageClick(page)}
                disabled={isLoading}
                data-testid={`changelog-pagination-page-${page}`}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                className={cn('min-w-[36px]', page === currentPage && 'pointer-events-none')}
              >
                {page}
              </Button>
            )
          )}

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages || isLoading}
          data-testid="changelog-pagination-next"
          aria-label={t('changelog.pagination.next')}
        >
          <span className="sr-only sm:not-sr-only">{t('changelog.pagination.next')}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile: Simplified pagination */}
      <div className="flex items-center justify-center gap-2 md:hidden">
        {/* Previous button (icon only) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1 || isLoading}
          data-testid="changelog-pagination-prev-mobile"
          aria-label={t('changelog.pagination.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page X of Y text */}
        <span className="text-sm text-muted-foreground">
          {t('pagination.page', { current: currentPage, total: totalPages })}
        </span>

        {/* Next button (icon only) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages || isLoading}
          data-testid="changelog-pagination-next-mobile"
          aria-label={t('changelog.pagination.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
