// src/components/dashboard/Feed.tsx
// Unified mixed feed container.
// Holds filter state, computes countByFilter + filterFeed, renders FeedFilters + card grid.

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { FeedCard } from './FeedCards';
import { FeedFilters } from './FeedFilters';
import { countByFilter, filterFeed, type FeedFilterKey, type FeedItem } from './lib/composeFeed';

export interface FeedProps {
  items: FeedItem[];
  onOpenDeck: (deckId: string) => void;
  onStartReview: () => void;
  onStartQuick: () => void;
}

export function Feed({ items, onOpenDeck, onStartReview, onStartQuick }: FeedProps) {
  const { t } = useTranslation('common');
  const [filter, setFilter] = useState<FeedFilterKey>('all');

  const counts = countByFilter(items);
  const visible = filterFeed(items, filter);

  return (
    <section className="db-section" data-testid="feed-section">
      {/* Feed head: title + subtitle + filter tabs */}
      <div className="db-feed-head">
        <div>
          {/* D1/D-CEFR: neutral subtitle — no "picked for you" / CEFR personalization */}
          <h2 className="db-feed-h">{t('dashboard.feed.heading')}</h2>
          <p className="db-feed-sub">{t('dashboard.feed.subtitle')}</p>
        </div>
        <FeedFilters filter={filter} counts={counts} onFilter={setFilter} />
      </div>

      {/* Card grid */}
      <div className="db-feed">
        {visible.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onOpenDeck={onOpenDeck}
            onStartReview={onStartReview}
            onStartQuick={onStartQuick}
          />
        ))}
      </div>
    </section>
  );
}
