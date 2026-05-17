// src/components/admin/announcements/AnnouncementsToolbar.tsx

/**
 * AnnouncementsToolbar
 *
 * Search + sort controls for the announcement history panel.
 * Purely presentational — all state is lifted to AnnouncementsTab.
 */

import React from 'react';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortKey = 'newest' | 'oldest' | 'rateDesc' | 'rateAsc';

export interface AnnouncementsToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AnnouncementsToolbar: React.FC<AnnouncementsToolbarProps> = ({
  query,
  onQueryChange,
  sort,
  onSortChange,
}) => {
  const { t } = useTranslation('admin');

  return (
    <div className="an-toolbar">
      {/* Search input with prefix icon and clear button */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('announcements.toolbar.searchPlaceholder')}
          className="pl-9 pr-8"
          data-testid="announcements-toolbar-search"
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange('')}
            className="absolute right-2 flex items-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sort select */}
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
        <SelectTrigger
          className="w-[180px]"
          data-testid="announcements-toolbar-sort"
          aria-label={t('announcements.toolbar.sortLabel')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{t('announcements.toolbar.sort.newest')}</SelectItem>
          <SelectItem value="oldest">{t('announcements.toolbar.sort.oldest')}</SelectItem>
          <SelectItem value="rateDesc">{t('announcements.toolbar.sort.rateDesc')}</SelectItem>
          <SelectItem value="rateAsc">{t('announcements.toolbar.sort.rateAsc')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
