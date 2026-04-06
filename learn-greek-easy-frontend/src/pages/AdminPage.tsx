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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Database,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AdminCardErrorSection,
  AdminFeedbackSection,
  AnnouncementsTab,
  ChangelogTab,
  DeckCreateModal,
  type DeckCreateFormData,
  DeckDeleteDialog,
  DeckDetailModal,
  DeckEditModal,
  type DeckEditFormData,
  type DeckType,
  NewsTab,
  SituationsTab,
  SummaryCard,
} from '@/components/admin';
import { CultureBadge, type CultureCategory } from '@/components/culture';
import { DeckBadge } from '@/components/decks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { toast } from '@/hooks/use-toast';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type {
  ContentStatsResponse,
  CultureDeckCreatePayload,
  CultureDeckUpdatePayload,
  DeckListResponse,
  UnifiedDeckItem,
  VocabularyDeckCreatePayload,
  VocabularyDeckUpdatePayload,
} from '@/services/adminAPI';

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
 * Unified deck list item for All Decks section
 */
interface UnifiedDeckListItemProps {
  deck: UnifiedDeckItem;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onEdit: (deck: UnifiedDeckItem) => void;
  onDelete: (deck: UnifiedDeckItem) => void;
  onViewDetail: (deck: UnifiedDeckItem) => void;
}

const UnifiedDeckListItem: React.FC<UnifiedDeckListItemProps> = ({
  deck,
  locale,
  t,
  onEdit,
  onDelete,
  onViewDetail,
}) => {
  const displayName = getLocalizedDeckName(deck, locale);
  const itemCountKey = deck.type === 'culture' ? 'deck.questionCount' : 'deck.wordCount';

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger view detail if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onViewDetail(deck);
  };

  return (
    <div
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors',
        deck.is_active
          ? 'hover:bg-muted/50'
          : 'border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/20 dark:hover:bg-red-950/30'
      )}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetail(deck);
        }
      }}
      data-testid={`deck-row-${deck.id}`}
    >
      <div className="flex items-center gap-3">
        {deck.type === 'vocabulary' && deck.level && <DeckBadge type="level" level={deck.level} />}
        {deck.type === 'culture' && deck.category && (
          <CultureBadge category={deck.category as CultureCategory} />
        )}
        <div className="flex flex-col">
          <span className="font-medium">{displayName}</span>
          {deck.owner_name && (
            <span className="text-xs text-muted-foreground">
              {t('deck.byOwner', { owner: deck.owner_name })}
            </span>
          )}
        </div>
        {deck.is_premium && (
          <Crown
            className="h-4 w-4 text-amber-500"
            aria-label="Premium deck"
            data-testid={`premium-indicator-${deck.id}`}
          />
        )}
        {!deck.is_active && (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          >
            {t('deck.deactivated')}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {t(`deckTypes.${deck.type}`)}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">
          {t(itemCountKey, { count: deck.item_count })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(deck);
          }}
          data-testid={`edit-deck-${deck.id}`}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">{t('actions.edit')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(deck);
          }}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          data-testid={`delete-deck-${deck.id}`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('actions.delete')}</span>
        </Button>
      </div>
    </div>
  );
};

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
  onEditDeck: (deck: UnifiedDeckItem) => void;
  onDeleteDeck: (deck: UnifiedDeckItem) => void;
  onViewDeckDetail: (deck: UnifiedDeckItem) => void;
  onCreateDeck?: () => void;
}

export interface AllDecksListHandle {
  refresh: () => void;
}

