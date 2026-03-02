// src/components/culture/QuestionBrowser.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  trackCultureQuestionGridViewed,
  trackCultureQuestionGridSearched,
  trackCultureQuestionGridFiltered,
} from '@/lib/analytics';
import { debounce } from '@/lib/utils';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureQuestionBrowseItem, CultureQuestionStatus } from '@/types/culture';

import { QuestionCard, QuestionCardSkeleton } from './QuestionCard';

// ============================================
// Types
// ============================================

export interface QuestionBrowserProps {
  deckId: string;
  totalQuestions: number;
  className?: string;
}

type QuestionFilterStatus = 'all' | 'mastered' | 'review' | 'new';

interface FilterCounts {
  all: number;
  mastered: number;
  review: number;
  new: number;
}

// ============================================
// Filter helpers
// ============================================

function matchesFilter(status: CultureQuestionStatus, filter: QuestionFilterStatus): boolean {
  if (filter === 'all') return true;
  if (filter === 'mastered') return status === 'mastered';
  if (filter === 'review') return status === 'learning' || status === 'review';
  if (filter === 'new') return status === 'new';
  return true;
}

function calculateFilterCounts(questions: CultureQuestionBrowseItem[]): FilterCounts {
  return {
    all: questions.length,
    mastered: questions.filter((q) => q.status === 'mastered').length,
    review: questions.filter((q) => q.status === 'learning' || q.status === 'review').length,
    new: questions.filter((q) => q.status === 'new').length,
  };
}

// ============================================
// FilterPills component
// ============================================

interface FilterPillsProps {
  activeFilter: QuestionFilterStatus;
  counts: FilterCounts;
  onFilterChange: (filter: QuestionFilterStatus) => void;
}

const FILTER_OPTIONS: { value: QuestionFilterStatus; labelKey: string }[] = [
  { value: 'all', labelKey: 'deck.filterAll' },
  { value: 'mastered', labelKey: 'deck.filterMastered' },
  { value: 'review', labelKey: 'deck.filterLearning' },
  { value: 'new', labelKey: 'deck.filterNew' },
];

function FilterPills({ activeFilter, counts, onFilterChange }: FilterPillsProps) {
  const { t } = useTranslation('culture');

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('deck.filterGroup')}>
      {FILTER_OPTIONS.map(({ value, labelKey }) => {
        const count = counts[value];
        const isActive = activeFilter === value;
        const isDisabled = count === 0 && value !== 'all';

        return (
          <Button
            key={value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(value)}
            disabled={isDisabled}
            aria-pressed={isActive}
            className="min-w-[80px]"
          >
            {t(labelKey)} ({count})
          </Button>
        );
      })}
    </div>
  );
}

// ============================================
// QuestionBrowser Component
// ============================================

export const QuestionBrowser: React.FC<QuestionBrowserProps> = ({
  deckId,
  totalQuestions,
  className,
}) => {
  const { t, i18n } = useTranslation('culture');
  const lang = i18n.language;

  // Data fetching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cultureQuestionsBrowse', deckId],
    queryFn: () => cultureDeckAPI.browseQuestions(deckId, { offset: 0, limit: 200 }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const questions = data?.questions ?? [];

  // Local state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuestionFilterStatus>('all');

  // Debounced search handler
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // Filter and search
  const filteredQuestions = useMemo(() => {
    let result = questions;

    // Apply status filter
    if (activeFilter !== 'all') {
      result = result.filter((q) => matchesFilter(q.status, activeFilter));
    }

    // Apply search filter (current locale, case-insensitive)
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      result = result.filter((q) => {
        const text = (q.question_text as Record<string, string>)[lang] || q.question_text.en || '';
        return text.toLowerCase().includes(lowerQuery);
      });
    }

    return result;
  }, [questions, searchQuery, activeFilter, lang]);

  // Calculate counts from full list (not filtered)
  const filterCounts = useMemo(() => calculateFilterCounts(questions), [questions]);

  // Analytics: track grid viewed (fire once when data first loads)
  useEffect(() => {
    if (data) {
      trackCultureQuestionGridViewed({
        deck_id: deckId,
        question_count: data.questions.length,
      });
    }
  }, [data != null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: track search (fire when debounced search query changes, skip empty)
  useEffect(() => {
    if (searchQuery) {
      trackCultureQuestionGridSearched({
        deck_id: deckId,
        query_length: searchQuery.length,
        result_count: filteredQuestions.length,
      });
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: track filter change (skip initial 'all' state)
  const isInitialFilter = useRef(true);
  useEffect(() => {
    if (isInitialFilter.current) {
      isInitialFilter.current = false;
      return;
    }
    trackCultureQuestionGridFiltered({
      deck_id: deckId,
      filter_type: activeFilter,
      result_count: filteredQuestions.length,
    });
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Error state
  if (error) {
    return (
      <div data-testid="question-browser" className={className}>
        <EmptyState
          title={t('deck.loadError')}
          action={{ label: t('deck.retry'), onClick: () => void refetch() }}
        />
      </div>
    );
  }

  // Empty deck state (after loading, no questions at all)
  const isEmptyDeck = !isLoading && questions.length === 0;
  const isEmptySearch = !isLoading && questions.length > 0 && filteredQuestions.length === 0;
  const hasSearchOrFilter = searchQuery.trim() !== '' || activeFilter !== 'all';

  return (
    <div data-testid="question-browser" className={className}>
      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('deck.searchQuestions')}
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-10 pr-10"
            aria-label={t('deck.searchQuestions')}
            data-testid="question-browser-search"
          />
          {searchInput.length > 0 && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('deck.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <FilterPills
          activeFilter={activeFilter}
          counts={filterCounts}
          onFilterChange={setActiveFilter}
        />

        {/* Results Counter */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('deck.showingQuestions', {
              shown: filteredQuestions.length,
              total: totalQuestions,
            })}
          </p>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          data-testid="question-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          className="grid gap-4"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <QuestionCardSkeleton key={i} />
          ))}
        </div>
      ) : isEmptyDeck ? (
        <EmptyState title={t('deck.noQuestions')} />
      ) : isEmptySearch ? (
        <EmptyState
          title={t('deck.noQuestionsSearch')}
          action={
            hasSearchOrFilter
              ? { label: t('deck.clearSearch'), onClick: handleClearSearch }
              : undefined
          }
        />
      ) : (
        <div
          data-testid="question-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          className="grid gap-4"
        >
          {filteredQuestions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      )}
    </div>
  );
};

QuestionBrowser.displayName = 'QuestionBrowser';
