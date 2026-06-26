// src/components/admin/AdminFeedbackSection.tsx
//
// ADMIN2-45 re-skin: contained .fb-panel + CD toolbar/search + .fb-list +
// .va-panel-foot pager. Stat cards, dead-code computations, and the shadcn
// Input / Button (pager) removed. FeedbackDrawer mount + URL deep-link
// via useSearchParams preserved from v2.

import React, { useEffect, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SegControl } from '@/components/ui/seg-control';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';
import type { AdminFeedbackItem } from '@/types/feedback';

import { AdminFeedbackCard } from './AdminFeedbackCard';
import { FeedbackDrawer } from './FeedbackDrawer';

import type { FeedbackDrawerInnerTab } from './FeedbackDrawer';

// ── useDebounce (local, preserved from v1) ─────────────────────────────────────

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

// ── Seg filter types ───────────────────────────────────────────────────────────

type StatusSeg = 'all' | 'open' | 'new' | 'investigating' | 'planned' | 'responded' | 'wont_fix';
type TypeSeg = 'all' | 'bug' | 'feature';

// ── Client-side filter helpers ─────────────────────────────────────────────────

function applyStatusSeg(list: AdminFeedbackItem[], seg: StatusSeg): AdminFeedbackItem[] {
  switch (seg) {
    case 'all':
      return list;
    case 'open':
      return list.filter(
        (f) =>
          f.status === 'new' ||
          f.status === 'under_review' ||
          f.status === 'planned' ||
          f.status === 'in_progress'
      );
    case 'new':
      return list.filter((f) => f.status === 'new');
    case 'investigating':
      return list.filter((f) => f.status === 'under_review');
    case 'planned':
      return list.filter((f) => f.status === 'planned');
    case 'responded':
      return list.filter((f) => f.admin_response !== null && f.admin_response !== '');
    case 'wont_fix':
      return list.filter((f) => f.status === 'cancelled');
  }
}

function applyTypeSeg(list: AdminFeedbackItem[], seg: TypeSeg): AdminFeedbackItem[] {
  switch (seg) {
    case 'all':
      return list;
    case 'bug':
      return list.filter((f) => f.category === 'bug_incorrect_data');
    case 'feature':
      return list.filter((f) => f.category === 'feature_request');
  }
}

function matchSearch(item: AdminFeedbackItem, query: string): boolean {
  const q = query.toLowerCase();
  const title = item.title?.toLowerCase() ?? '';
  const desc = item.description?.toLowerCase() ?? '';
  return title.includes(q) || desc.includes(q);
}

// ── AdminFeedbackSection ───────────────────────────────────────────────────────

/**
 * Admin Feedback Section — ADMIN2-45 re-skin.
 *
 * Renders inside a contained .fb-panel:
 *  - CD .news-toolbar (search + 2 SegControls)
 *  - AdminFeedbackCard list (.fb-list) with client-side sort + filter
 *  - .va-panel-foot pager with .btn.btn-glass.btn-sm buttons
 *  - FeedbackDrawer mount host (URL deep-linked via useSearchParams)
 *  - ConfirmDialog for delete (preserved from v1)
 */
