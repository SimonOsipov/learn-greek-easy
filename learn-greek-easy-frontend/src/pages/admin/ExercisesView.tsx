import { useState } from 'react';

import { CheckCircle, Clock, Flag, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminExercisesSection } from '@/components/admin/exercises/AdminExercisesSection';
import { SegControl } from '@/components/ui/seg-control';
import { StatCard } from '@/components/ui/stat-card';

export default function ExercisesView() {
  const { t } = useTranslation('admin');
  const [modality, setModality] = useState<'listening' | 'reading'>('listening');

  return (
    <div>
      <div className="va-page-actions-only mb-4 flex justify-end gap-2">
        {/* EXR-01: Generate batch button */}
        {/* EXR-02: New exercise button */}
      </div>
      <section className="stat-grid">
        <StatCard
          title={t('exercises.stats.total.label')}
          n="—"
          sub={t('exercises.stats.total.subline', { typeCount: '—' })}
          tone="cyan"
          icon={<Flag />}
        />
        <StatCard
          title={t('exercises.stats.approved.label')}
          n="—"
          sub={t('exercises.stats.approved.subline', { pct: '—' })}
          tone="green"
          icon={<CheckCircle />}
        />
        <StatCard
          title={t('exercises.stats.awaitingReview.label')}
          n="—"
          sub={t('exercises.stats.awaitingReview.subline', { draftCount: '—' })}
          tone="amber"
          icon={<Clock />}
        />
        <StatCard
          title={t('exercises.stats.withAudio.label')}
          n="—"
          sub={t('exercises.stats.withAudio.subline', { missingCount: '—' })}
          tone="violet"
          icon={<Layers />}
        />
      </section>

      <SegControl
        options={[
          { value: 'listening', label: t('exercises.modality.listening') },
          { value: 'reading', label: t('exercises.modality.reading') },
        ]}
        value={modality}
        onChange={setModality}
      />

      <AdminExercisesSection modality={modality} />
    </div>
  );
}
