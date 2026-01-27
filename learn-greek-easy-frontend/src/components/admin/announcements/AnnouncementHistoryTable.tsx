// src/components/admin/announcements/AnnouncementHistoryTable.tsx

/**
 * Announcement History Table Component
 *
 * Displays a paginated table of all past announcements with:
 * - Date, title, sent/read counts
 * - View details button for each row
 * - Pagination controls
 * - Loading skeleton
 * - Empty state
 */

import React from 'react';

import { Eye, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AnnouncementItem } from '@/services/adminAPI';

interface AnnouncementHistoryTableProps {
  announcements: AnnouncementItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewDetail: (id: string) => void;
}

/**
 * Format date for display
 */
const formatDate = (dateString: string, locale: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Truncate text to specified length
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Calculate read percentage
 */
const calculateReadPercentage = (read: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((read / total) * 100);
};

/**
 * Loading skeleton for the table
 */
const TableSkeleton: React.FC = () => (
  <TableBody>
    {[1, 2, 3, 4, 5].map((i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-48" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-12" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-8 w-8 rounded" />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
);

/**
 * Empty state component
 */
const EmptyState: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 rounded-full bg-muted p-4">
      <Megaphone className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="mb-2 text-lg font-medium">{t('announcements.history.empty')}</h3>
    <p className="text-sm text-muted-foreground">{t('announcements.history.emptyHint')}</p>
  </div>
);

/**
 * Announcement History Table Component
 */
export const AnnouncementHistoryTable: React.FC<AnnouncementHistoryTableProps> = ({
  announcements,
  isLoading,
  page,
  totalPages,
  onPageChange,
  onViewDetail,
}) => {
  const { t, i18n } = useTranslation('admin');

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  return (
    <Card data-testid="announcement-history-table">
      <CardHeader>
        <CardTitle>{t('announcements.history.title')}</CardTitle>
        <CardDescription>{t('announcements.history.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Empty state */}
        {!isLoading && announcements.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <>
            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">{t('news.table.created')}</TableHead>
                  <TableHead>{t('announcements.create.titleLabel')}</TableHead>
                  <TableHead className="w-[80px] text-right">
                    {t('announcements.detail.sent')}
                  </TableHead>
                  <TableHead className="w-[120px] text-right">
                    {t('announcements.detail.read')}
                  </TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              {isLoading ? (
                <TableSkeleton />
              ) : (
                <TableBody>
                  {announcements.map((announcement) => {
                    const readPercentage = calculateReadPercentage(
                      announcement.read_count,
                      announcement.total_recipients
                    );
                    return (
                      <TableRow
                        key={announcement.id}
                        data-testid={`announcement-row-${announcement.id}`}
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(announcement.created_at, i18n.language)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {truncateText(announcement.title, 50)}
                        </TableCell>
                        <TableCell className="text-right">
                          {announcement.total_recipients}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="tabular-nums">
                            {announcement.read_count} ({readPercentage}%)
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(announcement.id)}
                            title={t('announcements.history.viewDetail')}
                            data-testid={`view-detail-${announcement.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>

            {/* Pagination */}
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
          </>
        )}
      </CardContent>
    </Card>
  );
};
