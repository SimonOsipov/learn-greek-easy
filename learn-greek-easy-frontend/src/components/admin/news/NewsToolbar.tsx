// src/components/admin/news/NewsToolbar.tsx

/**
 * NewsToolbar
 *
 * Filter bar for the admin news tab. Composes:
 * - Country SegControl
 * - Level SegControl
 * - Debounced search input (leading Search icon + trailing clear-X)
 * - Sort DropdownMenu
 *
 * Reads all filter state from adminNewsStore. On every change writes back to
 * the store AND to URL via setSearchParams. On mount hydrates the store from
 * URL params; empty/default values are omitted from the URL.
 */

import { useEffect, useState } from 'react';

import { ChevronDown, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SegControl, type SegOption } from '@/components/ui/seg-control';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

// ---------------------------------------------------------------------------
// Local debounce hook (mirrors ChangelogTable.tsx pattern)
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------------------------
// Option definitions
// ---------------------------------------------------------------------------

type CountryValue = 'all' | 'cyprus' | 'greece' | 'world';
type LevelValue = 'all' | 'B2' | 'A2' | 'B1';
type SortValue = 'newest' | 'oldest' | 'updated';

const COUNTRY_OPTIONS: SegOption<CountryValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'cyprus', label: '🇨🇾 CY' },
  { value: 'greece', label: '🇬🇷 GR' },
  { value: 'world', label: '🌍 World' },
];

const LEVEL_OPTIONS: SegOption<LevelValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'B2', label: 'B2' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
];

const SORT_LABELS: Record<SortValue, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  updated: 'Recently updated',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewsToolbar() {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    countryFilter,
    levelFilter,
    searchQuery,
    sortMode,
    setCountryFilter,
    setLevelFilter,
    setSearchQuery,
    setSortMode,
  } = useAdminNewsStore();

  // Local immediate value for the search input (debounced before writing to store/URL)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebounce(searchInput, 250);

  // ── On mount: hydrate store from URL params (run once) ──────────────────
  useEffect(() => {
    const country = searchParams.get('country') as CountryValue | null;
    const level = searchParams.get('level') as LevelValue | null;
    const q = searchParams.get('q');
    const sort = searchParams.get('sort') as SortValue | null;

    if (country && COUNTRY_OPTIONS.some((o) => o.value === country)) {
      setCountryFilter(country);
    }
    if (level && LEVEL_OPTIONS.some((o) => o.value === level)) {
      setLevelFilter(level);
    }
    if (q !== null) {
      setSearchInput(q);
      setSearchQuery(q);
    }
    if (sort && (sort === 'newest' || sort === 'oldest' || sort === 'updated')) {
      setSortMode(sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push debounced search to store + URL ────────────────────────────────
  useEffect(() => {
    setSearchQuery(debouncedSearch);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch === '') {
          next.delete('q');
        } else {
          next.set('q', debouncedSearch);
        }
        return next;
      },
      { replace: true }
    );
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Country change ───────────────────────────────────────────────────────
  function handleCountryChange(value: CountryValue) {
    setCountryFilter(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('country');
        } else {
          next.set('country', value);
        }
        return next;
      },
      { replace: true }
    );
  }

  // ── Level change ─────────────────────────────────────────────────────────
  function handleLevelChange(value: LevelValue) {
    setLevelFilter(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('level');
        } else {
          next.set('level', value);
        }
        return next;
      },
      { replace: true }
    );
  }

  // ── Sort change ──────────────────────────────────────────────────────────
  function handleSortChange(value: string) {
    const mode = value as SortValue;
    setSortMode(mode);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === 'newest') {
          next.delete('sort');
        } else {
          next.set('sort', mode);
        }
        return next;
      },
      { replace: true }
    );
  }

  // ── Clear search ─────────────────────────────────────────────────────────
  function handleClearSearch() {
    setSearchInput('');
    setSearchQuery('');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
        return next;
      },
      { replace: true }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Country filter */}
      <SegControl<CountryValue>
        options={COUNTRY_OPTIONS}
        value={countryFilter as CountryValue}
        onChange={handleCountryChange}
        label="Country"
      />

      {/* Level filter */}
      <SegControl<LevelValue>
        options={LEVEL_OPTIONS}
        value={levelFilter}
        onChange={handleLevelChange}
        label="Level"
      />

      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-8"
          placeholder={t('news.toolbar.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="news-toolbar-search"
        />
        {searchInput !== '' && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={handleClearSearch}
            data-testid="news-toolbar-search-clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" data-testid="news-toolbar-sort-trigger">
            {SORT_LABELS[sortMode]}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={sortMode} onValueChange={handleSortChange}>
            <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="updated">Recently updated</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
