import { useEffect, useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/hooks/useLanguage';
import {
  useAdminSituationStore,
  selectSituations,
  selectIsLoading,
  selectError,
  selectPage,
  selectPageSize,
  selectTotal,
  selectTotalPages,
  selectStatusFilter,
  selectSearchQuery,
  selectIsDeleting,
} from '@/stores/adminSituationStore';
import type {
  SituationDetailResponse,
  SituationListItem,
  SituationStatus,
} from '@/types/situation';

import { SummaryCard } from '../SummaryCard';
import { SITUATION_STATUS_BADGE_CLASSES } from './situationBadges';
import { SituationCreateModal } from './SituationCreateModal';
import { SituationDeleteDialog } from './SituationDeleteDialog';
import { SituationDetailModal } from './SituationDetailModal';

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

const ALL_STATUSES: SituationStatus[] = ['draft', 'partial_ready', 'ready'];

export function SituationsTab() {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const situations = useAdminSituationStore(selectSituations);
  const isLoading = useAdminSituationStore(selectIsLoading);
  const error = useAdminSituationStore(selectError);
  const page = useAdminSituationStore(selectPage);
  const pageSize = useAdminSituationStore(selectPageSize);
  const total = useAdminSituationStore(selectTotal);
  const totalPages = useAdminSituationStore(selectTotalPages);
  const statusFilter = useAdminSituationStore(selectStatusFilter);
  useAdminSituationStore(selectSearchQuery);
  useAdminSituationStore(selectIsDeleting);

  const { fetchSituations, setPage, setStatusFilter, setSearchQuery } = useAdminSituationStore();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSituationId, setSelectedSituationId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [situationToDelete, setSituationToDelete] = useState<
    SituationListItem | SituationDetailResponse | null
  >(null);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  useEffect(() => {
    fetchSituations();
  }, [fetchSituations]);

  const statusCounts = useMemo(() => {
    const counts: Record<SituationStatus, number> = { draft: 0, partial_ready: 0, ready: 0 };
    situations.forEach((s) => {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    });
    return counts;
  }, [situations]);

  const handleRowClick = (e: React.MouseEvent, situation: SituationListItem) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setSelectedSituationId(situation.id);
    setDetailModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, situation: SituationListItem) => {
    e.stopPropagation();
    setSituationToDelete(situation);
    setDeleteDialogOpen(true);
  };

  const handleDetailDelete = (situation: SituationDetailResponse) => {
    setDetailModalOpen(false);
    setSituationToDelete(situation);
    setDeleteDialogOpen(true);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const getLocalizedScenario = (situation: SituationListItem) => {
    if (currentLanguage === 'ru') return situation.scenario_ru;
    return situation.scenario_en;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title={t('situations.stats.total')}
          value={total}
          icon={<Layers className="h-5 w-5 text-muted-foreground" />}
          testId="situation-total-card"
        />
        {ALL_STATUSES.map((status) => (
          <SummaryCard
            key={status}
            title={t(`situations.stats.status.${status}`)}
            value={statusCounts[status]}
            icon={
              <Badge variant="outline" className={`h-5 ${SITUATION_STATUS_BADGE_CLASSES[status]}`}>
                {t(`situations.status.${status}`)}
              </Badge>
            }
            testId={`situation-status-${status}-card`}
          />
        ))}
      </div>

      {/* Main Table Card */}
      <Card data-testid="situation-list-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('situations.title')}</CardTitle>
              <CardDescription>{t('situations.description')}</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              data-testid="situation-create-btn"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('situations.create.title')}
            </Button>
          </div>
          <div className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t('situations.search.placeholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                data-testid="situation-search-input"
                aria-label={t('situations.search.placeholder')}
              />
            </div>
            <Select
              value={statusFilter ?? 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? null : (v as SituationStatus))}
            >
              <SelectTrigger
                className="w-[160px]"
                data-testid="situation-status-filter"
                aria-label={t('situations.filter.allStatuses')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('situations.filter.allStatuses')}</SelectItem>
                {ALL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`situations.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="py-8 text-center text-sm text-destructive">
              {t('situations.fetch.error')}
            </div>
          )}

          {!isLoading && !error && situations.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
              data-testid="situation-empty-state"
            >
              <Layers className="h-10 w-10 opacity-40" />
              <p className="font-medium">{t('situations.empty.title')}</p>
              <p className="text-sm">{t('situations.empty.description')}</p>
            </div>
          )}

          {!isLoading && !error && situations.length > 0 && (
            <div className="space-y-3">
              {situations.map((situation) => (
                <div
                  key={situation.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                  data-testid={`situation-row-${situation.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleRowClick(e, situation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSituationId(situation.id);
                      setDetailModalOpen(true);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="max-w-[400px] truncate font-medium">
                      {getLocalizedScenario(situation)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={SITUATION_STATUS_BADGE_CLASSES[situation.status]}
                        data-testid={`situation-status-badge-${situation.id}`}
                      >
                        {t(`situations.status.${situation.status}`)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          situation.has_dialog_audio
                            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-gray-300/30 bg-gray-100/10 text-gray-400 dark:text-gray-600'
                        }
                      >
                        {t('situations.media.dialogAudio')}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          situation.has_description_audio
                            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-gray-300/30 bg-gray-100/10 text-gray-400 dark:text-gray-600'
                        }
                      >
                        {t('situations.media.descriptionAudio')}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          situation.has_picture
                            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-gray-300/30 bg-gray-100/10 text-gray-400 dark:text-gray-600'
                        }
                      >
                        {t('situations.media.picture')}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteClick(e, situation)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`situation-delete-btn-${situation.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{t('situations.delete.title')}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                  data-testid="situation-pagination-prev"
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
                  data-testid="situation-pagination-next"
                >
                  {t('pagination.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SituationCreateModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <SituationDetailModal
        situationId={selectedSituationId}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onDelete={handleDetailDelete}
      />
      <SituationDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        situation={situationToDelete}
      />
    </div>
  );
}
