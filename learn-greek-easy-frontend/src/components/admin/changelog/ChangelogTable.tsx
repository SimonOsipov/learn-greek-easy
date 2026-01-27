/**
 * Admin table for managing changelog entries.
 */

import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChangelogEntryAdmin } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

interface ChangelogTableProps {
  items: ChangelogEntryAdmin[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (entry: ChangelogEntryAdmin) => void;
  onDelete: (entry: ChangelogEntryAdmin) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ChangelogTable({
  items,
  isLoading,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}: ChangelogTableProps) {
  const { t, i18n } = useTranslation(['admin', 'changelog']);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
    <div className="space-y-4" data-testid="changelog-table">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Title</TableHead>
              <TableHead className="w-[20%]">Date</TableHead>
              <TableHead className="w-[20%]">Tag</TableHead>
              <TableHead className="w-[20%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No changelog entries found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((entry) => {
                const tagConfig = CHANGELOG_TAG_CONFIG[entry.tag];
                return (
                  <TableRow key={entry.id} data-testid={`changelog-row-${entry.id}`}>
                    <TableCell className="font-medium">{entry.title_en}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={tagConfig.colorClass}>
                        {t(tagConfig.labelKey)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(entry)}
                          aria-label={`Edit ${entry.title_en}`}
                          data-testid={`edit-changelog-${entry.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(entry)}
                          aria-label={`Delete ${entry.title_en}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          data-testid={`delete-changelog-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}{' '}
            entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 1}
              data-testid="pagination-previous"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= totalPages}
              data-testid="pagination-next"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
