/**
 * Admin table for managing changelog entries.
 */

import { useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, Pencil, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG, CHANGELOG_TAG_OPTIONS } from '@/types/changelog';

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

  const [searchInput, setSearchInput] = useState('');
  const [tagFilter, setTagFilter] = useState<ChangelogTag | 'all'>('all');
  const debouncedSearch = useDebounce(searchInput, 300);

  const filteredEntries = items.filter((entry) => {
    const title = i18n.language === 'ru' ? entry.title_ru || entry.title_en : entry.title_en;
    const matchesSearch =
      !debouncedSearch || title.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesTag = tagFilter === 'all' || entry.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

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
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin:changelog.search.placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            data-testid="changelog-search-input"
          />
        </div>
        <Select value={tagFilter} onValueChange={(v) => setTagFilter(v as ChangelogTag | 'all')}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="changelog-tag-filter">
            <SelectValue placeholder={t('admin:changelog.filter.tagPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin:changelog.filter.allTags')}</SelectItem>
            {CHANGELOG_TAG_OPTIONS.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {t(CHANGELOG_TAG_CONFIG[tag].labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(debouncedSearch || tagFilter !== 'all') && (
        <p className="text-sm text-muted-foreground">
          {t('admin:changelog.search.filteredCount', {
            filtered: filteredEntries.length,
            total: items.length,
          })}
        </p>
      )}
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
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {debouncedSearch || tagFilter !== 'all'
                    ? t('admin:changelog.search.noResults')
                    : t('admin:changelog.table.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
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
            {t('admin:pagination.showing', {
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
              data-testid="pagination-previous"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('admin:pagination.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('admin:pagination.pageOf', { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= totalPages}
              data-testid="pagination-next"
            >
              {t('admin:pagination.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