export const AdminFeedbackSection: React.FC = () => {
  const { t } = useTranslation('admin');
  const { toast } = useToast();

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    feedbackList,
    page,
    total,
    totalPages,
    isLoading,
    isDeleting,
    error,
    fetchFeedbackList,
    setPage,
    deleteFeedback,
    openFeedbackId,
    openInnerTab,
    openDrawer,
    closeDrawer,
    setInnerTab,
  } = useAdminFeedbackStore();

  // ── URL params ────────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Refs for deep-link idempotency ────────────────────────────────────────
  const didMountFromUrlRef = useRef(false);
  const hasStrippedRef = useRef(false);

  // ── Local filter state (initialised from URL on first render) ─────────────
  const [statusSeg, setStatusSeg] = useState<StatusSeg>(() => {
    const v = searchParams.get('status');
    const valid: StatusSeg[] = [
      'all',
      'open',
      'new',
      'investigating',
      'planned',
      'responded',
      'wont_fix',
    ];
    return valid.includes(v as StatusSeg) ? (v as StatusSeg) : 'all';
  });

  const [typeSeg, setTypeSeg] = useState<TypeSeg>(() => {
    const v = searchParams.get('type');
    const valid: TypeSeg[] = ['all', 'bug', 'feature'];
    return valid.includes(v as TypeSeg) ? (v as TypeSeg) : 'all';
  });

  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  const pageSize = 10;

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFeedbackList();
  }, [fetchFeedbackList]);

  // ── Effect 6a: Mount-time URL → store (runs once after first payload) ─────
  useEffect(() => {
    if (didMountFromUrlRef.current) return;
    if (isLoading || feedbackList.length === 0) return;

    const editId = searchParams.get('edit');
    const innerRaw = searchParams.get('inner');
    // 'thread' was removed — fall back to 'reply' gracefully
    const innerTab: FeedbackDrawerInnerTab | null =
      innerRaw === 'reply' || innerRaw === 'meta' ? innerRaw : null;

    // Branch A: ?inner without ?edit → silent ignore
    if (!editId && innerRaw) {
      didMountFromUrlRef.current = true;
      return;
    }

    // Branch B: ?edit present
    if (editId) {
      const found = feedbackList.find((f) => f.id === editId);
      if (found) {
        openDrawer(editId, innerTab ?? 'reply');
      } else {
        // Not found on current page → toast + clear params
        toast({
          title: t('feedback.v2.toasts.deepLinkNotFound'),
          variant: 'destructive',
        });
        const next = new URLSearchParams(searchParams);
        next.delete('edit');
        next.delete('inner');
        setSearchParams(next, { replace: true });
      }
    }

    didMountFromUrlRef.current = true;
  }, [isLoading, feedbackList, searchParams, openDrawer, setSearchParams, toast, t]);

  // ── Effect 6b: Store → URL (when drawer state changes) ───────────────────
  useEffect(() => {
    if (!didMountFromUrlRef.current) return;

    const current = new URLSearchParams(searchParams);
    const hadEdit = current.has('edit');
    const hadInner = current.has('inner');

    if (openFeedbackId) {
      if (current.get('edit') !== openFeedbackId) current.set('edit', openFeedbackId);
      if (current.get('inner') !== openInnerTab) current.set('inner', openInnerTab);
      setSearchParams(current, { replace: true });
      hasStrippedRef.current = false;
    } else {
      if (hasStrippedRef.current) return;
      if (!hadEdit && !hadInner) {
        hasStrippedRef.current = true;
        return;
      }
      current.delete('edit');
      current.delete('inner');
      setSearchParams(current, { replace: true });
      hasStrippedRef.current = true;
    }
  }, [openFeedbackId, openInnerTab, searchParams, setSearchParams]);

  // ── Effect 6c: Seg/search ↔ URL ──────────────────────────────────────────
  useEffect(() => {
    const current = new URLSearchParams(searchParams);

    if (statusSeg === 'all') {
      current.delete('status');
    } else {
      current.set('status', statusSeg);
    }

    if (typeSeg === 'all') {
      current.delete('type');
    } else {
      current.set('type', typeSeg);
    }

    if (debouncedSearch === '') {
      current.delete('q');
    } else {
      current.set('q', debouncedSearch);
    }

    // Only update if params actually changed (avoid infinite loop)
    if (current.toString() !== searchParams.toString()) {
      setSearchParams(current, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusSeg, typeSeg, debouncedSearch]);
  // searchParams intentionally excluded: only react to seg/search changes

  // ── Page handlers ─────────────────────────────────────────────────────────
  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<AdminFeedbackItem | null>(null);

  // ── Card → drawer ─────────────────────────────────────────────────────────
  const handleCardRespond = (id: string) => {
    openDrawer(id, 'reply');
  };

  // ── Sort + filter pipeline ────────────────────────────────────────────────

  // 1. Client-side sort: vote_count desc, tiebreak created_at desc
  const sorted = [...feedbackList].sort(
    (a, b) =>
      b.vote_count - a.vote_count ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // 2. Status seg filter
  const afterStatus = applyStatusSeg(sorted, statusSeg);

  // 3. Type seg filter
  const afterType = applyTypeSeg(afterStatus, typeSeg);

  // 4. Debounced search (AND-combined)
  const visible = debouncedSearch
    ? afterType.filter((f) => matchSearch(f, debouncedSearch))
    : afterType;

  // ── Filter active check ───────────────────────────────────────────────────
  const hasActiveFilters = statusSeg !== 'all' || typeSeg !== 'all' || debouncedSearch !== '';

  const handleClearFilters = () => {
    setStatusSeg('all');
    setTypeSeg('all');
    setSearchInput('');
  };

  // ── Seg options ───────────────────────────────────────────────────────────
  const STATUS_OPTIONS = [
    { value: 'all' as StatusSeg, label: t('feedback.v2.filters.status.all') },
    { value: 'open' as StatusSeg, label: t('feedback.v2.filters.status.open') },
    { value: 'new' as StatusSeg, label: t('feedback.v2.filters.status.new') },
    { value: 'investigating' as StatusSeg, label: t('feedback.v2.filters.status.investigating') },
    { value: 'planned' as StatusSeg, label: t('feedback.v2.filters.status.planned') },
    { value: 'responded' as StatusSeg, label: t('feedback.v2.filters.status.responded') },
    { value: 'wont_fix' as StatusSeg, label: t('feedback.v2.filters.status.wont_fix') },
  ];

  const TYPE_OPTIONS = [
    { value: 'all' as TypeSeg, label: t('feedback.v2.filters.type.all') },
    { value: 'bug' as TypeSeg, label: t('feedback.v2.filters.type.bug') },
    { value: 'feature' as TypeSeg, label: t('feedback.v2.filters.type.feature') },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Contained panel ────────────────────────────────────────────────── */}
      <div className="fb-panel">
        {/* ── CD toolbar (search + SegControls) ────────────────────────────── */}
        <div className="news-toolbar">
          {/* CD .news-search: icon + input + optional clear button */}
          <div className="news-search">
            <Search className="search-icon" aria-hidden />
            <input
              type="text"
              placeholder={t('feedback.v2.filters.search.placeholder')}
              aria-label={t('feedback.v2.filters.search.placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchInput('');
              }}
              data-testid="feedback-search-input"
            />
            {searchInput && (
              <button
                type="button"
                className="icon-btn icon-btn-sm clear-btn"
                onClick={() => setSearchInput('')}
                aria-label={t('feedback.v2.filters.search.clearAriaLabel')}
              >
                <X />
              </button>
            )}
          </div>

          <SegControl
            options={STATUS_OPTIONS}
            value={statusSeg}
            onChange={setStatusSeg}
            ariaLabel={t('feedback.v2.filters.status.label')}
          />

          <SegControl
            options={TYPE_OPTIONS}
            value={typeSeg}
            onChange={setTypeSeg}
            ariaLabel={t('feedback.v2.filters.type.label')}
          />

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClearFilters}
              data-testid="clear-filters-button"
            >
              {t('feedback.v2.filters.clear')}
            </button>
          )}
        </div>

        {/* ── Loading State ─────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="fb-list">
            {[1, 2, 3].map((i) => (
              <article key={i} className="fb-card" aria-hidden>
                <div className="fb-card-left">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-8" />
                </div>
                <div className="fb-card-main">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div>
                  <Skeleton className="h-8 w-8" />
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────────────────── */}
        {error && !isLoading && (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('feedback.errors.loadingTitle')}</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">{error}</p>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => fetchFeedbackList()}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('actions.retry')}
                </button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ── Feedback List ──────────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <>
            {visible.length === 0 ? (
              <div
                className="placeholder-box mx-5 my-5 flex-col gap-3 py-12"
                data-testid="feedback-empty"
              >
                <Search className="h-10 w-10 text-muted-foreground" aria-hidden />
                <h3 className="text-base font-semibold">
                  {hasActiveFilters
                    ? t('feedback.v2.emptyStates.noMatchHeading')
                    : t('feedback.v2.emptyStates.noFeedbackHeading')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? t('feedback.v2.emptyStates.noMatchBody')
                    : t('feedback.v2.emptyStates.noFeedbackBody')}
                </p>
              </div>
            ) : (
              <div className="fb-list">
                {visible.map((feedback) => (
                  <AdminFeedbackCard
                    key={feedback.id}
                    feedback={feedback}
                    onRespond={handleCardRespond}
                    onDelete={(id) => {
                      const item = feedbackList.find((x) => x.id === id);
                      if (item) setDeleteTarget(item);
                    }}
                  />
                ))}
              </div>
            )}

            {/* ── Panel footer pager ────────────────────────────────────────── */}
            {total > 0 && (
              <div className="va-panel-foot">
                <span className="va-dim">
                  {t('pagination.showing', {
                    from: (page - 1) * pageSize + 1,
                    to: Math.min(page * pageSize, total),
                    total,
                  })}
                </span>
                <div className="va-pager">
                  <button
                    type="button"
                    className="btn btn-glass btn-sm"
                    onClick={handlePreviousPage}
                    disabled={page === 1}
                    data-testid="feedback-pagination-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('pagination.previous')}
                  </button>
                  <span className="va-dim">{t('pagination.pageOf', { page, totalPages })}</span>
                  <button
                    type="button"
                    className="btn btn-glass btn-sm"
                    onClick={handleNextPage}
                    disabled={page >= totalPages}
                    data-testid="feedback-pagination-next"
                  >
                    {t('pagination.next')}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FeedbackDrawer mount host ──────────────────────────────────────── */}
      {openFeedbackId !== null && (
        <FeedbackDrawer
          feedbackId={openFeedbackId}
          innerTab={openInnerTab}
          onClose={closeDrawer}
          onInnerTabChange={setInnerTab}
          onRequestDelete={(id) => {
            const item = feedbackList.find((f) => f.id === id);
            if (item) {
              setDeleteTarget(item);
              closeDrawer();
            }
          }}
        />
      )}

      {/* ── Delete Confirm Dialog (preserved from v1) ─────────────────────── */}
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
