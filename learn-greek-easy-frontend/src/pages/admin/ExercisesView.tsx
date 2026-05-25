import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminExercisesSection } from '@/components/admin/exercises/AdminExercisesSection';
import { Button } from '@/components/ui/button';
import { SegControl } from '@/components/ui/seg-control';
import { SidePanel } from '@/components/ui/side-panel';

export default function ExercisesView() {
  const { t } = useTranslation('admin');
  const [modality, setModality] = useState<'listening' | 'reading'>('listening');

  // New exercise drawer state
  const [newExerciseOpen, setNewExerciseOpen] = useState(false);

  // Refresh trigger for AdminExercisesSection
  const [refreshKey] = useState(0);

  return (
    <div>
      <div className="va-page-actions-only mb-4 flex justify-end gap-2">
        <Button variant="default" size="sm" onClick={() => setNewExerciseOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t('exercises.actions.newExercise')}
        </Button>
      </div>

      <SegControl
        options={[
          { value: 'listening', label: t('exercises.modality.listening') },
          { value: 'reading', label: t('exercises.modality.reading') },
        ]}
        value={modality}
        onChange={setModality}
      />

      <AdminExercisesSection modality={modality} refreshKey={refreshKey} />

      <SidePanel
        open={newExerciseOpen}
        onOpenChange={setNewExerciseOpen}
        size="half"
        title={t('exercises.actions.newExercise')}
      >
        <SidePanel.Header>
          <SidePanel.CloseButton />
          <span className="drawer-title">{t('exercises.actions.newExercise')}</span>
        </SidePanel.Header>
        <SidePanel.Body>
          <p>Drawer body coming soon.</p>
        </SidePanel.Body>
      </SidePanel>
    </div>
  );
}
