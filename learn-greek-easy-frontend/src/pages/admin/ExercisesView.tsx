import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { AdminExercisesSection } from '@/components/admin/exercises/AdminExercisesSection';
import { SegControl } from '@/components/ui/seg-control';
import { SidePanel } from '@/components/ui/side-panel';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';

export default function ExercisesView() {
  const { t } = useTranslation('admin');
  const [modality, setModality] = useState<'listening' | 'reading'>('listening');

  // Refresh trigger for AdminExercisesSection
  const [refreshKey] = useState(0);

  // Drawer state from store (replaces local newExerciseOpen)
  const drawerOpen = useAdminExercisesStore((s) => s.mode === 'compose');
  const closeDrawer = useAdminExercisesStore((s) => s.closeDrawer);

  return (
    <div>
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
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
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
