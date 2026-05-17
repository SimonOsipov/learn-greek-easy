import { useEffect, useState } from 'react';

import { CheckCircle2, Clock, MessageSquare, Newspaper, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { PageHead } from '@/components/admin/shell/page-head';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { StatCard } from '@/components/ui/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminSituationStore, selectStatsTotals } from '@/stores/adminSituationStore';

import { SituationCreateModal } from './SituationCreateModal';
import { SituationDrawer } from './SituationDrawer';
import { SituationGrid } from './SituationGrid';
import { SituationsToolbar } from './SituationsToolbar';

export function SituationsTab() {
  const { t } = useTranslation('admin');

  // ── Store ─────────────────────────────────────────────────────────────────
  const fetchSituations = useAdminSituationStore((s) => s.fetchSituations);
  const openDrawer = useAdminSituationStore((s) => s.openDrawer);
  const closeDrawer = useAdminSituationStore((s) => s.closeDrawer);
  const { total, ready, draft, exercisesGenerated } = useAdminSituationStore(
    useShallow(selectStatsTotals)
  );

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSituations();
  }, [fetchSituations]);

  // ── URL deep-link plumbing ────────────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  useEffect(() => {
    if (editId) openDrawer(editId);
    else closeDrawer();
  }, [editId, openDrawer, closeDrawer]);

  // ── Local state ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const readyPercent = total > 0 ? Math.round((ready / total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="situations-tab">
      {/* ── Page Head ────────────────────────────────────────────────────── */}
      <PageHead
        breadcrumb={[
          { label: t('inbox.breadcrumb.dashboard') },
          { label: t('situations.pageHead.breadcrumb') },
        ]}
        kicker={<Kicker dot="primary">{t('situations.pageHead.kicker')}</Kicker>}
        title={t('situations.pageHead.title')}
        sub={t('situations.pageHead.subtitle', { total, draft, ready })}
        actions={
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    disabled
                    aria-disabled="true"
                    data-testid="situations-generate-from-news-btn"
                  >
                    <Newspaper className="size-4" aria-hidden="true" />
                    {t('situations.actions.generateFromNews')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('comingSoon')}</TooltipContent>
              </Tooltip>

              <Button
                variant="default"
                onClick={() => setCreateOpen(true)}
                data-testid="situations-new-btn"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('situations.actions.newSituation')}
              </Button>
            </div>
          </TooltipProvider>
        }
      />

      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('situations.stats.totalSituations.title')}
          n={total}
          icon={<MessageSquare />}
          tone="blue"
          sub={t('situations.stats.totalSituations.sub', { total })}
        />
        <StatCard
          title={t('situations.stats.readyToShip.title')}
          n={ready}
          icon={<CheckCircle2 />}
          tone="violet"
          sub={t('situations.stats.readyToShip.sub', { percent: readyPercent, ready, total })}
        />
        <StatCard
          title={t('situations.stats.draftsToFinish.title')}
          n={draft}
          icon={<Clock />}
          tone={draft > 0 ? 'amber' : 'green'}
          sub={
            draft > 0
              ? t('situations.stats.draftsToFinish.subPending', { draft })
              : t('situations.stats.draftsToFinish.subDone')
          }
        />
        <StatCard
          title={t('situations.stats.exercisesGenerated.title')}
          n={exercisesGenerated}
          icon={<Sparkles />}
          tone="cyan"
          sub={t('situations.stats.exercisesGenerated.sub')}
        />
      </div>

      {/* ── Toolbar + Grid ────────────────────────────────────────────────── */}
      <SituationsToolbar />
      <SituationGrid />

      {/* ── Modals / Drawers ─────────────────────────────────────────────── */}
      <SituationCreateModal open={createOpen} onOpenChange={setCreateOpen} />
      <SituationDrawer />
    </div>
  );
}
