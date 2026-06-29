// src/components/dashboard/FeedFilters.tsx
// The 4-tab segment control (All / Cards / News / Practice) with live counts.
// Plain <button> — no shadcn (cascade trap). CSS from @layer components .db-feed-filter*.

import { useTranslation } from 'react-i18next';

import { tDynamic } from '@/i18n/tDynamic';

import type { FeedFilterKey } from './lib/composeFeed';

interface FeedFiltersProps {
  filter: FeedFilterKey;
  counts: Record<FeedFilterKey, number>;
  onFilter: (key: FeedFilterKey) => void;
}

/** i18n keys for the 4 filter tab labels. */
const FILTER_LABEL_KEYS: Record<FeedFilterKey, string> = {
  all: 'dashboard.feed.filters.all',
  cards: 'dashboard.feed.filters.cards',
  news: 'dashboard.feed.filters.news',
  practice: 'dashboard.feed.filters.practice',
};

const FILTER_KEYS: FeedFilterKey[] = ['all', 'cards', 'news', 'practice'];

export function FeedFilters({ filter, counts, onFilter }: FeedFiltersProps) {
  const { t } = useTranslation('common');
  return (
    <div className="db-feed-filters" data-testid="feed-filters">
      {FILTER_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={filter === k ? 'db-feed-filter is-active' : 'db-feed-filter'}
          onClick={() => onFilter(k)}
          aria-pressed={filter === k}
        >
          {tDynamic(t, FILTER_LABEL_KEYS[k])}
          <span className="db-feed-filter-n">{counts[k] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
