// src/pages/AdminPage.tsx

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Plus,
  RefreshCw,
  Rss,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import {
  AdminFeedbackSection,
  AnnouncementsTab,
  ChangelogTab,
  DeckCreateModal,
  type DeckCreateFormData,
  DeckDeleteDialog,
  type DeckType,
  NewsTab,
  SituationsTab,
} from '@/components/admin';
import { DeckDrawer } from '@/components/admin/decks/DeckDrawer';
import { DeckList } from '@/components/admin/decks/DeckList';
import { DeckStats } from '@/components/admin/decks/DeckStats';
import { PageHead, type PageHeadProps } from '@/components/admin/shell/page-head';
import { SectionTabs, type SectionTabItem } from '@/components/admin/shell/section-tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import CardErrorsView from '@/pages/admin/CardErrorsView';
import DashboardView from '@/pages/admin/DashboardView';
import ExercisesView from '@/pages/admin/ExercisesView';
import InboxView from '@/pages/admin/InboxView';
import { adminAPI } from '@/services/adminAPI';
import type {
  ContentStatsResponse,
  CultureDeckCreatePayload,
  DeckListResponse,
  UnifiedDeckItem,
  VocabularyDeckCreatePayload,
} from '@/services/adminAPI';
import { useAdminChangelogStore } from '@/stores/adminChangelogStore';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import { useAdminNewsStore } from '@/stores/adminNewsStore';
import { useAdminSituationStore, selectStatsTotals } from '@/stores/adminSituationStore';
import { useAdminTabCountsStore } from '@/stores/adminTabCountsStore';

import { type AdminTabType, isValidTab } from './admin/types';

import type { TFunction } from 'i18next';

/**
 * Loading skeleton for the admin page
 */
const AdminLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Summary Cards Skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Deck List Skeleton */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

/**
 * Error state component with retry button
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
  t: (key: string) => string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, isRetrying, t }) => (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{t('errors.loadingStats')}</AlertTitle>
    <AlertDescription className="mt-2">
      <p className="mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {t('actions.retrying')}
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('actions.retry')}
          </>
        )}
      </Button>
    </AlertDescription>
  </Alert>
);

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * All Decks List Component
 */
interface AllDecksListProps {
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
}

export interface AllDecksListHandle {
  refresh: () => void;
}

