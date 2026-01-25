// src/components/admin/news/NewsItemsTable.tsx

/**
 * News Items Table Component
 *
 * Displays a paginated table of news items with:
 * - Thumbnail image (40x40)
 * - Title (Greek)
 * - Publication date
 * - Created date
 * - Edit/Delete actions
 */

import React from 'react';

import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { NewsItemResponse } from '@/services/adminAPI';

interface NewsItemsTableProps {
  newsItems: NewsItemResponse[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: NewsItemResponse) => void;
  onDelete: (item: NewsItemResponse) => void;
}

/**
 * Format date string for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Loading skeleton for table rows
 */
const TableSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Single news item row
 */
interface NewsItemRowProps {
  item: NewsItemResponse;
  onEdit: (item: NewsItemResponse) => void;
  onDelete: (item: NewsItemResponse) => void;
  t: (key: string) => string;
}

const NewsItemRow: React.FC<NewsItemRowProps> = ({ item, onEdit, onDelete, t }) => (
  <div
    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
    data-testid={`news-item-row-${item.id}`}
  >
    <div className="flex items-center gap-3">
      {/* Thumbnail */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="h-10 w-10 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
          <span className="text-xs">{t('news.table.noImage')}</span>
        </div>
      )}

      {/* Title and dates */}
      <div>
        <p className="font-medium">{item.title_el}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            {t('news.table.published')}: {formatDate(item.publication_date)}
          </span>
          <span>
            {t('news.table.created')}: {formatDate(item.created_at)}
          </span>
        </div>
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(item)}
        data-testid={`edit-news-${item.id}`}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">{t('actions.edit')}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(item)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        data-testid={`delete-news-${item.id}`}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">{t('actions.delete')}</span>
      </Button>
    </div>
  </div>
);

/**
 * NewsItemsTable component
 */
export const NewsItemsTable: React.FC<NewsItemsTableProps> = ({
  newsItems,
  isLoading,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation('admin');

  const handlePreviousPage = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  return (
    <Card data-testid="news-items-table">
      <CardHeader>
        <CardTitle>{t('news.table.title')}</CardTitle>
        <CardDescription>{t('news.table.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Loading State */}
        {isLoading && <TableSkeleton />}

        {/* Empty State */}
        {!isLoading && newsItems.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">{t('news.table.empty')}</p>
        )}

        {/* News Items List */}
        {!isLoading && newsItems.length > 0 && (
          <>
            <div className="space-y-3">
              {newsItems.map((item) => (
                <NewsItemRow key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} t={t} />
              ))}
            </div>

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
                    data-testid="news-pagination-prev"
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
                    data-testid="news-pagination-next"
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
  );
};
