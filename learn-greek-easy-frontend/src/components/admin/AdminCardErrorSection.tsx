// src/components/admin/AdminCardErrorSection.tsx

import React, { useEffect, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegControl } from '@/components/ui/seg-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { CardErrorStatusFilter } from '@/stores/adminCardErrorStore';
import { useAdminCardErrorStore } from '@/stores/adminCardErrorStore';
import type { AdminCardErrorResponse, CardType } from '@/types/cardError';

import { AdminCardErrorCard } from './AdminCardErrorCard';
import { CardErrorDrawer } from './CardErrorDrawer';

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

  // ── URL state (CER-60) ────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  // Guard: only hydrate from URL once after the first fetch settles
  const didHydrateFromUrlRef = useRef(false);

  // Fetch on mount
  useEffect(() => {
    fetchErrorList();
  }, [fetchErrorList]);

  // ── CER-60 Effect A: URL → state (deep-link in, runs once after list loads) ──
  useEffect(() => {
    if (didHydrateFromUrlRef.current) return;
    if (isLoading) return; // wait for first fetch to settle

    const editId = searchParams.get('edit');
    if (!editId) {
      didHydrateFromUrlRef.current = true;
      return;
    }

    const found = errorList.find((r) => r.id === editId);
    if (found) {
      setSelectedError(found);
      setIsResponseDialogOpen(true);
    } else {
      // Not found — clear the stale param silently (no toast per CER-60 AC#6)
      setSearchParams(
        (prev) => {
          prev.delete('edit');
          return prev;
        },
        { replace: true }
      );
    }
    didHydrateFromUrlRef.current = true;
  }, [isLoading, errorList, searchParams, setSelectedError, setSearchParams]);

  // ── CER-60 Effect B: state → URL (sync out on every drawer state change) ──
  useEffect(() => {
    if (!didHydrateFromUrlRef.current) return; // skip before hydration

    if (isResponseDialogOpen && selectedError) {
      setSearchParams(
        (prev) => {
          if (prev.get('edit') !== selectedError.id) {
            prev.set('edit', selectedError.id);
          }
          return prev;
        },
        { replace: true }
      );
    } else if (!isResponseDialogOpen) {
      setSearchParams(
        (prev) => {
          if (!prev.has('edit')) return prev;
          prev.delete('edit');
          return prev;
        },
        { replace: true }
      );
    }
  }, [isResponseDialogOpen, selectedError, setSearchParams]);

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
    <div className="space-y-6" data-testid="admin-card-error-section">
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('cardErrors.toolbar.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchInput('');
            }}
            className="pl-8 pr-8"
            data-testid="card-error-search-input"
          />
          {searchInput && (
            <button
              type="button"
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchInput('')}
              aria-label={t('cardErrors.toolbar.searchClearAriaLabel')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

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
            debouncedSearch ? (
              <p className="py-8 text-center text-muted-foreground">
                {t('cardErrors.search.noResults')}
              </p>
            ) : hasActiveFilters ? (
              /* CER-40: Filter empty state — Search icon + H3 + body */
              <div
                className="flex flex-col items-center justify-center gap-2 py-12 text-center"
                data-testid="card-errors-filter-empty-state"
              >
                <Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-base font-semibold text-foreground">
                  {t('cardErrors.empty.title')}
                </h3>
                <p className="text-sm text-muted-foreground">{t('cardErrors.empty.body')}</p>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                {t('cardErrors.states.noErrors')}
              </p>
            )
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

      {/* Detail Drawer */}
      <CardErrorDrawer
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
