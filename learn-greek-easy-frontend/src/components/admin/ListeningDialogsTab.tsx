// src/components/admin/ListeningDialogsTab.tsx

/**
 * Listening Dialogs Tab Component
 *
 * Displays a paginated list of listening dialogs with:
 * - Summary cards (total + per CEFR level)
 * - Search and CEFR filter
 * - Status badges with color coding
 * - CEFR level, speaker count, audio duration badges
 * - Edit and Delete actions per row
 * - Delete confirmation dialog
 * - Create button
 * - PostHog analytics
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Plus,
  Search,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import {
  trackAdminDialogCreateClicked,
  trackAdminDialogDeleted,
  trackAdminDialogListViewed,
} from '@/lib/analytics/adminAnalytics';
import type { DeckLevel, DialogStatus, ListeningDialogListItem } from '@/stores/adminDialogStore';
import { useAdminDialogStore } from '@/stores/adminDialogStore';

import { DialogCreateModal } from './DialogCreateModal';
import { DialogDetailModal } from './DialogDetailModal';
import { SummaryCard } from './SummaryCard';

// ============================================================================
// Helpers
// ============================================================================

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

function formatAudioDuration(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CEFR_BADGE_CLASSES: Record<string, string> = {
  A1: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  A2: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  B1: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
  B2: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
};
const CEFR_BADGE_FALLBACK = 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400';
const ALL_CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
  onEdit: (dialog: ListeningDialogListItem) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  lang: string;
}

const DialogRow: React.FC<DialogRowProps> = ({ dialog, onDelete, onEdit, t, lang }) => {
  const scenario = getLocalizedScenario(dialog, lang);

  return (
    <div
      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
      data-testid={`dialog-row-${dialog.id}`}
    >
      {/* Left: Scenario + metadata */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{scenario}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={CEFR_BADGE_CLASSES[dialog.cefr_level] ?? CEFR_BADGE_FALLBACK}
          >
            {dialog.cefr_level}
          </Badge>
          <Badge
            variant="outline"
            className="border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400"
          >
            {dialog.num_speakers} {t('listeningDialogs.columns.speakers').toLowerCase()}
          </Badge>
          {dialog.audio_duration_seconds != null && (
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
            >
              {formatAudioDuration(dialog.audio_duration_seconds)}
            </Badge>
          )}
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

        {/* Edit button */}
        <Button
          variant="ghost"
          size="sm"
          data-testid={`dialog-edit-btn-${dialog.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(dialog);
          }}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">{t('listeningDialogs.columns.edit')}</span>
        </Button>

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
    cefrFilter,
    setCefrFilter,
  } = useAdminDialogStore();

  const [dialogToDelete, setDialogToDelete] = useState<ListeningDialogListItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const hasTrackedView = useRef(false);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    fetchDialogs();
  }, [fetchDialogs]);

  useEffect(() => {
    if (!isLoading && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackAdminDialogListViewed(total);
    }
  }, [isLoading, total]);

  const filteredDialogs = debouncedSearch
    ? dialogs.filter((d) => {
        const q = debouncedSearch.toLowerCase();
        return (
          d.scenario_en.toLowerCase().includes(q) ||
          d.scenario_el.toLowerCase().includes(q) ||
          d.scenario_ru.toLowerCase().includes(q)
        );
      })
    : dialogs;

  const cefrCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of dialogs) c[d.cefr_level] = (c[d.cefr_level] || 0) + 1;
    return c;
  }, [dialogs]);

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
    <>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            title={t('listeningDialogs.stats.total')}
            value={total}
            icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
            testId="dialog-total-card"
          />
          {ALL_CEFR_LEVELS.map((level) => (
            <SummaryCard
              key={level}
              title={t('listeningDialogs.stats.cefrLevel', { level })}
              value={cefrCounts[level] ?? 0}
              icon={
                <Badge
                  variant="outline"
                  className={`h-5 ${CEFR_BADGE_CLASSES[level] ?? CEFR_BADGE_FALLBACK}`}
                >
                  {level}
                </Badge>
              }
              testId={`dialog-cefr-${level}-card`}
            />
          ))}
        </div>

        {/* Main Table Card */}
        <Card data-testid="dialog-list-table">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('listeningDialogs.title')}</CardTitle>
                <CardDescription>{t('listeningDialogs.description')}</CardDescription>
              </div>
              <Button onClick={handleCreateClick} size="sm" data-testid="dialog-create-btn">
                <Plus className="mr-2 h-4 w-4" />
                {t('listeningDialogs.create.button')}
              </Button>
            </div>
            <div className="flex gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={t('listeningDialogs.search.placeholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  data-testid="dialog-search-input"
                />
              </div>
              <Select
                value={cefrFilter ?? 'all'}
                onValueChange={(v) => setCefrFilter(v === 'all' ? null : (v as DeckLevel))}
              >
                <SelectTrigger className="w-[140px]" data-testid="dialog-cefr-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('listeningDialogs.filter.allLevels')}</SelectItem>
                  {ALL_CEFR_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {debouncedSearch && (
              <p className="text-sm text-muted-foreground">
                {t('listeningDialogs.search.filteredCount', {
                  filtered: filteredDialogs.length,
                  total: dialogs.length,
                })}
              </p>
            )}
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

            {/* Empty state — no dialogs at all */}
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
                {/* Search no results */}
                {filteredDialogs.length === 0 && debouncedSearch ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('listeningDialogs.search.noResults')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDialogs.map((dialog) => (
                      <DialogRow
                        key={dialog.id}
                        dialog={dialog}
                        onDelete={handleDeleteClick}
                        onEdit={(d) => {
                          setSelectedDialogId(d.id);
                          setDetailModalOpen(true);
                        }}
                        t={t}
                        lang={currentLanguage}
                      />
                    ))}
                  </div>
                )}

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
        </Card>
      </div>

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
    </>
  );
}