const AllDecksList = forwardRef<AllDecksListHandle, AllDecksListProps>(
  ({ t, locale, onEditDeck, onDeleteDeck, onViewDeckDetail, onCreateDeck }, ref) => {
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle data-testid="all-decks-title">{t('sections.allDecks')}</CardTitle>
              <CardDescription data-testid="all-decks-description">
                {t('sections.allDecksDescription')}
              </CardDescription>
            </div>
            {onCreateDeck && (
              <Button onClick={onCreateDeck} data-testid="create-deck-button">
                <Plus className="mr-2 h-4 w-4" />
                {t('actions.createDeck')}
              </Button>
            )}
          </div>
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
              <Label
                htmlFor="hide-deactivated"
                className="cursor-pointer whitespace-nowrap text-sm"
              >
                {t('deckList.hideDeactivated')}
              </Label>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('errors.loadingDecks')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Deck List */}
          {!isLoading && !error && deckList && (
            <>
              {displayDecks.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">{t('states.noDecksFound')}</p>
              ) : (
                <div className="space-y-3">
                  {displayDecks.map((deck) => (
                    <UnifiedDeckListItem
                      key={deck.id}
                      deck={deck}
                      locale={locale}
                      t={t}
                      onEdit={onEditDeck}
                      onDelete={onDeleteDeck}
                      onViewDetail={onViewDeckDetail}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {deckList.total > 0 && (
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
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);

AllDecksList.displayName = 'AllDecksList';

/**
 * Top-level admin tab type
 */
type AdminTabType =
  | 'decks'
  | 'news'
  | 'announcements'
  | 'changelog'
  | 'cardErrors'
  | 'feedback'
  | 'situations';

const ADMIN_TAB_GROUPS: { key: string; tabs: AdminTabType[] }[] = [
  { key: 'content', tabs: ['decks', 'news', 'situations'] },
  { key: 'reviews', tabs: ['cardErrors', 'feedback'] },
  { key: 'system', tabs: ['changelog', 'announcements'] },
];

const getGroupForTab = (tab: AdminTabType): string | undefined =>
  ADMIN_TAB_GROUPS.find((g) => g.tabs.includes(tab))?.key;

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

  // Top-level tab state
  const [activeTab, setActiveTab] = useState<AdminTabType>('decks');

  // Deck edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<UnifiedDeckItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deck create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Deck delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<UnifiedDeckItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deck detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailDeck, setDetailDeck] = useState<UnifiedDeckItem | null>(null);

  // Ref for refreshing the deck list
  const allDecksListRef = useRef<AllDecksListHandle>(null);

  const locale = i18n.language;

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
   * Handle opening the edit modal for a deck
   */
  const handleEditDeck = (deck: UnifiedDeckItem) => {
    setSelectedDeck(deck);
    setEditModalOpen(true);
  };

  /**
   * Handle saving deck changes
   */
  const handleSaveDeck = async (data: DeckEditFormData) => {
    if (!selectedDeck) return;

    setIsSaving(true);

    try {
      // Call appropriate API based on deck type
      // Forms produce trilingual data (name_el, name_en, name_ru, etc.)
      // API expects single name/description fields (uses name_en as primary)
      if (selectedDeck.type === 'vocabulary') {
        const formData = data as {
          name_en?: string;
          name_ru?: string;
          description_en?: string;
          description_ru?: string;
          level?: 'A1' | 'A2' | 'B1' | 'B2';
          is_active: boolean;
          is_premium: boolean;
        };
        const payload: VocabularyDeckUpdatePayload = {
          name_en: formData.name_en || '',
          name_ru: formData.name_ru || '',
          description_en: formData.description_en || null,
          description_ru: formData.description_ru || null,
          is_active: formData.is_active,
          is_premium: formData.is_premium,
        };
        if (formData.level) {
          payload.level = formData.level;
        }
        await adminAPI.updateVocabularyDeck(selectedDeck.id, payload);
      } else {
        const formData = data as {
          name_en?: string;
          name_ru?: string;
          description_en?: string;
          description_ru?: string;
          category?: string;
          is_active: boolean;
          is_premium: boolean;
        };
        const payload: CultureDeckUpdatePayload = {
          name_en: formData.name_en || '',
          name_ru: formData.name_ru || '',
          description_en: formData.description_en || null,
          description_ru: formData.description_ru || null,
          is_active: formData.is_active,
          is_premium: formData.is_premium,
        };
        if (formData.category) {
          payload.category = formData.category;
        }
        await adminAPI.updateCultureDeck(selectedDeck.id, payload);
      }

      // Close modal and refresh deck list
      setEditModalOpen(false);
      setSelectedDeck(null);
      allDecksListRef.current?.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle uploading a cover image for the selected deck
   */
  const handleUploadCoverImage = async (file: File) => {
    if (!selectedDeck) return;
    if (selectedDeck.type === 'culture') {
      const updated = await adminAPI.uploadCultureDeckCoverImage(selectedDeck.id, file);
      setSelectedDeck((prev) =>
        prev ? { ...prev, cover_image_url: updated.cover_image_url } : null
      );
    } else {
      const updated = await adminAPI.uploadDeckCoverImage(selectedDeck.id, file);
      setSelectedDeck((prev) =>
        prev ? { ...prev, cover_image_url: updated.cover_image_url } : null
      );
    }
  };

  const handleRemoveCoverImage = async () => {
    if (!selectedDeck) return;
    if (selectedDeck.type === 'culture') {
      await adminAPI.deleteCultureDeckCoverImage(selectedDeck.id);
    } else {
      await adminAPI.deleteDeckCoverImage(selectedDeck.id);
    }
    setSelectedDeck((prev) => (prev ? { ...prev, cover_image_url: null } : null));
  };

  /**
   * Handle modal close (track cancel if not saving)
   */
  const handleModalClose = (open: boolean) => {
    setEditModalOpen(open);
    if (!open) {
      setSelectedDeck(null);
    }
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

  /**
   * Handle opening the delete confirmation dialog for a deck
   */
  const handleDeleteDeck = (deck: UnifiedDeckItem) => {
    setDeckToDelete(deck);
    setDeleteModalOpen(true);
  };

  /**
   * Handle confirming deck deletion
   */
  const handleConfirmDelete = async () => {
    if (!deckToDelete) return;

    setIsDeleting(true);

    try {
      // Call appropriate API based on deck type
      if (deckToDelete.type === 'vocabulary') {
        await adminAPI.deleteVocabularyDeck(deckToDelete.id);
      } else {
        await adminAPI.deleteCultureDeck(deckToDelete.id);
      }

      // Show success toast
      toast({
        title: t('toast.deckDeleted'),
      });

      // Close modal and refresh deck list
      setDeleteModalOpen(false);
      setDeckToDelete(null);
      allDecksListRef.current?.refresh();
      fetchStats(); // Refresh stats to update counts
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('deckDelete.error');

      // Show error toast
      toast({
        title: t('deckDelete.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle delete modal close (track cancel if not deleting)
   */
  const handleDeleteModalClose = (open: boolean) => {
    setDeleteModalOpen(open);
    if (!open) {
      setDeckToDelete(null);
    }
  };

  /**
   * Handle opening the deck detail modal
   */
  const handleViewDeckDetail = (deck: UnifiedDeckItem) => {
    setDetailDeck(deck);
    setDetailModalOpen(true);
  };

  /**
   * Handle closing the deck detail modal
   */
  const handleDetailModalClose = (open: boolean) => {
    setDetailModalOpen(open);
    if (!open) {
      setDetailDeck(null);
    }
  };

  /**
   * Handle item deleted from deck detail modal
   * Refreshes deck list and stats to update counts
   */
  const handleItemDeleted = () => {
    allDecksListRef.current?.refresh();
    fetchStats();
  };

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-foreground md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
        <AdminLoadingSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-foreground md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
        <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} t={t} />
      </div>
    );
  }

  // Show empty state if no stats
  if (!stats) {
    return (
      <div className="space-y-6 pb-8" data-testid="admin-page">
        {/* Page Header */}
        <div>
          <h1
            className="text-2xl font-semibold text-foreground md:text-3xl"
            data-testid="admin-title"
          >
            {t('page.title')}
          </h1>
          <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
            {t('page.subtitle')}
          </p>
        </div>
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
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="admin-title"
        >
          {t('page.title')}
        </h1>
        <p className="mt-2 text-muted-foreground" data-testid="admin-subtitle">
          {t('page.subtitle')}
        </p>
      </div>

      {/* Top-Level Tab Switcher */}
      <div className="flex flex-wrap gap-2" data-testid="admin-tab-switcher">
        {ADMIN_TAB_GROUPS.map((group) => {
          const activeGroup = getGroupForTab(activeTab);
          const isActive = activeGroup === group.key;
          const activeTabInGroup = isActive ? activeTab : undefined;
          const label = activeTabInGroup
            ? t(`tabs.${activeTabInGroup}`)
            : t(`tabs.groups.${group.key}`);
          return (
            <DropdownMenu key={group.key}>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid={`admin-group-${group.key}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90'
                      : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {label}
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {group.tabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab}
                    data-testid={`admin-tab-${tab}`}
                    onSelect={() => setActiveTab(tab)}
                    className={cn(activeTab === tab && 'font-medium')}
                  >
                    {t(`tabs.${tab}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>

      {/* Decks Tab Content */}
      {activeTab === 'decks' && (
        <>
          {/* Summary Cards */}
          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="sr-only">
              {t('sections.contentSummary')}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryCard
                title={t('stats.totalDecks')}
                value={stats.total_decks}
                icon={<Layers className="h-5 w-5 text-muted-foreground" />}
                testId="total-decks-card"
              />
              <SummaryCard
                title={t('stats.totalCards')}
                value={stats.total_cards}
                icon={<Database className="h-5 w-5 text-muted-foreground" />}
                testId="total-cards-card"
              />
            </div>
          </section>

          {/* All Decks List with Search and Pagination */}
          <section aria-labelledby="all-decks-heading">
            <AllDecksList
              ref={allDecksListRef}
              t={t}
              locale={locale}
              onEditDeck={handleEditDeck}
              onDeleteDeck={handleDeleteDeck}
              onViewDeckDetail={handleViewDeckDetail}
              onCreateDeck={handleOpenCreateModal}
            />
          </section>
        </>
      )}

      {/* News Tab Content */}
      {activeTab === 'news' && (
        <section aria-labelledby="news-heading">
          <NewsTab />
        </section>
      )}

      {/* Announcements Tab Content */}
      {activeTab === 'announcements' && (
        <section aria-labelledby="announcements-heading">
          <AnnouncementsTab />
        </section>
      )}

      {/* Changelog Tab Content */}
      {activeTab === 'changelog' && (
        <section aria-labelledby="changelog-heading">
          <h2 id="changelog-heading" className="sr-only">
            {t('admin:tabs.changelog')}
          </h2>
          <ChangelogTab />
        </section>
      )}

      {/* Card Errors Tab Content */}
      {activeTab === 'cardErrors' && (
        <section aria-labelledby="card-errors-heading">
          <h2 id="card-errors-heading" className="sr-only">
            {t('tabs.cardErrors')}
          </h2>
          <AdminCardErrorSection />
        </section>
      )}

      {/* Feedback Tab Content */}
      {activeTab === 'feedback' && (
        <section aria-labelledby="feedback-heading">
          <AdminFeedbackSection />
        </section>
      )}

      {activeTab === 'situations' && (
        <section aria-labelledby="situations-heading">
          <h2 id="situations-heading" className="sr-only">
            {t('tabs.situations')}
          </h2>
          <SituationsTab />
        </section>
      )}

      {/* Deck Edit Modal */}
      <DeckEditModal
        open={editModalOpen}
        onOpenChange={handleModalClose}
        deck={selectedDeck}
        onSave={handleSaveDeck}
        isLoading={isSaving}
        onUploadCoverImage={handleUploadCoverImage}
        onRemoveCoverImage={handleRemoveCoverImage}
      />

      {/* Deck Create Modal */}
      <DeckCreateModal
        open={createModalOpen}
        onOpenChange={handleCreateModalClose}
        onSubmit={handleCreateDeck}
        isLoading={isCreating}
      />

      {/* Deck Delete Dialog */}
      <DeckDeleteDialog
        open={deleteModalOpen}
        onOpenChange={handleDeleteModalClose}
        deck={deckToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Deck Detail Modal */}
      <DeckDetailModal
        open={detailModalOpen}
        onOpenChange={handleDetailModalClose}
        deck={detailDeck}
        onItemDeleted={handleItemDeleted}
      />
    </div>
  );
};

export default AdminPage;
