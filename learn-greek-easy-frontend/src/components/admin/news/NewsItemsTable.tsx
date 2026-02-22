// src/components/admin/news/NewsItemsTable.tsx

/**
 * News Items Table Component
 *
 * Displays a paginated table of news items with:
 * - Thumbnail image (40x40)
 * - Title (localized based on interface language)
 * - Publication date
 * - Created date
 * - Edit/Delete actions
 */

import React, { useEffect, useState } from 'react';

import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import type { NewsItemResponse } from '@/services/adminAPI';

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
 * Get localized title and description based on current interface language
 */
function getLocalizedContent(
  item: NewsItemResponse,
  lang: string
): { title: string; description: string } {
  switch (lang) {
    case 'el':
      return { title: item.title_el, description: item.description_el };
    case 'ru':
      return { title: item.title_ru, description: item.description_ru };
    default: // 'en'
      return { title: item.title_en, description: item.description_en };
  }
}

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
  regeneratingId: string | null;
  cooldownEndTime: number | null;
  onRegenerateAudio: (item: NewsItemResponse) => void;
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
 * Format audio duration in seconds to m:ss display format
 */
function formatAudioDuration(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
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
  lang: string;
  regeneratingId: string | null;
  cooldownEndTime: number | null;
  onRegenerateAudio: (item: NewsItemResponse) => void;
}

const NewsItemRow: React.FC<NewsItemRowProps> = ({
  item,
  onEdit,
  onDelete,
  t,
  lang,
  regeneratingId,
  cooldownEndTime,
  onRegenerateAudio,
}) => {
  const { title } = getLocalizedContent(item, lang);
  const isRegenerating = regeneratingId === item.id;
  const isCooldownActive = cooldownEndTime !== null;
  const canRegenerate = !isRegenerating && !isCooldownActive && !!item.description_el;

  return (
    <div
      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
      data-testid={`news-item-row-${item.id}`}
    >
      {/* Left: Thumbnail + Title/Dates */}
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
          <p className="font-medium">{title}</p>
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

      {/* Right: Audio Status + Actions */}
      <div className="flex items-center gap-4">
        {/* Audio Status Indicator */}
        <div className="flex items-center gap-1.5 text-sm" data-testid={`audio-status-${item.id}`}>
          {item.audio_url ? (
            <>
              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
              <span className="text-muted-foreground">
                {item.audio_duration_seconds != null
                  ? formatAudioDuration(item.audio_duration_seconds)
                  : t('news.audio.hasAudio')}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/60">{t('news.audio.noAudio')}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Regenerate Audio Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerateAudio(item)}
            disabled={!canRegenerate}
            data-testid={`regenerate-audio-${item.id}`}
          >
            {isRegenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="sr-only">{t('news.audio.regenerate')}</span>
          </Button>

          {/* Edit Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(item)}
            data-testid={`edit-news-${item.id}`}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t('actions.edit')}</span>
          </Button>

          {/* Delete Button */}
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
    </div>
  );
};

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
  regeneratingId,
  cooldownEndTime,
  onRegenerateAudio,
}) => {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const filteredItems = debouncedSearch
    ? newsItems.filter((item) => {
        const title = getLocalizedContent(item, currentLanguage).title.toLowerCase();
        return title.includes(debouncedSearch.toLowerCase());
      })
    : newsItems;

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
        <div className="relative flex-1 pt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('news.search.placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            data-testid="news-search-input"
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading State */}
        {isLoading && <TableSkeleton />}

        {/* Empty State - no data */}
        {!isLoading && newsItems.length === 0 && (
          <p className="py-8 text-center text-muted-foreground" data-testid="news-table-empty">
            {t('news.table.empty')}
          </p>
        )}

        {/* Empty State - search produced no results */}
        {!isLoading && newsItems.length > 0 && filteredItems.length === 0 && (
          <p className="py-8 text-center text-muted-foreground" data-testid="news-search-empty">
            {t('news.search.noResults')}
          </p>
        )}

        {/* News Items List */}
        {!isLoading && filteredItems.length > 0 && (
          <>
            {debouncedSearch && (
              <p className="mb-3 text-sm text-muted-foreground">
                {t('news.search.filteredCount', {
                  filtered: filteredItems.length,
                  total: newsItems.length,
                })}
              </p>
            )}
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <NewsItemRow
                  key={item.id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  t={t}
                  lang={currentLanguage}
                  regeneratingId={regeneratingId}
                  cooldownEndTime={cooldownEndTime}
                  onRegenerateAudio={onRegenerateAudio}
                />
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
