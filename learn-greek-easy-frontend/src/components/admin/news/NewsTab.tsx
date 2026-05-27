// src/components/admin/news/NewsTab.tsx

/**
 * NewsTab — NEWS-05 rewrite
 *
 * Integration shell for ADMIN2-07.
 * Renders 4-up StatCard grid + NewsToolbar + NewsGrid +
 * NewsItemCreateModal + NewsItemDeleteDialog + NewsEditDrawer.
 *
 * PageHead is owned by AdminPage (ADMIN2-HEAD).
 * createOpen/onCreateOpenChange are controlled props lifted to AdminPage.
 *
 * URL deep-link plumbing: ?edit=<id> opens the edit drawer via store.
 * NEWS-06: NewsEditDrawer reads drawerItemId from store and clears ?edit= on close.
 */

import React, { useEffect, useState } from 'react';

import { Globe, Newspaper, Play, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { StatCard } from '@/components/ui/stat-card';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsEditDrawer } from './NewsEditDrawer';
import { NewsGrid } from './NewsGrid';
import { NewsItemCreateModal } from './NewsItemCreateModal';
import { NewsItemDeleteDialog } from './NewsItemDeleteDialog';
import { NewsToolbar } from './NewsToolbar';

interface NewsTabProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

/**
 * NewsTab component — ADMIN2-07 shell rewrite
 */
export const NewsTab: React.FC<NewsTabProps> = ({ createOpen, onCreateOpenChange }) => {
  const { t } = useTranslation('admin');

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    newsItems,
    total,
    audioCount,
    b1AudioCount,
    b1PendingRegenCount,
    fetchNewsItems,
    openDrawer,
    closeDrawer,
  } = useAdminNewsStore();

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchNewsItems();
  }, [fetchNewsItems]);

  // ── URL deep-link plumbing ────────────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  useEffect(() => {
    if (editId) openDrawer(editId);
    else closeDrawer();
  }, [editId, openDrawer, closeDrawer]);

  // ── Local state ───────────────────────────────────────────────────────────
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = newsItems.filter((i) => new Date(i.publication_date) >= sevenDaysAgo).length;

  const audioPercent = total > 0 ? Math.round((audioCount / total) * 100) : 0;

  const countryFlagsLine = (
    [
      { flag: '🇨🇾', country: 'cyprus' },
      { flag: '🇬🇷', country: 'greece' },
      { flag: '🌍', country: 'world' },
    ] as const
  )
    .map(({ flag, country }) => {
      const n = newsItems.filter((it) => it.country === country).length;
      return `${flag} ${n}`;
    })
    .join('  ');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="news-tab">
      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('news.stats.total')}
          n={total}
          icon={<Newspaper />}
          tone="blue"
          footerLabel={t('news.stats.recentThisWeek', { count: recentCount })}
        />
        <StatCard
          title={t('news.stats.withAudio')}
          n={audioCount}
          icon={<Play />}
          tone="violet"
          footerLabel={`${audioPercent}% · ${audioCount}/${total}`}
        />
        <StatCard
          title={t('news.stats.b1Coverage')}
          n={b1AudioCount}
          sub={
            <>
              <b>{b1PendingRegenCount}</b> awaiting regen · {b1AudioCount}/{total}
            </>
          }
          icon={<RefreshCcw />}
          tone="amber"
          bars={[8, 9, 10, 11, 10, 11, 12, 12, 11]}
          barsTestId="stat-bars-b1"
        />
        <StatCard
          title={t('news.stats.countries')}
          n={countryFlagsLine}
          icon={<Globe />}
          tone="cyan"
          footerLabel={t('news.stats.allTime')}
        />
      </div>

      {/* ── Toolbar + Grid ────────────────────────────────────────────────── */}
      <NewsToolbar />
      <NewsGrid onRequestDelete={(id) => setDeleteItemId(id)} />

      {/* ── Modals / Drawers ─────────────────────────────────────────────── */}
      <NewsItemCreateModal open={createOpen} onOpenChange={onCreateOpenChange} />
      <NewsItemDeleteDialog
        open={deleteItemId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItemId(null);
        }}
        item={newsItems.find((i) => i.id === deleteItemId) ?? null}
      />
      {/* NEWS-06: NewsEditDrawer reads drawerItemId from store and clears ?edit= on close. */}
      <NewsEditDrawer />
    </div>
  );
};
