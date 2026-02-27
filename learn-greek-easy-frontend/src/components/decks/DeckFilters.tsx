// /src/components/decks/DeckFilters.tsx

import React, { useCallback, useMemo, useState } from 'react';

import { BookOpen, GraduationCap, Layers, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trackDeckFilterChanged } from '@/lib/analytics';
import { CEFR_LEVEL_OPTIONS } from '@/lib/cefrColors';
import { debounce } from '@/lib/utils';
import type { DeckFilters as DeckFiltersType, DeckLevel, DeckStatus } from '@/types/deck';

export type DeckType = 'all' | 'vocabulary' | 'culture';

export interface DeckFiltersProps {
  filters: DeckFiltersType;
  onChange: (filters: Partial<DeckFiltersType>) => void;
  onClear: () => void;
  totalDecks: number;
  filteredDecks: number;
  deckType: DeckType;
  onDeckTypeChange: (type: DeckType) => void;
}

const TYPE_OPTIONS: {
  value: DeckType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { value: 'all', icon: Layers, labelKey: 'filters.typeAll' },
  { value: 'vocabulary', icon: GraduationCap, labelKey: 'filters.typeVocabulary' },
  { value: 'culture', icon: BookOpen, labelKey: 'filters.typeCulture' },
];

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
  const handleTypeChange = useCallback(
    (newType: DeckType) => {
      if (newType === deckType) return;
      trackDeckFilterChanged({ filter_type: newType });
      onDeckTypeChange(newType);
    },
    [deckType, onDeckTypeChange]
  );

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
    debouncedSearch('');
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
    <div className="mb-6 space-y-3">
      {/* Row 1: Search + Counter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
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
              aria-label={t('filters.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
          {t('filters.showing', { count: filteredDecks, total: totalDecks })}
        </span>
      </div>

      {/* Row 2: All filters */}
      <div className="flex flex-wrap items-center gap-2">
        {TYPE_OPTIONS.map(({ value: optValue, icon: Icon, labelKey }) => (
          <Button
            key={optValue}
            variant={deckType === optValue ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeChange(optValue)}
            className="gap-1.5"
            aria-pressed={deckType === optValue}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </Button>
        ))}
        <div className="h-6 w-px bg-border" aria-hidden="true" />
        {CEFR_LEVEL_OPTIONS.map(({ value, color }) => (
          <Button
            key={value}
            variant={filters.levels.includes(value) ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLevelToggle(value)}
            disabled={isLevelFilterDisabled}
            className={filters.levels.includes(value) ? `${color} text-white hover:opacity-90` : ''}
            aria-pressed={filters.levels.includes(value)}
            title={isLevelFilterDisabled ? t('filters.levelDisabledForCulture') : undefined}
          >
            {value}
          </Button>
        ))}
        <div className="h-6 w-px bg-border" aria-hidden="true" />
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
  );
};
