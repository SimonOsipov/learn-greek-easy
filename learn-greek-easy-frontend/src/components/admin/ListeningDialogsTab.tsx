// src/components/admin/ListeningDialogsTab.tsx

/**
 * Listening Dialogs Tab Component
 *
 * Displays a paginated list of listening dialogs with:
 * - Status badges with color coding
 * - CEFR level, speaker count, scenario text
 * - Delete confirmation dialog
 * - Disabled view button with tooltip (coming soon)
 * - Create button (shows coming soon toast)
 * - PostHog analytics
 */

import { useEffect, useRef, useState } from 'react';

import { format } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import {
  trackAdminDialogCreateClicked,
  trackAdminDialogDeleted,
  trackAdminDialogListViewed,
} from '@/lib/analytics/adminAnalytics';
import type { DialogStatus, ListeningDialogListItem } from '@/services/adminAPI';
import { useAdminDialogStore } from '@/stores/adminDialogStore';

import { DialogCreateModal } from './DialogCreateModal';
import { DialogDetailModal } from './DialogDetailModal';

// ============================================================================
// Helpers
// ============================================================================

function getDateLocale(lang: string) {
  switch (lang) {
    case 'el':
      return el;
    case 'ru':
      return ru;
    default:
      return undefined;
  }
}

function getLocalizedScenario(dialog: ListeningDialogListItem, lang: string): string {
  switch (lang) {
    case 'el':
      return dialog.scenario_el;
    case 'ru':
      return dialog.scenario_ru;
    default:
      return dialog.scenario_en;
  }
}

const STATUS_BADGE_CLASSES: Record<DialogStatus, string> = {
  draft: 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400',
  audio_ready: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  exercises_ready: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

// ============================================================================
// Sub-components
// ============================================================================

const DialogTableSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

interface DialogRowProps {
  dialog: ListeningDialogListItem;
  onDelete: (dialog: ListeningDialogListItem) => void;
  onClick?: (dialog: ListeningDialogListItem) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  lang: string;
}

const DialogRow: React.FC<DialogRowProps> = ({ dialog, onDelete, onClick, t, lang }) => {
  const scenario = getLocalizedScenario(dialog, lang);
  const dateLocale = getDateLocale(lang);
  const formattedDate = format(new Date(dialog.created_at), 'dd MMM yyyy', { locale: dateLocale });

  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
      data-testid={`dialog-row-${dialog.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(dialog)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(dialog);
        }
      }}
    >
      {/* Left: Scenario + metadata */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{scenario}</p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {t('listeningDialogs.columns.cefrLevel')}: {dialog.cefr_level}
          </span>
          <span>
            {t('listeningDialogs.columns.speakers')}: {dialog.num_speakers}
          </span>
          <span>
            {t('listeningDialogs.columns.created')}: {formattedDate}
          </span>
        </div>
      </div>

      {/* Right: Status badge + Actions */}
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <Badge
          variant="outline"
          className={STATUS_BADGE_CLASSES[dialog.status]}
          data-testid={`dialog-status-badge-${dialog.id}`}
        >
          {t(`listeningDialogs.status.${dialog.status}`)}
        </Badge>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(dialog);
          }}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          data-testid={`dialog-delete-btn-${dialog.id}`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('listeningDialogs.delete.title')}</span>
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// Main component
// ============================================================================

export function ListeningDialogsTab() {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const {
    dialogs,
    page,
    pageSize,
    total,
    totalPages,
    isLoading,
    isDeleting,
    error,
    fetchDialogs,
    deleteDialog,
    setPage,
    clearError,
  } = useAdminDialogStore();

  const [dialogToDelete, setDialogToDelete] = useState<ListeningDialogListItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    fetchDialogs();
  }, [fetchDialogs]);

  useEffect(() => {
    if (!isLoading && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackAdminDialogListViewed(total);
    }
  }, [isLoading, total]);

  const handleDeleteClick = (dialog: ListeningDialogListItem) => {
    setDialogToDelete(dialog);
  };

  const handleDeleteConfirm = async () => {
    if (!dialogToDelete) return;
    try {
      await deleteDialog(dialogToDelete.id);
      trackAdminDialogDeleted(dialogToDelete.id, dialogToDelete.status);
      toast({ title: t('listeningDialogs.delete.success') });
      setDialogToDelete(null);
    } catch {
      toast({
        title: t('listeningDialogs.delete.error'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateClick = () => {
    trackAdminDialogCreateClicked();
    setCreateModalOpen(true);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  return (
    <Card data-testid="dialog-list-table">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{t('listeningDialogs.title')}</CardTitle>
            <CardDescription>{t('listeningDialogs.description')}</CardDescription>
          </div>
          <Button onClick={handleCreateClick} data-testid="dialog-create-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('listeningDialogs.create.button')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error state */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('listeningDialogs.errors.fetchFailed')}</AlertTitle>
            <AlertDescription>
              {error}
              <Button
                variant="link"
                className="ml-2 h-auto p-0 text-destructive underline"
                onClick={() => {
                  clearError();
                  fetchDialogs();
                }}
              >
                {t('listeningDialogs.errors.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {isLoading && <DialogTableSkeleton />}

        {/* Empty state */}
        {!isLoading && !error && dialogs.length === 0 && (
          <div
            className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
            data-testid="dialog-empty-state"
          >
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="font-medium">{t('listeningDialogs.empty.title')}</p>
            <p className="text-sm">{t('listeningDialogs.empty.description')}</p>
            <Button variant="outline" onClick={handleCreateClick}>
              {t('listeningDialogs.empty.cta')}
            </Button>
          </div>
        )}

        {/* Dialog list */}
        {!isLoading && dialogs.length > 0 && (
          <>
            <div className="space-y-3">
              {dialogs.map((dialog) => (
                <DialogRow
                  key={dialog.id}
                  dialog={dialog}
                  onDelete={handleDeleteClick}
                  onClick={(d) => {
                    setSelectedDialogId(d.id);
                    setDetailModalOpen(true);
                  }}
                  t={t}
                  lang={currentLanguage}
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
                    data-testid="dialog-pagination-prev"
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
                    data-testid="dialog-pagination-next"
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!dialogToDelete} onOpenChange={(open) => !open && setDialogToDelete(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('listeningDialogs.delete.title')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  {dialogToDelete && getLocalizedScenario(dialogToDelete, currentLanguage)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('listeningDialogs.delete.description')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('listeningDialogs.delete.warning')}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              onClick={() => setDialogToDelete(null)}
              disabled={isDeleting}
              data-testid="dialog-delete-cancel"
            >
              {t('listeningDialogs.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              data-testid="dialog-delete-confirm"
            >
              {isDeleting
                ? t('listeningDialogs.delete.deleting')
                : t('listeningDialogs.delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogCreateModal open={createModalOpen} onOpenChange={setCreateModalOpen} />

      <DialogDetailModal
        dialogId={selectedDialogId}
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) setSelectedDialogId(null);
        }}
      />
    </Card>
  );
}
