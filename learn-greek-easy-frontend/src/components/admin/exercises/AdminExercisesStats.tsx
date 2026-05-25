import { CheckCircle2, Clock, Library, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/ui/stat-card';
import type { AdminExerciseStatsResponse } from '@/types/situation';

interface Props {
  stats: AdminExerciseStatsResponse | null;
  loading: boolean;
}

/**
 * EXR2-24-01: Pure presentation component backed by catalog-wide stats from
 * GET /admin/exercises/stats. Replaces the old page-local items.filter() math
 * that caused "100% of catalog" on every page.
 *
 * EXR-19f: bars={[]} hides the .stat-bars row entirely (stat-card.tsx:35-37).
 */
export function AdminExercisesStats({ stats, loading }: Props) {
  const { t } = useTranslation('admin');

  const total = stats?.total ?? 0;
  const approvedCount = stats?.approved ?? 0;
  const pendingCount = stats?.pending ?? 0;
  const draftCount = stats?.draft ?? 0;
  const withAudioCount = stats?.with_audio ?? 0;
  const missingAudioCount = stats?.missing_audio ?? 0;
  const distinctTypeCount = stats?.distinct_types ?? 0;

  // AC #3: pct uses catalog-wide total as denominator; guard against total === 0.
  const pct = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  // bars={[]} hides the .stat-bars row entirely (no created_at on exercise rows)
  const bars: number[] = [];
  const footerLabel = t('exercises.stats.footer.catalogTotal');

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('exercises.stats.total.label')}
        n={loading ? 0 : total}
        icon={<Library className="size-4" aria-hidden />}
        tone="blue"
        bars={bars}
        sub={t('exercises.stats.total.subline', { count: distinctTypeCount })}
        footerLabel={footerLabel}
      />
      <StatCard
        title={t('exercises.stats.approved.label')}
        n={loading ? 0 : approvedCount}
        icon={<CheckCircle2 className="size-4" aria-hidden />}
        tone="green"
        bars={bars}
        sub={t('exercises.stats.approved.subline', { pct })}
        footerLabel={footerLabel}
      />
      <StatCard
        title={t('exercises.stats.awaitingReview.label')}
        n={loading ? 0 : pendingCount}
        icon={<Clock className="size-4" aria-hidden />}
        tone="amber"
        bars={bars}
        sub={t('exercises.stats.awaitingReview.subline', { count: draftCount })}
        footerLabel={footerLabel}
      />
      <StatCard
        title={t('exercises.stats.withAudio.label')}
        n={loading ? 0 : withAudioCount}
        icon={<Volume2 className="size-4" aria-hidden />}
        tone="violet"
        bars={bars}
        sub={t('exercises.stats.withAudio.subline', { count: missingAudioCount })}
        footerLabel={footerLabel}
      />
    </section>
  );
}
