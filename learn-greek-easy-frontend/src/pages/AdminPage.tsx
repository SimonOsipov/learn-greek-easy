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
  Crown,
  Database,
  Layers,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AdminFeedbackSection,
  DeckEditModal,
  NewsSourcesSection,
  type DeckEditFormData,
} from '@/components/admin';
import { CultureBadge, type CultureCategory } from '@/components/culture';
import { DeckBadge } from '@/components/decks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  trackAdminDeckDeactivated,
  trackAdminDeckEditCancelled,
  trackAdminDeckEditFailed,
  trackAdminDeckEditOpened,
  trackAdminDeckEditSaved,
  trackAdminDeckPremiumDisabled,
  trackAdminDeckPremiumEnabled,
  trackAdminDeckReactivated,
} from '@/lib/analytics/adminAnalytics';
import { adminAPI } from '@/services/adminAPI';
import type {
  ContentStatsResponse,
  CultureDeckStats,
  CultureDeckUpdatePayload,
  DeckListResponse,
  DeckStats,
  MultilingualName,
  UnifiedDeckItem,
  VocabularyDeckUpdatePayload,
} from '@/services/adminAPI';

/**
 * CEFR level order for sorting decks
 */
const CEFR_LEVEL_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

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
 * Summary card component for displaying a single stat
 */
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  testId?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, testId }) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </CardContent>
  </Card>
);

/**
 * Deck list item component
 */
interface DeckListItemProps {
  deck: DeckStats;
  t: (key: string, options?: { count: number }) => string;
}

const DeckListItem: React.FC<DeckListItemProps> = ({ deck, t }) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <div className="flex items-center gap-3">
      <DeckBadge type="level" level={deck.level} />
      <span className="font-medium">{deck.name}</span>
    </div>
    <span className="text-sm text-muted-foreground">
      {t('deck.cardCount', { count: deck.card_count })}
    </span>
  </div>
);

/**
 * Sort decks by CEFR level (A1 -> C2)
 */