const AllDecksList = forwardRef<AllDecksListHandle, AllDecksListProps>(({ t, locale }, ref) => {
  const [, setSearchParams] = useSearchParams();
  const [deckList, setDeckList] = useState<DeckListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vocabulary' | 'culture'>('all');
  const [hideDeactivated, setHideDeactivated] = useState<boolean>(
    () => localStorage.getItem('admin.deckList.hideDeactivated') === 'true'
  );
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebounce(searchInput, 300);

  const handleHideDeactivatedChange = (checked: boolean) => {
    setHideDeactivated(checked);
    localStorage.setItem('admin.deckList.hideDeactivated', checked.toString());
  };

  // Seam for DKDR-06: writes ?edit=<id> to URL so the drawer can mount.
  const onOpenDrawer = (deck: UnifiedDeckItem) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('edit', deck.id);
      return next;
    });
  };

  const [deckToDelete, setDeckToDelete] = useState<UnifiedDeckItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: {
        page: number;
        page_size: number;
        search?: string;
        type?: 'vocabulary' | 'culture';
      } = {
        page,
        page_size: pageSize,
      };

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }

      const data = await adminAPI.listDecks(params);
      setDeckList(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, t]);

  const handleDeleteConfirm = async () => {
    if (!deckToDelete) return;
    setIsDeleting(true);
    try {
      if (deckToDelete.type === 'vocabulary') {
        await adminAPI.deleteVocabularyDeck(deckToDelete.id);
      } else {
        await adminAPI.deleteCultureDeck(deckToDelete.id);
      }
      setDeleteModalOpen(false);
      setDeckToDelete(null);
      fetchDecks();
      void useAdminTabCountsStore.getState().fetchCounts();
    } catch (_err) {
      // Error handling minimal here; toast patterns will land in a later subtask.
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // Expose refresh method via ref
  useImperativeHandle(
    ref,
    () => ({
      refresh: fetchDecks,
    }),
    [fetchDecks]
  );

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter]);

  const totalPages = deckList ? Math.ceil(deckList.total / pageSize) : 0;

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const displayDecks = deckList
    ? hideDeactivated
      ? deckList.decks.filter((d) => d.is_active)
      : deckList.decks
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle data-testid="all-decks-title">{t('sections.allDecks')}</CardTitle>
        <CardDescription data-testid="all-decks-description">
          {t('sections.allDecksDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and Filter Controls */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('search.placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              data-testid="deck-search-input"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value: 'all' | 'vocabulary' | 'culture') => setTypeFilter(value)}
          >
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="type-filter-select">
              <SelectValue placeholder={t('filter.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.allTypes')}</SelectItem>
              <SelectItem value="vocabulary">{t('filter.vocabulary')}</SelectItem>
              <SelectItem value="culture">{t('filter.culture')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-deactivated"
              checked={hideDeactivated}
              onCheckedChange={handleHideDeactivatedChange}
              data-testid="hide-deactivated-toggle"
            />
            <Label htmlFor="hide-deactivated" className="cursor-pointer whitespace-nowrap text-sm">
              {t('deckList.hideDeactivated')}
            </Label>
          </div>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('errors.loadingDecks')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Page-level empty state: no decks at all (unfiltered) — AC #8 */}
        {!isLoading && !error && deckList?.total === 0 && !searchInput && typeFilter === 'all' && (
          <div className="placeholder-box" data-testid="deck-empty-page">
            No decks yet. Click &apos;Add deck&apos; to create your first.
          </div>
        )}

        {/* Deck List — loading + empty states owned by DeckList */}
        {!error && (
          <DeckList
            decks={displayDecks}
            isLoading={isLoading}
            locale={locale}
            onOpenDrawer={onOpenDrawer}
            onDelete={(d) => {
              setDeckToDelete(d);
              setDeleteModalOpen(true);
            }}
          />
        )}

        {/* Pagination */}
        {!isLoading && !error && deckList && deckList.total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('pagination.showing', {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, deckList.total),
                total: deckList.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={page === 1}
                data-testid="pagination-prev"
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
                data-testid="pagination-next"
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation dialog — mounted here so DeckList can stay presentational */}
        <DeckDeleteDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          deck={deckToDelete}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      </CardContent>
    </Card>
  );
});

AllDecksList.displayName = 'AllDecksList';

// ---------------------------------------------------------------------------
// Page head helper — returns full PageHeadProps for the current tab.
// Centralised so AdminPage owns the one-and-only PageHead per view.
// Exported so unit-tests can exercise the helper without mounting AdminPage.
// ---------------------------------------------------------------------------

export interface PageHeadHandlers {
  onCreateDeck: () => void;
  onNewsNew: () => void;
  onSituationsNew: () => void;
  onChangelogNew: () => void;
  onAnnouncementsNew: () => void;
  onExerciseNew: () => void;
}

export interface PageHeadCounts {
  newsTotal: number;
  newsAudio: number;
  situationsTotal: number;
  situationsDraft: number;
  situationsReady: number;
}

