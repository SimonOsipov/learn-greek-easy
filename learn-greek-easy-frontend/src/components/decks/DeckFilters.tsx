// /src/components/decks/DeckFilters.tsx

import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { DeckFilters as DeckFiltersType, DeckLevel, DeckStatus } from '@/types/deck';
import { debounce } from '@/lib/utils';

export interface DeckFiltersProps {
  filters: DeckFiltersType;
  onChange: (filters: Partial<DeckFiltersType>) => void;
  onClear: () => void;
  totalDecks: number;
  filteredDecks: number;
}

const LEVEL_OPTIONS: { value: DeckLevel; label: string; color: string }[] = [
  { value: 'A1', label: 'A1 - Beginner', color: 'bg-green-500' },
  { value: 'A2', label: 'A2 - Elementary', color: 'bg-blue-500' },
  { value: 'B1', label: 'B1 - Intermediate', color: 'bg-orange-500' },
  { value: 'B2', label: 'B2 - Upper-Intermediate', color: 'bg-purple-600' },
];

const STATUS_OPTIONS: { value: DeckStatus; label: string }[] = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export const DeckFilters: React.FC<DeckFiltersProps> = ({
  filters,
  onChange,
  onClear,
  totalDecks,
  filteredDecks,
}) => {
  // Local state for search input (debounced before updating store)
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounced search handler (300ms delay)
  const debouncedSearch = useCallback(
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

  return (
    <div className="mb-6 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder="Search decks by name..."
          value={searchInput}
          onChange={handleSearchChange}
          className="pl-10 pr-10"
          aria-label="Search decks"
        />
        {searchInput.length > 0 && (
          <button
            onClick={() => {
              setSearchInput('');
              onChange({ search: '' });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Buttons Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Level Filters */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700">Level:</span>
          {LEVEL_OPTIONS.map(({ value, color }) => (
            <Button
              key={value}
              variant={filters.levels.includes(value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLevelToggle(value)}
              className={
                filters.levels.includes(value)
                  ? `${color} text-white hover:opacity-90`
                  : ''
              }
              aria-pressed={filters.levels.includes(value)}
            >
              {value}
            </Button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {STATUS_OPTIONS.map(({ value, label }) => (
            <Button
              key={value}
              variant={filters.status.includes(value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusToggle(value)}
              aria-pressed={filters.status.includes(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Premium Filter */}
        <Button
          variant={filters.showPremiumOnly ? 'default' : 'outline'}
          size="sm"
          onClick={handlePremiumToggle}
          className={
            filters.showPremiumOnly
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : ''
          }
          aria-pressed={filters.showPremiumOnly}
        >
          Premium Only
        </Button>

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto text-gray-600 hover:text-gray-900"
          >
            <X className="mr-1 h-4 w-4" />
            Clear All ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Results Counter */}
      <div className="text-sm text-gray-600">
        Showing {filteredDecks} of {totalDecks} decks
      </div>
    </div>
  );
};
