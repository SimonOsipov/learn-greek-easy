// src/components/admin/AdminCardErrorSection.tsx

import React, { useEffect, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegControl } from '@/components/ui/seg-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { CardErrorStatusFilter } from '@/stores/adminCardErrorStore';
import { useAdminCardErrorStore } from '@/stores/adminCardErrorStore';
import type { AdminCardErrorResponse, CardType } from '@/types/cardError';

import { AdminCardErrorCard } from './AdminCardErrorCard';
import { AdminCardErrorDetailModal } from './AdminCardErrorDetailModal';

// ── Type aliases for filter segs ───────────────────────────────────────────────

type TypeSeg = 'all' | 'WORD' | 'CULTURE';

// ── useDebounce ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ── Client-side status filter for 'open' meta-key ─────────────────────────────

function applyStatusFilter(
  list: AdminCardErrorResponse[],
  filter: CardErrorStatusFilter
): AdminCardErrorResponse[] {
  if (!filter || filter === null) return list;
  if (filter === 'open') {
    return list.filter((e) => e.status === 'PENDING' || e.status === 'REVIEWED');
  }
  return list.filter((e) => e.status === filter);
}

/**
 * Admin Card Error Section Component
 *
 * Displays a paginated list of all card error reports for admin management.
 * Includes filtering by status (segmented chips with 'open' meta-key) and card type.
 */
export const AdminCardErrorSection: React.FC = () => {
  const { t } = useTranslation('admin');
  const {
    errorList,
    selectedError,
    page,
    total,
    totalPages,
    filters,
    isLoading,
    error,
    fetchErrorList,
    setFilters,
    clearFilters,
    setPage,
    setSelectedError,
  } = useAdminCardErrorStore();

  // Dialog state
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const pageSize = 10;

  // Local type seg — drives store filter
  const typeSeg: TypeSeg = (filters.cardType as TypeSeg) ?? 'all';

  // Fetch on mount
  useEffect(() => {
    fetchErrorList();
  }, [fetchErrorList]);

  const handleStatusFilterChange = (value: CardErrorStatusFilter | 'all') => {
    if (value === 'all') {
      setFilters({ status: null });
    } else {
      setFilters({ status: value as CardErrorStatusFilter });
    }
  };

  const handleCardTypeFilterChange = (value: TypeSeg) => {
    if (value === 'all') {
      setFilters({ cardType: null });
    } else {
      setFilters({ cardType: value as CardType });
    }
  };

  const handleRespond = (errorReport: AdminCardErrorResponse) => {
    setSelectedError(errorReport);
    setIsResponseDialogOpen(true);
  };

  // Dialog close handler
  const handleResponseDialogClose = (open: boolean) => {
    setIsResponseDialogOpen(open);
    if (!open) {
      setSelectedError(null);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const statusSeg: CardErrorStatusFilter | 'all' = filters.status ?? 'all';

  const hasActiveFilters =
    filters.status !== null || filters.cardType !== null || debouncedSearch !== '';

  // Apply client-side open filter (when status === 'open', backend returned all rows)
  const afterStatusFilter = applyStatusFilter(errorList, filters.status);

  const filteredErrors = debouncedSearch
    ? afterStatusFilter.filter((item) => {
        const desc = item.description?.toLowerCase() ?? '';
        const name = item.reporter?.full_name?.toLowerCase() ?? '';
        return (
          desc.includes(debouncedSearch.toLowerCase()) ||
          name.includes(debouncedSearch.toLowerCase())
        );
      })
    : afterStatusFilter;

  // ── Seg options ─────────────────────────────────────────────────────────────

  const STATUS_OPTIONS = [
    { value: 'all' as const, label: t('cardErrors.filters.status.all') },
    { value: 'open' as const, label: t('cardErrors.filters.status.open') },
    { value: 'PENDING' as const, label: t('cardErrors.filters.status.pending') },
    { value: 'REVIEWED' as const, label: t('cardErrors.filters.status.reviewed') },
    { value: 'FIXED' as const, label: t('cardErrors.filters.status.fixed') },
    { value: 'DISMISSED' as const, label: t('cardErrors.filters.status.dismissed') },
  ];

  const TYPE_OPTIONS = [
    { value: 'all' as TypeSeg, label: t('cardErrors.filters.type.all') },
    { value: 'WORD' as TypeSeg, label: t('cardErrors.filters.type.words') },
    { value: 'CULTURE' as TypeSeg, label: t('cardErrors.filters.type.culture') },
  ];

  return (
    <div className="space-y-6">
      <Card data-testid="admin-card-error-section">
        <CardHeader>
          <CardTitle data-testid="admin-card-error-title">{t('cardErrors.sectionTitle')}</CardTitle>
          <CardDescription data-testid="admin-card-error-description">
            {t('cardErrors.sectionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SegControl
              options={STATUS_OPTIONS}
              value={statusSeg}
              onChange={handleStatusFilterChange}
              ariaLabel={t('cardErrors.filters.statusPlaceholder')}
            />

            <SegControl
              options={TYPE_OPTIONS}
              value={typeSeg}
              onChange={handleCardTypeFilterChange}
              ariaLabel={t('cardErrors.filters.typePlaceholder')}
            />

            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('cardErrors.toolbar.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
                data-testid="card-error-search-input"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="clear-card-error-filters-button"
              >
                {t('cardErrors.filters.clear')}
              </Button>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('cardErrors.errors.loadingTitle')}</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchErrorList()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('actions.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Error List */}
          {!isLoading && !error && (
            <>
              {filteredErrors.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {debouncedSearch
                    ? t('cardErrors.search.noResults')
                    : hasActiveFilters
                      ? t('cardErrors.states.noFilteredResults')
                      : t('cardErrors.states.noErrors')}
                </p>
              ) : (
                <>
                  {debouncedSearch && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t('cardErrors.search.filteredCount', {
                        filtered: filteredErrors.length,
                        total: errorList.length,
                      })}
                    </p>
                  )}
                  <div className="space-y-4">
                    {filteredErrors.map((errorReport) => (
                      <AdminCardErrorCard
                        key={errorReport.id}
                        errorReport={errorReport}
                        onRespond={handleRespond}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Pagination */}
              {total > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t('pagination.showing', {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={page === 1}
                      data-testid="card-error-pagination-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('pagination.previous')}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t('pagination.pageOf', { page, totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={page >= totalPages}
                      data-testid="card-error-pagination-next"
                    >
                      {t('pagination.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <AdminCardErrorDetailModal
        open={isResponseDialogOpen}
        onOpenChange={handleResponseDialogClose}
        report={selectedError}
        onUpdate={() => {
          // The store will auto-update via updateError
          // Refetch to ensure list is in sync
          fetchErrorList();
        }}
      />
    </div>
  );
};
