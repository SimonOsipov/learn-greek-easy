// src/features/decks/components/V2DeckPage/WordBrowser.tsx

/**
 * Word Browser component for V2 decks.
 * Displays word entries with search, filter pills, and responsive grid.
 */

import React, { useMemo, useState } from 'react';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { debounce } from '@/lib/utils';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { WordGrid, WordGridSkeleton } from './WordGrid';
import { useWordEntries } from '../../hooks/useWordEntries';

// ============================================
// Types
// ============================================

export type WordFilterStatus = 'all' | 'learned' | 'reviewing' | 'new';

export interface WordBrowserProps {
  /** Deck ID to display words for */
  deckId: string;
  /** Optional className for container */
  className?: string;
}

interface FilterCounts {
  all: number;
  learned: number;
  reviewing: number;
  new: number;
}

// ============================================
// Filter Logic
// ============================================

/**
 * Search word entries by lemma, translation_en, translation_ru, pronunciation.
 * Case-insensitive substring match.
 */
function searchWordEntries(entries: WordEntryResponse[], query: string): WordEntryResponse[] {
  if (!query.trim()) return entries;

  const lowerQuery = query.toLowerCase().trim();

  return entries.filter((entry) => {
    return (
      entry.lemma.toLowerCase().includes(lowerQuery) ||
      entry.translation_en.toLowerCase().includes(lowerQuery) ||
      (entry.translation_ru?.toLowerCase().includes(lowerQuery) ?? false) ||
      (entry.pronunciation?.toLowerCase().includes(lowerQuery) ?? false)
    );
  });
}

/**
 * Calculate filter counts.
 * For V2: Learned=0, Reviewing=0, New=total (all words are new).
 */
function calculateFilterCounts(entries: WordEntryResponse[]): FilterCounts {
  // V2 implementation: All words are "new" since there's no user progress yet
  return {
    all: entries.length,
    learned: 0,
    reviewing: 0,
    new: entries.length,
  };
}

// ============================================
// FilterPills Component
// ============================================

interface FilterPillsProps {
  activeFilter: WordFilterStatus;
  counts: FilterCounts;
  onFilterChange: (filter: WordFilterStatus) => void;
}

const FILTER_OPTIONS: { value: WordFilterStatus; labelKey: string }[] = [
  { value: 'all', labelKey: 'wordBrowser.filters.all' },
  { value: 'learned', labelKey: 'wordBrowser.filters.learned' },
  { value: 'reviewing', labelKey: 'wordBrowser.filters.reviewing' },
  { value: 'new', labelKey: 'wordBrowser.filters.new' },
];

function FilterPills({ activeFilter, counts, onFilterChange }: FilterPillsProps) {
  const { t } = useTranslation('deck');

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('wordBrowser.filterGroup')}>
      {FILTER_OPTIONS.map(({ value, labelKey }) => {
        const count = counts[value];
        const isActive = activeFilter === value;
        // Disable filter if count is 0 (except "all")
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
// WordBrowser Component
// ============================================

/**
 * Main word browser component for V2 decks.
 *
 * Features:
 * - Search input with 300ms debounce
 * - Filter pills (All | Learned | Reviewing | New)
 * - Responsive word grid
 * - Loading skeleton while fetching
 * - Empty state when no matches
 */
export const WordBrowser: React.FC<WordBrowserProps> = ({ deckId, className }) => {
  const { t } = useTranslation('deck');

  // Data fetching
  const { wordEntries, isLoading, error } = useWordEntries({ deckId });

  // Local state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value
  const [activeFilter, setActiveFilter] = useState<WordFilterStatus>('all');

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
  const filteredEntries = useMemo(() => {
    let result = wordEntries;

    // Apply search filter
    result = searchWordEntries(result, searchQuery);

    // Apply status filter (V2: only 'all' and 'new' have entries)
    if (activeFilter === 'learned' || activeFilter === 'reviewing') {
      result = []; // No entries in these categories for V2
    }

    return result;
  }, [wordEntries, searchQuery, activeFilter]);

  // Calculate counts (always from full list, not filtered)
  const filterCounts = useMemo(() => calculateFilterCounts(wordEntries), [wordEntries]);

  // Error state
  if (error) {
    return (
      <EmptyState
        title={t('wordBrowser.errorTitle')}
        description={t('wordBrowser.errorDescription')}
        className={className}
      />
    );
  }

  return (
    <div className={className} data-testid="word-browser">
      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('wordBrowser.searchPlaceholder')}
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-10 pr-10"
            aria-label={t('wordBrowser.searchPlaceholder')}
            data-testid="word-browser-search"
          />
          {searchInput.length > 0 && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('wordBrowser.clearSearch')}
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

        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          {t('wordBrowser.showing', {
            count: filteredEntries.length,
            total: wordEntries.length,
          })}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <WordGridSkeleton count={12} />
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          title={t('wordBrowser.emptyTitle')}
          description={
            searchQuery
              ? t('wordBrowser.emptySearchDescription')
              : t('wordBrowser.emptyFilterDescription')
          }
          action={
            searchQuery
              ? { label: t('wordBrowser.clearSearch'), onClick: handleClearSearch }
              : undefined
          }
        />
      ) : (
        <WordGrid entries={filteredEntries} />
      )}
    </div>
  );
};