export function pageHeadPropsFor(
  tab: AdminTabType,
  // Accept a generic translation function so tests can pass a simple mock.
  // TFunction<'admin'> is the most precise type but tests pass (key: string) => string.
  t: TFunction<'admin'> | ((key: string, opts?: Record<string, unknown>) => string),
  handlers?: PageHeadHandlers,
  counts?: PageHeadCounts
): PageHeadProps {
  const _handlers: PageHeadHandlers = handlers ?? {
    onCreateDeck: () => {},
    onNewsNew: () => {},
    onSituationsNew: () => {},
    onChangelogNew: () => {},
    onAnnouncementsNew: () => {},
    onExerciseNew: () => {},
  };
  const _counts: PageHeadCounts = counts ?? {
    newsTotal: 0,
    newsAudio: 0,
    situationsTotal: 0,
    situationsDraft: 0,
    situationsReady: 0,
  };

  switch (tab) {
    case 'inbox':
      return {
        breadcrumb: [
          { label: t('inbox.breadcrumb.dashboard') },
          { label: t('inbox.breadcrumb.current') },
        ],
        kicker: <Kicker dot="amber">{t('inbox.kicker')}</Kicker>,
        title: t('inbox.title'),
        sub: t('inbox.sub'),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'dashboard':
      return {
        breadcrumb: [
          { label: t('dashboard.breadcrumb.dashboard') },
          { label: t('dashboard.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('dashboard.kicker')}</Kicker>,
        title: t('dashboard.title'),
        sub: t('dashboard.sub'),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'decks':
      return {
        breadcrumb: [
          { label: t('decks.breadcrumb.dashboard') },
          { label: t('decks.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('decks.kicker')}</Kicker>,
        title: t('decks.title'),
        sub: t('decks.sub'),
        actions: (
          <Button
            variant="default"
            onClick={_handlers.onCreateDeck}
            data-testid="create-deck-button"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('decks.actions.createDeck')}
          </Button>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'news':
      return {
        breadcrumb: [
          { label: t('news.breadcrumb.dashboard') },
          { label: t('news.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('news.kicker')}</Kicker>,
        title: t('news.title'),
        sub: (t as (key: string, opts: Record<string, unknown>) => string)('news.sub', {
          total: _counts.newsTotal,
          audio: _counts.newsAudio,
          pending: _counts.newsTotal - _counts.newsAudio,
        }),
        actions: (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="btn-glass cursor-not-allowed opacity-60"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Rss className="size-4" aria-hidden="true" />
                    {t('news.actions.importRss')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('comingSoon')}</TooltipContent>
              </Tooltip>
              <Button variant="default" onClick={_handlers.onNewsNew} data-testid="news-new-button">
                <Plus className="size-4" aria-hidden="true" />
                {t('news.actions.new')}
              </Button>
            </div>
          </TooltipProvider>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'situations':
      return {
        breadcrumb: [
          { label: t('situations.breadcrumb.dashboard') },
          { label: t('situations.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('situations.kicker')}</Kicker>,
        title: t('situations.title'),
        sub: (t as (key: string, opts: Record<string, unknown>) => string)('situations.sub', {
          total: _counts.situationsTotal,
          draft: _counts.situationsDraft,
          ready: _counts.situationsReady,
        }),
        actions: (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    disabled
                    aria-disabled="true"
                    data-testid="situations-generate-from-news-btn"
                  >
                    <Newspaper className="size-4" aria-hidden="true" />
                    {t('situations.actions.generateFromNews')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('comingSoon')}</TooltipContent>
              </Tooltip>
              <Button
                variant="default"
                onClick={_handlers.onSituationsNew}
                data-testid="situations-new-btn"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('situations.actions.newSituation')}
              </Button>
            </div>
          </TooltipProvider>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'exercises':
      return {
        breadcrumb: [
          { label: t('exercises.breadcrumb.dashboard') },
          { label: t('exercises.breadcrumb.current') },
        ],
        kicker: <Kicker dot="cyan">{t('exercises.kicker')}</Kicker>,
        title: t('exercises.title'),
        sub: t('exercises.sub'),
        actions: (
          <Button
            variant="default"
            onClick={_handlers.onExerciseNew}
            data-testid="exercise-new-button"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('exercises.actions.newExercise')}
          </Button>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'errors':
      return {
        breadcrumb: [
          { label: t('cardErrors.breadcrumb.dashboard') },
          { label: t('cardErrors.breadcrumb.current') },
        ],
        kicker: <Kicker dot="amber">{t('cardErrors.kicker')}</Kicker>,
        title: t('cardErrors.title'),
        sub: t('cardErrors.sub'),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'feedback':
      return {
        breadcrumb: [
          { label: t('feedback.breadcrumb.dashboard') },
          { label: t('feedback.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('feedback.kicker')}</Kicker>,
        title: t('feedback.title'),
        sub: t('feedback.sub'),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'changelog':
      return {
        breadcrumb: [
          { label: t('changelog.breadcrumb.dashboard') },
          { label: t('changelog.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('changelog.kicker')}</Kicker>,
        title: t('changelog.title'),
        sub: t('changelog.sub'),
        actions: (
          <Button
            variant="default"
            onClick={_handlers.onChangelogNew}
            data-testid="changelog-new-button"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('changelog.actions.newEntry')}
          </Button>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    case 'announcements':
      return {
        breadcrumb: [
          { label: t('announcements.breadcrumb.dashboard') },
          { label: t('announcements.breadcrumb.current') },
        ],
        kicker: <Kicker dot="primary">{t('announcements.kicker')}</Kicker>,
        title: t('announcements.title'),
        sub: t('announcements.sub'),
        actions: (
          <Button
            variant="default"
            onClick={_handlers.onAnnouncementsNew}
            data-testid="announcements-new-button"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('announcements.actions.new')}
          </Button>
        ),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };

    default: {
      const _exhaustive: never = tab;
      void _exhaustive;
      return {
        title: t('dashboard.title'),
        sub: t('dashboard.sub'),
        titleTestId: 'admin-title' as const,
        subTestId: 'admin-subtitle' as const,
      };
    }
  }
}

/**
 * Admin Page
 *
 * Displays content statistics for administrators:
 * - Summary cards with total decks and cards counts
 * - Vocabulary deck list sorted by CEFR level with card counts
 * - Culture deck list by category with question counts
 * - All decks searchable list with pagination
 *
 * Requires superuser authentication.
 */
const AdminPage: React.FC = () => {
  const { t, i18n } = useTranslation('admin');
  const [stats, setStats] = useState<ContentStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Tab badge counts from unified endpoint.
  const tabCounts = useAdminTabCountsStore((s) => s.counts);
  const fetchTabCounts = useAdminTabCountsStore((s) => s.fetchCounts);
  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts]);

  // Store selectors for data used in tab content (not tab badges).
  const newsTotal = useAdminNewsStore((s) => s.total);
  const newsAudio = useAdminNewsStore((s) => s.audioCount);
  const {
    total: situationsTotal,
    draft: situationsDraft,
    ready: situationsReady,
  } = useAdminSituationStore(useShallow(selectStatsTotals));
  const openCompose = useAdminChangelogStore((s) => s.openCompose);
  const openExerciseCompose = useAdminExercisesStore((s) => s.openCompose);

  // Top-level tab state — derived from URL (ASHELL-06).
  // URL is the single source of truth; no useState needed, no dual-effect loop.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AdminTabType = isValidTab(tabParam) ? tabParam : 'dashboard';

  const setActiveTab = (tab: AdminTabType) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true }
    );
  };

  // Hoisted create-open state for tabs that previously managed it internally.
  const [newsCreateOpen, setNewsCreateOpen] = useState(false);
  const [situationsCreateOpen, setSituationsCreateOpen] = useState(false);

  // Deck create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Ref for refreshing the deck list
  const allDecksListRef = useRef<AllDecksListHandle>(null);

  const locale = i18n.language;

  // Tab configuration for SectionTabs.
  // Counts come from the unified /admin/tab-counts endpoint.
  const tabsConfig: SectionTabItem[] = [
    { key: 'dashboard', label: t('tabs.dashboard'), count: 0 },
    { key: 'inbox', label: t('tabs.inbox'), count: tabCounts?.inbox ?? 0, tone: 'amber' },
    { key: 'decks', label: t('tabs.decks'), count: tabCounts?.decks ?? 0 },
    { key: 'news', label: t('tabs.news'), count: tabCounts?.news ?? 0 },
    { key: 'situations', label: t('tabs.situations'), count: tabCounts?.situations ?? 0 },
    { key: 'exercises', label: t('tabs.exercises'), count: tabCounts?.exercises ?? 0 },
    {
      key: 'errors',
      label: t('tabs.errors'),
      count: tabCounts?.errors ?? 0,
      hint: t('tabs.errorsHint'),
    },
    { key: 'feedback', label: t('tabs.feedback'), count: tabCounts?.feedback ?? 0 },
    { key: 'changelog', label: t('tabs.changelog'), count: tabCounts?.changelog ?? 0 },
    { key: 'announcements', label: t('tabs.announcements'), count: tabCounts?.announcements ?? 0 },
  ];

  const fetchStats = async () => {
    try {
      setError(null);
      const data = await adminAPI.getContentStats();
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.failed');
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setIsLoading(true);
    fetchStats();
  };

  /**
   * Handle opening the create deck modal
   */
  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
  };

  /**
   * Handle creating a new deck
   */
  const handleCreateDeck = async (type: DeckType, data: DeckCreateFormData) => {
    setIsCreating(true);

    try {
      if (type === 'vocabulary') {
        // VocabularyDeckCreateForm produces trilingual data: name_el, name_en, name_ru, etc.
        // API expects single name field (use name_en as primary)
        const vocabularyData = data as {
          name_en: string;
          name_ru: string;
          description_en?: string;
          description_ru?: string;
          level: 'A1' | 'A2' | 'B1' | 'B2';
          is_premium: boolean;
        };
        const payload: VocabularyDeckCreatePayload = {
          name: vocabularyData.name_en,
          name_en: vocabularyData.name_en,
          name_ru: vocabularyData.name_ru,
          description_en: vocabularyData.description_en || null,
          description_ru: vocabularyData.description_ru || null,
          level: vocabularyData.level,
          is_premium: vocabularyData.is_premium,
          is_system_deck: true,
        };
        await adminAPI.createVocabularyDeck(payload);
      } else {
        // CultureDeckCreateForm produces trilingual data: name_el, name_en, name_ru, etc.
        // API expects same flat format
        const cultureData = data as {
          name_en: string;
          name_ru: string;
          description_en?: string;
          description_ru?: string;
          category: string;
          is_premium: boolean;
        };
        const payload: CultureDeckCreatePayload = {
          name_el: cultureData.name_en,
          name_en: cultureData.name_en,
          name_ru: cultureData.name_ru,
          description_el: cultureData.description_en || null,
          description_en: cultureData.description_en || null,
          description_ru: cultureData.description_ru || null,
          category: cultureData.category,
          is_premium: cultureData.is_premium,
        };
        await adminAPI.createCultureDeck(payload);
      }

      // Show success toast
      toast({
        title: t('toast.deckCreated'),
      });

      // Close modal and refresh deck list
      setCreateModalOpen(false);
      allDecksListRef.current?.refresh();
      fetchStats(); // Refresh stats to update counts
      void useAdminTabCountsStore.getState().fetchCounts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.createFailed');

      // Show error toast
      toast({
        title: t('errors.createFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle create modal close (track cancel if not creating)
   */
  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open);
  };

  // ── Centralised PageHead handlers and counts ─────────────────────────────
  const pageHandlers: PageHeadHandlers = {
    onCreateDeck: handleOpenCreateModal,
    onNewsNew: () => setNewsCreateOpen(true),
    onSituationsNew: () => setSituationsCreateOpen(true),
    onChangelogNew: openCompose,
    onAnnouncementsNew: () =>
      setSearchParams((prev) => {
        prev.set('compose', '1');
        return prev;
      }),
    onExerciseNew: openExerciseCompose,
  };

  const pageCounts: PageHeadCounts = {
    newsTotal,
    newsAudio,
    situationsTotal,
    situationsDraft,
    situationsReady,
  };

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        <PageHead {...pageHeadPropsFor(activeTab, t, pageHandlers, pageCounts)} />
        <SectionTabs tabs={tabsConfig} active={activeTab} onTabChange={setActiveTab} />
        <AdminLoadingSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        <PageHead {...pageHeadPropsFor(activeTab, t, pageHandlers, pageCounts)} />
        <SectionTabs tabs={tabsConfig} active={activeTab} onTabChange={setActiveTab} />
        <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} t={t} />
      </div>
    );
  }

  // Show empty state if no stats
  if (!stats) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        <PageHead {...pageHeadPropsFor(activeTab, t, pageHandlers, pageCounts)} />
        <SectionTabs tabs={tabsConfig} active={activeTab} onTabChange={setActiveTab} />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t('states.noStats')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" data-testid="admin-page">
      <PageHead {...pageHeadPropsFor(activeTab, t, pageHandlers, pageCounts)} />
      <SectionTabs tabs={tabsConfig} active={activeTab} onTabChange={setActiveTab} />

      {/* Decks Tab Content */}
      {activeTab === 'decks' && (
        <>
          {/* Deck Stats 4-up grid */}
          <DeckStats
            totalDecks={stats?.total_decks ?? 0}
            vocabularyCount={stats?.total_vocabulary_decks ?? 0}
            cultureCount={stats?.total_culture_decks ?? 0}
            avgCardsPerDeck={
              stats && stats.total_decks > 0 ? Math.round(stats.total_cards / stats.total_decks) : 0
            }
          />

          {/* All Decks List with Search and Pagination */}
          <section aria-label={t('decks.title')}>
            <AllDecksList ref={allDecksListRef} t={t} locale={locale} />
          </section>

          {/* Deck Drawer — URL-driven, self-controlled */}
          <DeckDrawer />
        </>
      )}

      {/* News Tab Content */}
      {activeTab === 'news' && (
        <section aria-label={t('news.title')}>
          <NewsTab createOpen={newsCreateOpen} onCreateOpenChange={setNewsCreateOpen} />
        </section>
      )}

      {/* Announcements Tab Content */}
      {activeTab === 'announcements' && (
        <section aria-label={t('announcements.title')}>
          <AnnouncementsTab />
        </section>
      )}

      {/* Changelog Tab Content */}
      {activeTab === 'changelog' && (
        <section aria-label={t('changelog.title')}>
          <ChangelogTab />
        </section>
      )}

      {/* Card Errors Tab Content */}
      {activeTab === 'errors' && (
        <section aria-label={t('cardErrors.title')}>
          <CardErrorsView />
        </section>
      )}

      {/* Feedback Tab Content */}
      {activeTab === 'feedback' && (
        <section aria-label={t('feedback.title')}>
          <AdminFeedbackSection />
        </section>
      )}

      {activeTab === 'situations' && (
        <section aria-label={t('situations.title')}>
          <SituationsTab
            createOpen={situationsCreateOpen}
            onCreateOpenChange={setSituationsCreateOpen}
          />
        </section>
      )}

      {activeTab === 'exercises' && (
        <section aria-label={t('exercises.title')}>
          <ExercisesView />
        </section>
      )}

      {activeTab === 'dashboard' && <DashboardView stats={stats} setActiveTab={setActiveTab} />}
      {activeTab === 'inbox' && <InboxView />}

      {/* Deck Create Modal */}
      <DeckCreateModal
        open={createModalOpen}
        onOpenChange={handleCreateModalClose}
        onSubmit={handleCreateDeck}
        isLoading={isCreating}
      />
    </div>
  );
};

export default AdminPage;
