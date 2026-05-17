import { useState } from 'react';

import { CheckCircle, Clock, Flag, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminExerciseList } from '@/components/admin/exercises/AdminExerciseList';
import { SegControl } from '@/components/ui/seg-control';
import { StatCard } from '@/components/ui/stat-card';

export default function ExercisesView() {
  const { t } = useTranslation('admin');
  const [modality, setModality] = useState<'listening' | 'reading'>('listening');

  return (
    <div>
      <section className="stat-grid">
        <StatCard
          title={t('exercises.v2.statCards.total.label')}
          n="—"
          sub={t('exercises.v2.statCards.total.sub')}
          tone="cyan"
          icon={<Flag />}
        />
        <StatCard
          title={t('exercises.v2.statCards.approved.label')}
          n="—"
          sub={t('exercises.v2.statCards.approved.sub')}
          tone="green"
          icon={<CheckCircle />}
        />
        <StatCard
          title={t('exercises.v2.statCards.pending.label')}
          n="—"
          sub={t('exercises.v2.statCards.pending.sub')}
          tone="amber"
          icon={<Clock />}
        />
        <StatCard
          title={t('exercises.v2.statCards.bySource.label')}
          n="—"
          sub={t('exercises.v2.statCards.bySource.sub')}
          tone="violet"
          icon={<Layers />}
        />
      </section>

      <SegControl
        options={[
          { value: 'listening', label: t('exercises.v2.modality.listening') },
          { value: 'reading', label: t('exercises.v2.modality.reading') },
        ]}
        value={modality}
        onChange={setModality}
      />

      <AdminExerciseList modality={modality} />
    </div>
  );
}
