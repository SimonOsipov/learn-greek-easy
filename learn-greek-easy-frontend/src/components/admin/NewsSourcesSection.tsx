// src/components/admin/NewsSourcesSection.tsx

import React, { useCallback, useEffect, useState } from 'react';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { NewsSourceListResponse, NewsSourceResponse } from '@/services/adminAPI';

import { NewsSourceDeleteDialog } from './NewsSourceDeleteDialog';
import { NewsSourceFormDialog } from './NewsSourceFormDialog';

/**
 * Admin section for managing news sources.
 *
 * Features:
 * - Paginated table of news sources
 * - Add new source button
 * - Edit and delete actions per source
 * - Active/inactive status badges
 * - URL displayed as clickable link
 */
export const NewsSourcesSection: React.FC = () => {
  const { t } = useTranslation('admin');
  const { toast } = useToast();

  // Data state
  const [data, setData] = useState<NewsSourceListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<NewsSourceResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch sources
  const fetchSources = useCallback(async () => {
    try {
      setError(null);
      const response = await adminAPI.listNewsSources({ page, page_size: pageSize });
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [page, t]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleRefresh = () => {
    setIsRefetching(true);
    fetchSources();
  };

  const handleAdd = () => {
    setSelectedSource(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (source: NewsSourceResponse) => {
    setSelectedSource(source);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (source: NewsSourceResponse) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setFormDialogOpen(false);
    setSelectedSource(null);
    fetchSources();
  };

  const handleFormClose = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setSelectedSource(null);
    }
  };

  const handleDeleteClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setSelectedSource(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSource) return;

    setIsDeleting(true);
    try {
      await adminAPI.deleteNewsSource(selectedSource.id);
      toast({
        title: t('sources.delete.success.title'),
        description: t('sources.delete.success.message'),
      });
      setDeleteDialogOpen(false);
      setSelectedSource(null);
      fetchSources();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      toast({
        title: t('sources.delete.error.title'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  /**
   * Extract hostname from URL for display
   */
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <>
      <Card data-testid="news-sources-section">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle data-testid="sources-section-title">{t('sources.sectionTitle')}</CardTitle>
              <CardDescription data-testid="sources-section-description">
                {t('sources.sectionDescription')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
                data-testid="sources-refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" onClick={handleAdd} data-testid="sources-add-btn">
                <Plus className="mr-1 h-4 w-4" />
                {t('sources.addSource')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3" data-testid="sources-loading">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Alert variant="destructive" data-testid="sources-error">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('sources.errors.loadingTitle')}</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('actions.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Data */}
          {data && !isLoading && !error && (
            <>
              {data.sources.length === 0 ? (
                <p
                  className="py-8 text-center text-muted-foreground"
                  data-testid="sources-empty-state"
                >
                  {t('sources.states.noSources')}
                </p>
              ) : (
                <Table data-testid="sources-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('sources.table.name')}</TableHead>
                      <TableHead>{t('sources.table.url')}</TableHead>
                      <TableHead>{t('sources.table.status')}</TableHead>
                      <TableHead className="text-right">{t('sources.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sources.map((source) => (
                      <TableRow key={source.id} data-testid={`source-row-${source.id}`}>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            {getHostname(source.url)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={source.is_active ? 'default' : 'secondary'}>
                            {source.is_active ? t('sources.active') : t('sources.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                            data-testid={`edit-source-${source.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">{t('actions.edit')}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(source)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-source-${source.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t('actions.delete')}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {data.total > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t('pagination.showing', {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, data.total),
                      total: data.total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={page === 1}
                      data-testid="sources-pagination-prev"
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
                      data-testid="sources-pagination-next"
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

      {/* Form Dialog (Add/Edit) */}
      <NewsSourceFormDialog
        open={formDialogOpen}
        onOpenChange={handleFormClose}
        source={selectedSource}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <NewsSourceDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteClose}
        source={selectedSource}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </>
  );
};
