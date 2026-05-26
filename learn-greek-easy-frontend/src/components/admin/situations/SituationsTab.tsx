import { useEffect } from 'react';

import { format } from 'date-fns';
import { CheckCircle2, Clock, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { StatCard } from '@/components/ui/stat-card';
import {
  useAdminSituationStore,
  selectStatsTotals,
  selectFilteredSituations,
} from '@/stores/adminSituationStore';

import { SituationCreateModal } from './SituationCreateModal';
import { SituationDrawer } from './SituationDrawer';
import { SituationGrid } from './SituationGrid';
import { SituationsToolbar } from './SituationsToolbar';

interface SituationsTabProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

export function SituationsTab({ createOpen, onCreateOpenChange }: SituationsTabProps) {
  const { t } = useTranslation('admin');

  // ── Store ─────────────────────────────────────────────────────────────────
  const fetchSituations = useAdminSituationStore((s) => s.fetchSituations);
  const openDrawer = useAdminSituationStore((s) => s.openDrawer);
  const closeDrawer = useAdminSituationStore((s) => s.closeDrawer);
  const { total, ready, draft, exercisesGenerated, totalLast30d, oldestDraftDate } =
    useAdminSituationStore(useShallow(selectStatsTotals));
  const filteredSituations = useAdminSituationStore(useShallow(selectFilteredSituations));

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

  // ── Derived stats ─────────────────────────────────────────────────────────
  const readyPercent = total > 0 ? Math.round((ready / total) * 100) : 0;
  const visibleReady = filteredSituations.filter((s) => s.status === 'ready').length;
  const oldestDraftFormatted = oldestDraftDate
    ? format(new Date(oldestDraftDate), 'd MMM yyyy')
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="situations-tab">
      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('situations.stats.totalSituations.title')}
          n={total}
          icon={<MessageSquare />}
          tone="blue"
          sub={t('situations.stats.totalSituations.subRelative', { n: totalLast30d })}
          footerLabel={t('situations.stats.footerCatalog')}
        />
        <StatCard
          title={t('situations.stats.readyToShip.title')}
          n={ready}
          icon={<CheckCircle2 />}
          tone="violet"
          sub={t('situations.stats.readyToShip.subView', {
            pct: readyPercent,
            visible: visibleReady,
          })}
          footerLabel={t('situations.stats.footerCatalog')}
        />
        <StatCard
          title={t('situations.stats.draftsToFinish.title')}
          n={draft}
          icon={<Clock />}
          tone={draft > 0 ? 'amber' : 'green'}
          sub={
            draft > 0
              ? oldestDraftFormatted
                ? t('situations.stats.draftsToFinish.subOldest', { date: oldestDraftFormatted })
                : t('situations.stats.draftsToFinish.subPending', { draft })
              : t('situations.stats.draftsToFinish.subDone')
          }
          footerLabel={t('situations.stats.footerCatalog')}
        />
        <StatCard
          title={t('situations.stats.exercisesGenerated.title')}
          n={exercisesGenerated}
          icon={<Sparkles />}
          tone="cyan"
          sub={t('situations.stats.exercisesGenerated.sub')}
          footerLabel={t('situations.stats.footerCatalog')}
        />
      </div>

      {/* ── Toolbar + Grid ────────────────────────────────────────────────── */}
      <SituationsToolbar />
      <SituationGrid />

      {/* ── Modals / Drawers ─────────────────────────────────────────────── */}
      <SituationCreateModal open={createOpen} onOpenChange={onCreateOpenChange} />
      <SituationDrawer />
    </div>
  );
}
