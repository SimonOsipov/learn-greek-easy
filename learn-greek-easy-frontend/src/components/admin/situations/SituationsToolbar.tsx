// src/components/admin/situations/SituationsToolbar.tsx

/**
 * SituationsToolbar
 *
 * Filter bar for the admin situations tab. Composes:
 * - Status SegControl
 * - Level SegControl (All / B1 / A2)
 * - Debounced search input (leading Search icon + trailing clear-X)
 * - Sort DropdownMenu
 *
 * Reads all filter state from adminSituationStore. On every change writes back
 * to the store AND to URL via setSearchParams. On mount hydrates the store from
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
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationStatus } from '@/types/situation';

// ---------------------------------------------------------------------------
// Local debounce hook (mirrors NewsToolbar.tsx pattern)
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

type StatusValue = 'all' | 'draft' | 'ready';
type SortValue = 'newest' | 'oldest' | 'draftsFirst';
type LevelValue = 'all' | 'B1' | 'A2';

function statusToSeg(s: SituationStatus | null): StatusValue {
  return s ?? 'all';
}

function segToStatus(v: StatusValue): SituationStatus | null {
  return v === 'all' ? null : v;
}

function levelToSeg(l: 'B1' | 'A2' | null): LevelValue {
  return l ?? 'all';
}

function segToLevel(v: LevelValue): 'B1' | 'A2' | null {
  return v === 'all' ? null : v;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SituationsToolbar() {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    statusFilter,
    levelFilter,
    searchQuery,
    sortMode,
    setStatusFilter,
    setLevelFilter,
    setSearchQuery,
    setSortMode,
  } = useAdminSituationStore();

  const STATUS_OPTIONS: SegOption<StatusValue>[] = [
    { value: 'all', label: t('situations.filters.status.all') },
    { value: 'ready', label: t('situations.filters.status.ready') },
    { value: 'draft', label: t('situations.filters.status.draft') },
  ];

  const LEVEL_OPTIONS: SegOption<LevelValue>[] = [
    { value: 'all', label: t('situations.filters.level.all') },
    { value: 'B1', label: 'B1' },
    { value: 'A2', label: 'A2' },
  ];

  const SORT_LABELS: Record<SortValue, string> = {
    newest: t('situations.filters.sort.newest'),
    oldest: t('situations.filters.sort.oldest'),
    draftsFirst: t('situations.filters.sort.draftsFirst'),
  };

  // Local immediate value for the search input (debounced before writing to store/URL)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebounce(searchInput, 250);

  // ── On mount: hydrate store from URL params (run once) ──────────────────
  useEffect(() => {
    const status = searchParams.get('status') as StatusValue | null;
    const q = searchParams.get('q');
    const sort = searchParams.get('sort') as SortValue | null;
    const level = searchParams.get('level') as LevelValue | null;

    if (status && STATUS_OPTIONS.some((o) => o.value === status)) {
      setStatusFilter(segToStatus(status));
    }
    if (q !== null) {
      setSearchInput(q);
      setSearchQuery(q);
    }
    if (sort && (sort === 'newest' || sort === 'oldest' || sort === 'draftsFirst')) {
      setSortMode(sort);
    }
    if (level && (level === 'B1' || level === 'A2')) {
      setLevelFilter(segToLevel(level));
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

  // ── Status change ────────────────────────────────────────────────────────
  function handleStatusChange(value: StatusValue) {
    setStatusFilter(segToStatus(value));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('status');
        } else {
          next.set('status', value);
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
        if (mode === 'draftsFirst') {
          next.delete('sort');
        } else {
          next.set('sort', mode);
        }
        return next;
      },
      { replace: true }
    );
  }

  // ── Level change ─────────────────────────────────────────────────────────
  function handleLevelChange(value: LevelValue) {
    setLevelFilter(segToLevel(value));
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
      {/* Status filter */}
      <SegControl<StatusValue>
        options={STATUS_OPTIONS}
        value={statusToSeg(statusFilter)}
        onChange={handleStatusChange}
        label={t('situations.filters.status.label')}
      />

      {/* Level filter */}
      <SegControl<LevelValue>
        options={LEVEL_OPTIONS}
        value={levelToSeg(levelFilter)}
        onChange={handleLevelChange}
        label={t('situations.filters.level.label')}
      />

      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-8"
          placeholder={t('situations.filters.search.placeholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="situations-toolbar-search"
        />
        {searchInput !== '' && (
          <button
            type="button"
            aria-label={t('situations.filters.search.clear')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={handleClearSearch}
            data-testid="situations-toolbar-search-clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" data-testid="situations-toolbar-sort-trigger">
            {SORT_LABELS[sortMode as SortValue]}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={sortMode} onValueChange={handleSortChange}>
            <DropdownMenuRadioItem value="newest">
              {t('situations.filters.sort.newest')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">
              {t('situations.filters.sort.oldest')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="draftsFirst">
              {t('situations.filters.sort.draftsFirst')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
