import { CheckCircle2, Clock, Library, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/ui/stat-card';
import type { AdminExerciseListItem } from '@/types/situation';

interface Props {
  items: AdminExerciseListItem[];
  total: number;
}

/**
 * EXR-19f: bars={[]} hides the .stat-bars row entirely (stat-card.tsx:35-37).
 * AdminExerciseListItem has no `created_at` field, so we always return [] here.
 * TODO: a stats endpoint would be more accurate when page_size < total
 */
function computeBars(_items: AdminExerciseListItem[]): number[] {
  // AdminExerciseListItem does not carry a created_at timestamp field,
  // so there is no data to bucket. Return [] so StatCard hides the bars row.
  return [];
}

export function AdminExercisesStats({ items, total }: Props) {
  const { t } = useTranslation('admin');

  // Counts from current page (acceptable for v1; TODO: dedicated stats endpoint)
  const approvedCount = items.filter((i) => i.status === 'approved').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const draftCount = items.filter((i) => i.status === 'draft').length;
  const withAudioCount = items.filter(
    (i) => i.audio_url !== null && i.audio_url !== undefined
  ).length;
  const missingAudioCount = items.length - withAudioCount;
  const distinctTypeCount = new Set(items.map((i) => i.exercise_type)).size;
  const pct = total > 0 ? Math.round((approvedCount / Math.max(items.length, 1)) * 100) : 0;

  const bars = computeBars(items);

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('exercises.stats.total.label')}
        n={total}
        icon={<Library className="size-4" aria-hidden />}
        tone="blue"
        bars={bars}
        sub={t('exercises.stats.total.subline', { count: distinctTypeCount })}
      />
      <StatCard
        title={t('exercises.stats.approved.label')}
        n={approvedCount}
        icon={<CheckCircle2 className="size-4" aria-hidden />}
        tone="green"
        bars={bars}
        sub={t('exercises.stats.approved.subline', { pct })}
      />
      <StatCard
        title={t('exercises.stats.awaitingReview.label')}
        n={pendingCount}
        icon={<Clock className="size-4" aria-hidden />}
        tone="amber"
        bars={bars}
        sub={t('exercises.stats.awaitingReview.subline', { count: draftCount })}
      />
      <StatCard
        title={t('exercises.stats.withAudio.label')}
        n={withAudioCount}
        icon={<Volume2 className="size-4" aria-hidden />}
        tone="violet"
        bars={bars}
        sub={t('exercises.stats.withAudio.subline', { count: missingAudioCount })}
      />
    </section>
  );
}