function sortDecksByLevel(decks: DeckStats[]): DeckStats[] {
  return [...decks].sort((a, b) => {
    const levelA = CEFR_LEVEL_ORDER[a.level] ?? 99;
    const levelB = CEFR_LEVEL_ORDER[b.level] ?? 99;
    if (levelA !== levelB) {
      return levelA - levelB;
    }
    // Same level - sort by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get localized name from multilingual object
 */
function getLocalizedName(name: string | MultilingualName, locale: string): string {
  if (typeof name === 'string') {
    return name;
  }
  // Map i18n locale to our supported locales
  const localeMap: Record<string, keyof MultilingualName> = {
    en: 'en',
    el: 'el',
    ru: 'ru',
  };
  const key = localeMap[locale] || 'en';
  return name[key] || name.en || Object.values(name)[0] || '';
}

/**
 * Culture deck list item component
 */
interface CultureDeckListItemProps {
  deck: CultureDeckStats;
  locale: string;
  t: (key: string, options?: { count: number }) => string;
}

const CultureDeckListItem: React.FC<CultureDeckListItemProps> = ({ deck, locale, t }) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <div className="flex items-center gap-3">
      <CultureBadge category={deck.category as CultureCategory} />
      <span className="font-medium">{getLocalizedName(deck.name, locale)}</span>
    </div>
    <span className="text-sm text-muted-foreground">
      {t('deck.questionCount', { count: deck.question_count })}
    </span>
  </div>
);

/**
 * Unified deck list item for All Decks section
 */
interface UnifiedDeckListItemProps {
  deck: UnifiedDeckItem;
  locale: string;
  t: (key: string, options?: { count: number }) => string;
  onEdit: (deck: UnifiedDeckItem) => void;
}

const UnifiedDeckListItem: React.FC<UnifiedDeckListItemProps> = ({ deck, locale, t, onEdit }) => {
  const displayName = getLocalizedName(deck.name, locale);
  const itemCountKey = deck.type === 'vocabulary' ? 'deck.cardCount' : 'deck.questionCount';

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        {deck.type === 'vocabulary' && deck.level && <DeckBadge type="level" level={deck.level} />}
        {deck.type === 'culture' && deck.category && (
          <CultureBadge category={deck.category as CultureCategory} />
        )}
        <span className="font-medium">{displayName}</span>
        {deck.is_premium && (
          <Crown
            className="h-4 w-4 text-amber-500"
            aria-label="Premium deck"
            data-testid={`premium-indicator-${deck.id}`}
          />
        )}
        <Badge variant="outline" className="text-xs">
          {t(`deckTypes.${deck.type}`)}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t(itemCountKey, { count: deck.item_count })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(deck)}
          data-testid={`edit-deck-${deck.id}`}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">{t('actions.edit')}</span>
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
}

export interface AllDecksListHandle {
  refresh: () => void;
}

const AllDecksList = forwardRef<AllDecksListHandle, AllDecksListProps>(
  ({ t, locale, onEditDeck }, ref) => {
    const [deckList, setDeckList] = useState<DeckListResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'vocabulary' | 'culture'>('all');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const debouncedSearch = useDebounce(searchInput, 300);

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
              {deckList.decks.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">{t('states.noDecksFound')}</p>
              ) : (
                <div className="space-y-3">
                  {deckList.decks.map((deck) => (
                    <UnifiedDeckListItem
                      key={deck.id}
                      deck={deck}
                      locale={locale}
                      t={t}
                      onEdit={onEditDeck}
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

  // Deck edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<UnifiedDeckItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
   * Get display name for a deck (handles multilingual names)
   */
  const getDeckDisplayName = (deck: UnifiedDeckItem): string => {
    return typeof deck.name === 'string' ? deck.name : deck.name.en;
  };

  /**
   * Handle opening the edit modal for a deck
   */
  const handleEditDeck = (deck: UnifiedDeckItem) => {
    setSelectedDeck(deck);
    setEditModalOpen(true);

    // Track analytics event
    trackAdminDeckEditOpened({
      deck_id: deck.id,
      deck_type: deck.type,
      deck_name: getDeckDisplayName(deck),
    });
  };

  /**
   * Handle saving deck changes
   */
  const handleSaveDeck = async (data: DeckEditFormData) => {
    if (!selectedDeck) return;

    setIsSaving(true);

    try {
      // Track activation/deactivation changes
      const wasActive = selectedDeck.is_active;
      const isNowActive = data.is_active;

      // Determine which fields changed
      const fieldsChanged: string[] = [];
      const deckName = getDeckDisplayName(selectedDeck);

      if (data.name !== deckName) {
        fieldsChanged.push('name');
      }
      if (data.description !== (selectedDeck as { description?: string | null }).description) {
        fieldsChanged.push('description');
      }
      if (data.is_active !== wasActive) {
        fieldsChanged.push('is_active');
      }
      if ('level' in data && data.level !== selectedDeck.level) {
        fieldsChanged.push('level');
      }
      if ('category' in data && data.category !== selectedDeck.category) {
        fieldsChanged.push('category');
      }
      if (data.is_premium !== selectedDeck.is_premium) {
        fieldsChanged.push('is_premium');
      }

      // Call appropriate API based on deck type
      if (selectedDeck.type === 'vocabulary') {
        const payload: VocabularyDeckUpdatePayload = {
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          is_premium: data.is_premium,
        };
        if ('level' in data) {
          payload.level = data.level;
        }
        await adminAPI.updateVocabularyDeck(selectedDeck.id, payload);
      } else {
        const payload: CultureDeckUpdatePayload = {
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          is_premium: data.is_premium,
        };
        if ('category' in data) {
          payload.category = data.category;
        }
        await adminAPI.updateCultureDeck(selectedDeck.id, payload);
      }

      // Track success analytics
      trackAdminDeckEditSaved({
        deck_id: selectedDeck.id,
        deck_type: selectedDeck.type,
        deck_name: data.name,
        fields_changed: fieldsChanged,
      });

      // Track activation/deactivation status changes
      if (wasActive && !isNowActive) {
        trackAdminDeckDeactivated({
          deck_id: selectedDeck.id,
          deck_type: selectedDeck.type,
          deck_name: data.name,
        });
      } else if (!wasActive && isNowActive) {
        trackAdminDeckReactivated({
          deck_id: selectedDeck.id,
          deck_type: selectedDeck.type,
          deck_name: data.name,
        });
      }

      // Track premium status changes
      const wasPremium = selectedDeck.is_premium ?? false;
      const isNowPremium = data.is_premium ?? false;

      if (!wasPremium && isNowPremium) {
        trackAdminDeckPremiumEnabled({
          deck_id: selectedDeck.id,
          deck_type: selectedDeck.type,
          deck_name: data.name,
        });
      } else if (wasPremium && !isNowPremium) {
        trackAdminDeckPremiumDisabled({
          deck_id: selectedDeck.id,
          deck_type: selectedDeck.type,
          deck_name: data.name,
        });
      }

      // Close modal and refresh deck list
      setEditModalOpen(false);
      setSelectedDeck(null);
      allDecksListRef.current?.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.saveFailed');

      // Track failure analytics
      trackAdminDeckEditFailed({
        deck_id: selectedDeck.id,
        deck_type: selectedDeck.type,
        error_message: errorMessage,
      });

      // Re-throw to let the form handle the error display
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle modal close (track cancel if not saving)
   */
  const handleModalClose = (open: boolean) => {
    if (!open && selectedDeck && !isSaving) {
      // Modal was closed without saving
      trackAdminDeckEditCancelled({
        deck_id: selectedDeck.id,
        deck_type: selectedDeck.type,
      });
    }
    setEditModalOpen(open);
    if (!open) {
      setSelectedDeck(null);
    }
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

  const sortedDecks = sortDecksByLevel(stats.decks);

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

      {/* Vocabulary Deck List */}
      <section aria-labelledby="vocab-decks-heading">
        <Card>
          <CardHeader>
            <CardTitle id="vocab-decks-heading" data-testid="decks-by-level-title">
              {t('sections.decksByLevel')}
            </CardTitle>
            <CardDescription data-testid="decks-by-level-description">
              {t('sections.decksByLevelDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedDecks.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">{t('states.noDecks')}</p>
            ) : (
              <div className="space-y-3">
                {sortedDecks.map((deck) => (
                  <DeckListItem key={deck.id} deck={deck} t={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Culture Deck List */}
      <section aria-labelledby="culture-decks-heading">
        <Card>
          <CardHeader>
            <CardTitle id="culture-decks-heading" data-testid="culture-decks-title">
              {t('sections.cultureDecks')}
            </CardTitle>
            <CardDescription data-testid="culture-decks-description">
              {t('sections.cultureDecksDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.culture_decks.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">{t('states.noCultureDecks')}</p>
            ) : (
              <div className="space-y-3">
                {stats.culture_decks.map((deck) => (
                  <CultureDeckListItem key={deck.id} deck={deck} locale={locale} t={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* All Decks List with Search and Pagination */}
      <section aria-labelledby="all-decks-heading">
        <AllDecksList ref={allDecksListRef} t={t} locale={locale} onEditDeck={handleEditDeck} />
      </section>

      {/* User Feedback Management */}
      <section aria-labelledby="feedback-heading">
        <AdminFeedbackSection />
      </section>

      {/* News Sources Management */}
      <section aria-labelledby="news-sources-heading">
        <NewsSourcesSection />
      </section>

      {/* Deck Edit Modal */}
      <DeckEditModal
        open={editModalOpen}
        onOpenChange={handleModalClose}
        deck={selectedDeck}
        onSave={handleSaveDeck}
        isLoading={isSaving}
      />
    </div>
  );
};

export default AdminPage;
