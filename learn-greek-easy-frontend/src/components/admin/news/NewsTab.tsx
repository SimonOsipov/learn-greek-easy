// src/components/admin/news/NewsTab.tsx

/**
 * NewsTab — NEWS-05 rewrite
 *
 * Integration shell for ADMIN2-07.
 * Renders PageHead + 4-up StatCard grid + NewsToolbar + NewsGrid +
 * NewsItemCreateModal + NewsItemDeleteDialog + NewsEditDrawer (stub).
 *
 * V1 imports (SummaryCard, NewsItemsTable, NewsItemEditModal) are dropped here.
 * V1 source files stay on disk — quarantined by NEWS-09, deleted by ADMIN2-12.
 *
 * URL deep-link plumbing: ?edit=<id> opens the edit drawer via store.
 * NEWS-06: NewsEditDrawer reads drawerItemId from store and clears ?edit= on close.
 */

import React, { useEffect, useState } from 'react';

import { Globe, Newspaper, Play, Plus, RefreshCcw, Rss } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { PageHead } from '@/components/admin/shell/page-head';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { StatCard } from '@/components/ui/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsEditDrawer } from './NewsEditDrawer';
import { NewsGrid } from './NewsGrid';
import { NewsItemCreateModal } from './NewsItemCreateModal';
import { NewsItemDeleteDialog } from './NewsItemDeleteDialog';
import { NewsToolbar } from './NewsToolbar';

/**
 * NewsTab component — ADMIN2-07 shell rewrite
 */
export const NewsTab: React.FC = () => {
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
  const [createOpen, setCreateOpen] = useState(false);
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
      {/* ── Page Head ────────────────────────────────────────────────────── */}
      <PageHead
        breadcrumb={[{ label: t('inbox.breadcrumb.dashboard') }, { label: t('news.title') }]}
        kicker={<Kicker dot="primary">{t('news.kicker')}</Kicker>}
        title={t('news.title')}
        sub={t('news.subtitle', {
          total,
          audio: audioCount,
          pending: total - audioCount,
        })}
        actions={
          <TooltipProvider>
            <div className="flex items-center gap-2">
              {/* Import RSS — gated Coming-soon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="btn-glass cursor-not-allowed opacity-60"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Rss className="size-4" aria-hidden="true" />
                    {t('news.actions.importRss')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('news.comingSoon')}</TooltipContent>
              </Tooltip>

              {/* New article — primary, fully enabled */}
              <Button
                variant="default"
                onClick={() => setCreateOpen(true)}
                data-testid="news-new-button"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('news.actions.new')}
              </Button>
            </div>
          </TooltipProvider>
        }
      />

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
          n="—"
          icon={<RefreshCcw />}
          tone="amber"
          footerLabel={t('news.comingSoon')}
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
      <NewsItemCreateModal open={createOpen} onOpenChange={setCreateOpen} />
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
