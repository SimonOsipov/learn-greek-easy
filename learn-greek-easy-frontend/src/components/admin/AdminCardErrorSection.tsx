// src/components/admin/AdminCardErrorSection.tsx

import React, { useEffect, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminCardErrorStore } from '@/stores/adminCardErrorStore';
import type { AdminCardErrorResponse, CardErrorStatus, CardType } from '@/types/cardError';

import { AdminCardErrorCard } from './AdminCardErrorCard';
import { AdminCardErrorDetailModal } from './AdminCardErrorDetailModal';

const CARD_ERROR_STATUSES: { value: CardErrorStatus; label: string }[] = [
  { value: 'PENDING', label: 'pending' },
  { value: 'REVIEWED', label: 'reviewed' },
  { value: 'FIXED', label: 'fixed' },
  { value: 'DISMISSED', label: 'dismissed' },
];

const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'WORD', label: 'word' },
  { value: 'CULTURE', label: 'culture' },
];

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

/**
 * Admin Card Error Section Component
 *
 * Displays a paginated list of all card error reports for admin management.
 * Includes filtering by status and card type.
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

  // Fetch on mount
  useEffect(() => {
    fetchErrorList();
  }, [fetchErrorList]);

  const handleStatusFilterChange = (value: string) => {
    if (value === 'all') {
      setFilters({ status: null });
    } else {
      setFilters({ status: value as CardErrorStatus });
    }
  };

  const handleCardTypeFilterChange = (value: string) => {
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

  const hasActiveFilters =
    filters.status !== null || filters.cardType !== null || debouncedSearch !== '';

  const filteredErrors = debouncedSearch
    ? errorList.filter((item) => {
        const desc = item.description?.toLowerCase() ?? '';
        const name = item.reporter?.full_name?.toLowerCase() ?? '';
        return (
          desc.includes(debouncedSearch.toLowerCase()) ||
          name.includes(debouncedSearch.toLowerCase())
        );
      })
    : errorList;

  const pendingCount = errorList.filter((e) => e.status === 'PENDING').length;
  const fixedCount = errorList.filter((e) => e.status === 'FIXED').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title={t('cardErrors.stats.total')}
          value={total}
          icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          testId="card-errors-total-card"
        />
        <SummaryCard
          title={t('cardErrors.stats.pending')}
          value={pendingCount}
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          testId="card-errors-pending-card"
        />
        <SummaryCard
          title={t('cardErrors.stats.fixed')}
          value={fixedCount}
          icon={<CheckCircle className="h-5 w-5 text-muted-foreground" />}
          testId="card-errors-fixed-card"
        />
      </div>
      <Card data-testid="admin-card-error-section">
        <CardHeader>
          <CardTitle data-testid="admin-card-error-title">{t('cardErrors.sectionTitle')}</CardTitle>
          <CardDescription data-testid="admin-card-error-description">
            {t('cardErrors.sectionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('cardErrors.search.placeholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
                data-testid="card-error-search-input"
              />
            </div>
            <Select value={filters.status || 'all'} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="card-error-status-filter">
                <SelectValue placeholder={t('cardErrors.filters.statusPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('cardErrors.filters.allStatuses')}</SelectItem>
                {CARD_ERROR_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(`cardErrors.statuses.${status.label}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.cardType || 'all'} onValueChange={handleCardTypeFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="card-error-type-filter">
                <SelectValue placeholder={t('cardErrors.filters.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('cardErrors.filters.allTypes')}</SelectItem>
                {CARD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`cardErrors.cardTypes.${type.label}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
