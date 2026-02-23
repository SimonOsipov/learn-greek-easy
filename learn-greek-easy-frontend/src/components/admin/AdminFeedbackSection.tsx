// src/components/admin/AdminFeedbackSection.tsx

import React, { useEffect, useState } from 'react';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
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
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';
import type { AdminFeedbackItem, FeedbackCategory, FeedbackStatus } from '@/types/feedback';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '@/types/feedback';

import { AdminFeedbackCard } from './AdminFeedbackCard';
import { AdminFeedbackResponseDialog } from './AdminFeedbackResponseDialog';

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
 * Admin Feedback Section Component
 *
 * Displays a paginated list of all feedback for admin management.
 * Includes filtering by status and category, and response dialog.
 */
export const AdminFeedbackSection: React.FC = () => {
  const { t } = useTranslation('admin');
  const {
    feedbackList,
    page,
    total,
    totalPages,
    filters,
    isLoading,
    isDeleting,
    error,
    fetchFeedbackList,
    setFilters,
    clearFilters,
    setPage,
    deleteFeedback,
    selectedFeedback,
    setSelectedFeedback,
  } = useAdminFeedbackStore();

  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFeedbackItem | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const pageSize = 10;

  // Fetch feedback on mount
  useEffect(() => {
    fetchFeedbackList();
  }, [fetchFeedbackList]);

  const handleStatusFilterChange = (value: string) => {
    if (value === 'all') {
      setFilters({ status: null });
    } else {
      setFilters({ status: value as FeedbackStatus });
    }
  };

  const handleCategoryFilterChange = (value: string) => {
    if (value === 'all') {
      setFilters({ category: null });
    } else {
      setFilters({ category: value as FeedbackCategory });
    }
  };

  const handleRespond = (feedback: AdminFeedbackItem) => {
    setSelectedFeedback(feedback);
    setIsResponseDialogOpen(true);
  };

  const handleResponseDialogClose = (open: boolean) => {
    setIsResponseDialogOpen(open);
    if (!open) {
      setSelectedFeedback(null);
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
    filters.status !== null || filters.category !== null || debouncedSearch !== '';

  const filteredFeedback = debouncedSearch
    ? feedbackList.filter((item) => {
        const title = item.title?.toLowerCase() ?? '';
        const desc = item.description?.toLowerCase() ?? '';
        return (
          title.includes(debouncedSearch.toLowerCase()) ||
          desc.includes(debouncedSearch.toLowerCase())
        );
      })
    : feedbackList;

  const newCount = feedbackList.filter((f) => f.status === 'new').length;
  const respondedCount = feedbackList.filter((f) => f.admin_response !== null).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title={t('feedback.stats.total')}
          value={total}
          icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
          testId="feedback-total-card"
        />
        <SummaryCard
          title={t('feedback.stats.new')}
          value={newCount}
          icon={<Inbox className="h-5 w-5 text-muted-foreground" />}
          testId="feedback-new-card"
        />
        <SummaryCard
          title={t('feedback.stats.responded')}
          value={respondedCount}
          icon={<MessageCircle className="h-5 w-5 text-muted-foreground" />}
          testId="feedback-responded-card"
        />
      </div>
      <Card data-testid="admin-feedback-section">
        <CardHeader>
          <CardTitle data-testid="admin-feedback-title">{t('feedback.sectionTitle')}</CardTitle>
          <CardDescription data-testid="admin-feedback-description">
            {t('feedback.sectionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('feedback.search.placeholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
                data-testid="feedback-search-input"
              />
            </div>
            <Select value={filters.status || 'all'} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="feedback-status-filter">
                <SelectValue placeholder={t('feedback.filters.statusPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('feedback.filters.allStatuses')}</SelectItem>
                {FEEDBACK_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(`feedback.statuses.${status.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.category || 'all'} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="feedback-category-filter">
                <SelectValue placeholder={t('feedback.filters.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('feedback.filters.allCategories')}</SelectItem>
                {FEEDBACK_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {t(`feedback.categories.${category.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="clear-filters-button"
              >
                {t('feedback.filters.clear')}
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
              <AlertTitle>{t('feedback.errors.loadingTitle')}</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchFeedbackList()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('actions.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Feedback List */}
          {!isLoading && !error && (
            <>
              {filteredFeedback.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {debouncedSearch
                    ? t('feedback.search.noResults')
                    : hasActiveFilters
                      ? t('feedback.states.noFilteredResults')
                      : t('feedback.states.noFeedback')}
                </p>
              ) : (
                <>
                  {debouncedSearch && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t('feedback.search.filteredCount', {
                        filtered: filteredFeedback.length,
                        total: feedbackList.length,
                      })}
                    </p>
                  )}
                  <div className="space-y-4">
                    {filteredFeedback.map((feedback) => (
                      <AdminFeedbackCard
                        key={feedback.id}
                        feedback={feedback}
                        onRespond={handleRespond}
                        onDelete={(item) => setDeleteTarget(item)}
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
                      data-testid="feedback-pagination-prev"
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
                      data-testid="feedback-pagination-next"
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

      {/* Response Dialog */}
      <AdminFeedbackResponseDialog
        open={isResponseDialogOpen}
        onOpenChange={handleResponseDialogClose}
        feedback={selectedFeedback}
      />

      {/* Delete Feedback Confirm Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('feedback.delete.title')}
        description={t('feedback.delete.warning')}
        loading={isDeleting}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteFeedback(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        variant="destructive"
      />
    </div>
  );
};
