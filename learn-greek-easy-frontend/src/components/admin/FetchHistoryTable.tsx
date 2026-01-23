// src/components/admin/FetchHistoryTable.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { format } from 'date-fns';
import { AlertCircle, Eye, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { FetchHistoryItem, FetchHtmlResponse } from '@/services/adminAPI';

import { DiscoveredArticlesModal } from './DiscoveredArticlesModal';
import { FetchHistoryDeleteDialog } from './FetchHistoryDeleteDialog';
import { HtmlViewerModal } from './HtmlViewerModal';

interface FetchHistoryTableProps {
  sourceId: string;
  refreshTrigger?: number;
}

/**
 * Format bytes to KB with one decimal place
 */
function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Displays fetch history for a news source in a table format.
 *
 * Features:
 * - Shows timestamp, status (success/error badge), size, trigger type
 * - "View HTML" button for successful entries
 * - Shows error message for failed entries
 * - Handles empty state
 * - Opens HtmlViewerModal when viewing HTML
 */
export const FetchHistoryTable: React.FC<FetchHistoryTableProps> = ({
  sourceId,
  refreshTrigger = 0,
}) => {
  const { t } = useTranslation('admin');

  // Data state
  const [items, setItems] = useState<FetchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // HTML viewer modal state
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<FetchHtmlResponse | null>(null);
  const [isLoadingHtml, setIsLoadingHtml] = useState<string | null>(null);

  // Articles modal state
  const [articlesModalOpen, setArticlesModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<FetchHistoryItem | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FetchHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await adminAPI.getFetchHistory(sourceId, 10);
      setItems(response.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const handleViewHtml = async (historyId: string) => {
    setIsLoadingHtml(historyId);
    try {
      const response = await adminAPI.getFetchHtml(historyId);
      setHtmlContent(response);
      setHtmlModalOpen(true);
    } catch {
      // Error silently handled - user can see that HTML is not loaded
    } finally {
      setIsLoadingHtml(null);
    }
  };

  const handleHtmlModalClose = (open: boolean) => {
    setHtmlModalOpen(open);
    if (!open) {
      setHtmlContent(null);
    }
  };

  const handleViewArticles = (item: FetchHistoryItem) => {
    setSelectedHistoryItem(item);
    setArticlesModalOpen(true);
  };

  const handleArticlesModalClose = (open: boolean) => {
    setArticlesModalOpen(open);
    if (!open) {
      setSelectedHistoryItem(null);
    }
  };

  const handleDeleteClick = (item: FetchHistoryItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await adminAPI.deleteFetchHistory(itemToDelete.id);
      toast({
        title: t('sources.history.delete.success.title'),
        description: t('sources.history.delete.success.message'),
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      // Refresh the history list
      fetchHistory();
    } catch {
      toast({
        title: t('sources.history.delete.error.title'),
        description: t('sources.history.delete.error.message'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setItemToDelete(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="fetch-history-loading">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" data-testid="fetch-history-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('sources.errors.loadingTitle')}</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchHistory}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('actions.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <p
        className="py-4 text-center text-sm text-muted-foreground"
        data-testid="fetch-history-empty"
      >
        {t('sources.history.empty')}
      </p>
    );
  }

  return (
    <>
      <Table data-testid="fetch-history-table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('sources.history.columns.timestamp')}</TableHead>
            <TableHead>{t('sources.history.columns.status')}</TableHead>
            <TableHead>{t('sources.history.columns.size')}</TableHead>
            <TableHead>{t('sources.history.columns.trigger')}</TableHead>
            <TableHead className="text-right">{t('sources.table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-testid={`history-row-${item.id}`}>
              <TableCell className="text-sm">{format(new Date(item.fetched_at), 'PPp')}</TableCell>
              <TableCell>
                <Badge
                  variant={item.status === 'success' ? 'default' : 'destructive'}
                  data-testid={`history-status-${item.id}`}
                >
                  {t(`sources.history.status.${item.status}`)}
                </Badge>
                {item.status === 'error' && item.error_message && (
                  <span className="ml-2 text-xs text-destructive" title={item.error_message}>
                    {item.error_message.length > 50
                      ? `${item.error_message.substring(0, 50)}...`
                      : item.error_message}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatBytes(item.html_size_bytes)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {t(`sources.history.trigger.${item.trigger_type}`)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {item.status === 'success' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHtml(item.id)}
                        disabled={isLoadingHtml === item.id}
                        data-testid={`view-html-${item.id}`}
                      >
                        {isLoadingHtml === item.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        <span className="ml-1">{t('sources.history.viewHtml')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewArticles(item)}
                        disabled={item.analysis_status === 'pending'}
                        data-testid={`view-articles-${item.id}`}
                        className={
                          item.analysis_status === 'failed'
                            ? 'text-destructive hover:text-destructive'
                            : ''
                        }
                      >
                        {item.analysis_status === 'pending' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : item.analysis_status === 'failed' ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="ml-1">{t('sources.history.viewArticles')}</span>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(item)}
                    data-testid={`delete-history-${item.id}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* HTML Viewer Modal */}
      <HtmlViewerModal
        open={htmlModalOpen}
        onOpenChange={handleHtmlModalClose}
        htmlContent={htmlContent?.html_content || null}
        fetchedAt={htmlContent?.fetched_at || null}
        finalUrl={htmlContent?.final_url || null}
      />

      {/* Discovered Articles Modal */}
      <DiscoveredArticlesModal
        open={articlesModalOpen}
        onOpenChange={handleArticlesModalClose}
        historyItem={selectedHistoryItem}
        sourceName=""
      />

      {/* Delete Confirmation Dialog */}
      <FetchHistoryDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        item={itemToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
};
