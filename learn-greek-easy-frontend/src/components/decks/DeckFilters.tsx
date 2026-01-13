// /src/components/decks/DeckFilters.tsx

import React, { useMemo, useState } from 'react';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CEFR_LEVEL_OPTIONS } from '@/lib/cefrColors';
import { debounce } from '@/lib/utils';
import type { DeckFilters as DeckFiltersType, DeckLevel, DeckStatus } from '@/types/deck';

import { DeckTypeFilter, type DeckType } from './DeckTypeFilter';

export interface DeckFiltersProps {
  filters: DeckFiltersType;
  onChange: (filters: Partial<DeckFiltersType>) => void;
  onClear: () => void;
  totalDecks: number;
  filteredDecks: number;
  deckType: DeckType;
  onDeckTypeChange: (type: DeckType) => void;
}

const STATUS_OPTIONS: { value: DeckStatus; labelKey: string }[] = [
  { value: 'not-started', labelKey: 'filters.notStarted' },
  { value: 'in-progress', labelKey: 'filters.inProgress' },
  { value: 'completed', labelKey: 'filters.completed' },
];

export const DeckFilters: React.FC<DeckFiltersProps> = ({
  filters,
  onChange,
  onClear,
  totalDecks,
  filteredDecks,
  deckType,
  onDeckTypeChange,
}) => {
  const { t } = useTranslation('deck');
  // Local state for search input (debounced before updating store)
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounced search handler (300ms delay)
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onChange({ search: value });
      }, 300),
    [onChange]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const handleLevelToggle = (level: DeckLevel) => {
    const newLevels = filters.levels.includes(level)
      ? filters.levels.filter((l) => l !== level)
      : [...filters.levels, level];
    onChange({ levels: newLevels });
  };

  const handleStatusToggle = (status: DeckStatus) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ status: newStatuses });
  };

  const handlePremiumToggle = () => {
    onChange({ showPremiumOnly: !filters.showPremiumOnly });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    onClear();
  };

  // Count active filters
  const activeFilterCount =
    filters.levels.length +
    filters.status.length +
    (filters.showPremiumOnly ? 1 : 0) +
    (filters.search.length > 0 ? 1 : 0);

  // Level filter is disabled when culture deck type is selected
  // Culture decks don't have CEFR levels
  const isLevelFilterDisabled = deckType === 'culture';

  return (
    <div className="mb-6 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('filters.searchPlaceholder')}
          value={searchInput}
          onChange={handleSearchChange}
          className="pl-10 pr-10"
          aria-label={t('filters.searchPlaceholder')}
        />
        {searchInput.length > 0 && (
          <button
            onClick={() => {
              setSearchInput('');
              onChange({ search: '' });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Buttons - Stacked Layout */}
      <div className="flex flex-col gap-3">
        {/* Row 0: Deck Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <DeckTypeFilter value={deckType} onChange={onDeckTypeChange} />
        </div>

        {/* Row 1: Level Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-medium ${isLevelFilterDisabled ? 'text-muted-foreground/50' : 'text-foreground'}`}
            title={isLevelFilterDisabled ? t('filters.levelDisabledForCulture') : undefined}
          >
            {t('filters.level')}
          </span>
          {CEFR_LEVEL_OPTIONS.map(({ value, color }) => (
            <Button
              key={value}
              variant={filters.levels.includes(value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLevelToggle(value)}
              disabled={isLevelFilterDisabled}
              className={
                filters.levels.includes(value) ? `${color} text-white hover:opacity-90` : ''
              }
              aria-pressed={filters.levels.includes(value)}
              title={isLevelFilterDisabled ? t('filters.levelDisabledForCulture') : undefined}
            >
              {value}
            </Button>
          ))}
        </div>

        {/* Row 2: Status Filters + Premium + Clear */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{t('filters.status')}</span>
          {STATUS_OPTIONS.map(({ value, labelKey }) => (
            <Button
              key={value}
              variant={filters.status.includes(value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusToggle(value)}
              aria-pressed={filters.status.includes(value)}
            >
              {t(labelKey)}
            </Button>
          ))}

          {/* Premium Filter */}
          <Button
            variant={filters.showPremiumOnly ? 'default' : 'outline'}
            size="sm"
            onClick={handlePremiumToggle}
            className={filters.showPremiumOnly ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}
            aria-pressed={filters.showPremiumOnly}
          >
            {t('filters.premiumOnly')}
          </Button>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              {t('filters.clearAll')} ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Results Counter */}
      <div className="text-sm text-muted-foreground">
        {t('filters.showing', { count: filteredDecks, total: totalDecks })}
      </div>
    </div>
  );
};
