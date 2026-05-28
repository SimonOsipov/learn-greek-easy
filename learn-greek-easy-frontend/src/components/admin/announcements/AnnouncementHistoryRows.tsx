// src/components/admin/announcements/AnnouncementHistoryRows.tsx

/**
 * AnnouncementHistoryRows
 *
 * Presentational component: renders announcements as white card-per-item rows
 * using the `.an-table` / `.an-row` class family from ANND-01.
 * No store or API calls live here — those are owned by the parent tab (ANND-07).
 */

import React from 'react';

import { ExternalLink, Megaphone, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnnouncementItem } from '@/services/adminAPI';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Truncate a message at a word boundary and append an ellipsis.
 */
export function truncateMessage(message: string, max: number = 80): string {
  if (message.length <= max) return message;
  const slice = message.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '…';
}

/**
 * Compute an integer read-percentage from raw counts.
 */
export function computeReadPct(readCount: number, totalRecipients: number): number {
  if (totalRecipients === 0) return 0;
  return Math.round((readCount / totalRecipients) * 100);
}

/**
 * Return the IS class for the rate indicator based on percentage.
 */
export function rateClass(pct: number): 'is-good' | 'is-ok' | 'is-zero' {
  if (pct >= 20) return 'is-good';
  if (pct > 0) return 'is-ok';
  return 'is-zero';
}

/**
 * Format a date string into a two-element tuple: [day label, year label].
 * Example: ["Jan 15", "2026"]
 */
export function formatDateParts(dateString: string, locale: string): [string, string] {
  const date = new Date(dateString);
  const day = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const yearLabel = date.toLocaleDateString(locale, { year: 'numeric' });
  return [day, yearLabel];
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface AnnouncementHistoryRowsProps {
  announcements: AnnouncementItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenDetails: (id: string) => void;
  onRequestDelete: (id: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Five skeleton rows matching the `.an-row` grid shape. */
const SkeletonRows: React.FC = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="an-row" aria-hidden="true">
        {/* Date */}
        <div>
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        {/* Title + message */}
        <div>
          <Skeleton className="mb-1 h-3.5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        {/* Reach */}
        <Skeleton className="ml-auto h-3.5 w-8" />
        {/* Read */}
        <Skeleton className="ml-auto h-3.5 w-8" />
        {/* Rate */}
        <Skeleton className="h-3 w-full" />
        {/* Actions */}
        <Skeleton className="ml-auto h-7 w-7" />
      </div>
    ))}
  </>
);

/** Empty-state illustration + helper text. */
const EmptyState: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 rounded-full bg-muted p-4">
      <Megaphone className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="mb-2 text-lg font-medium">{t('announcements.history.empty')}</h3>
    <p className="text-sm text-muted-foreground">{t('announcements.history.emptyHint')}</p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const AnnouncementHistoryRows: React.FC<AnnouncementHistoryRowsProps> = ({
  announcements,
  isLoading,
  page,
  totalPages,
  onPageChange,
  onOpenDetails,
  onRequestDelete,
  searchQuery,
  onClearSearch,
}) => {
  const { t, i18n } = useTranslation('admin');

  const handlePrevious = () => {
    if (page > 1) onPageChange(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages) onPageChange(page + 1);
  };

  // Empty state (not loading, no rows)
  if (!isLoading && announcements.length === 0) {
    if (searchQuery?.trim()) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-medium">
            {t('announcements.toolbar.emptySearch', { query: searchQuery })}
          </h3>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="text-sm text-primary hover:underline"
            >
              {t('announcements.toolbar.clearSearch')}
            </button>
          )}
        </div>
      );
    }
    return <EmptyState t={t} />;
  }

  return (
    <div>
      {/* ── Card list (card-per-item, no table header) ── */}
      <div className="an-table">
        {/* Loading skeletons */}
        {isLoading ? (
          <SkeletonRows />
        ) : (
          announcements.map((item) => {
            const pct = computeReadPct(item.read_count, item.total_recipients);
            const [dayLabel, yearLabel] = formatDateParts(item.created_at, i18n.language);

            const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDetails(item.id);
              }
            };

            return (
              <div
                key={item.id}
                className="an-row"
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetails(item.id)}
                onKeyDown={handleRowKeyDown}
                data-testid={`announcement-row-${item.id}`}
              >
                {/* Date */}
                <div className="an-date">
                  <div className="an-date-d">{dayLabel}</div>
                  <div className="an-date-t">{yearLabel}</div>
                </div>

                {/* Title + truncated message + optional link badge */}
                <div className="an-title-col">
                  <div className="an-title-t">{item.title}</div>
                  <div className="an-title-m">{truncateMessage(item.message)}</div>
                  {item.link_url && (
                    <div className="an-title-link">
                      <ExternalLink aria-hidden="true" />
                      {t('announcements.v2.history.linkAttached')}
                    </div>
                  )}
                </div>

                {/* Reach */}
                <div className="an-n" style={{ textAlign: 'right' }}>
                  {item.total_recipients}
                </div>

                {/* Read */}
                <div className="an-n" style={{ textAlign: 'right' }}>
                  {item.read_count}
                </div>

                {/* Read-rate bar */}
                <div className="an-rate">
                  <div className="an-rate-bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`an-rate-pct ${rateClass(pct)}`}>{pct}%</span>
                </div>

                {/* Actions */}
                <div className="an-row-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(item.id);
                    }}
                    title={t('announcements.delete.button')}
                    data-testid={`announcement-row-trash-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('pagination.pageOf', { page, totalPages })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={page <= 1 || isLoading}
              data-testid="pagination-previous"
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={page >= totalPages || isLoading}
              data-testid="pagination-next"
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
