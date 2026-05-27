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
  const { newsItems, total, audioCount, fetchNewsItems, openDrawer, closeDrawer } =
    useAdminNewsStore();

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="news-tab">
      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card #1 — Total articles */}
        <StatCard
          title={t('news.stats.total')}
          sub={t('news.stats.recentThisWeek', { count: recentCount })}
          n={total}
          icon={<Newspaper />}
          tone="blue"
          bars={[4, 6, 3, 8, 5, 7, 9, 12, 6]}
          barsTestId="stat-bars-total"
        />
        {/* Card #2 — Audio coverage */}
        <StatCard
          title={t('news.stats.withAudio')}
          sub={t('news.stats.audioCoverage', { count: audioCount, total })}
          n={audioCount}
          icon={<Play />}
          tone="violet"
          bars={[10, 12, 11, 12, 13, 12, 12, 13, 12]}
          barsTestId="stat-bars-audio"
        />
        {/* Card #3 — B1 coverage — NADM-13 scope, do not touch */}
        <StatCard
          title={t('news.stats.b1Coverage')}
          n="—"
          icon={<RefreshCcw />}
          tone="amber"
          footerLabel={t('comingSoon')}
        />
        {/* Card #4 — Country (Cyprus only for now)
            TODO(NADM-multi-country): replace literal "CY" and flat bars with
            per-country data once multi-country support lands. */}
        <StatCard
          title={t('news.stats.countries')}
          sub={t('news.stats.countrySub')}
          n="CY"
          icon={<Globe />}
          tone="cyan"
          bars={[3, 3, 3, 3, 3, 3, 3, 3, 3]}
          barsTestId="stat-bars-country"
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
