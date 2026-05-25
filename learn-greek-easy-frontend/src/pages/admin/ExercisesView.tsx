import { useState } from 'react';

import { Plus, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminExercisesSection } from '@/components/admin/exercises/AdminExercisesSection';
import { Button } from '@/components/ui/button';
import { SegControl } from '@/components/ui/seg-control';
import { SidePanel } from '@/components/ui/side-panel';
import { track } from '@/lib/analytics/track';
import { adminAPI } from '@/services/adminAPI';

export default function ExercisesView() {
  const { t } = useTranslation('admin');
  const [modality, setModality] = useState<'listening' | 'reading'>('listening');

  // Generate batch state
  const [generating, setGenerating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // New exercise drawer state
  const [newExerciseOpen, setNewExerciseOpen] = useState(false);

  // Refresh trigger for AdminExercisesSection
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleGenerateBatch() {
    setGenerating(true);
    setBatchError(null);
    try {
      await adminAPI.generateExerciseBatch({ modality, count: 5 });
      setRefreshKey((k) => k + 1);
    } catch {
      setBatchError(t('exercises.errorBanner.title'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="va-page-actions-only mb-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // EXR-73: track batch generate click before API call
            track('admin_exercise_batch_generate_clicked', { endpoint_available: true });
            void handleGenerateBatch();
          }}
          disabled={generating}
        >
          <Wand2 className="size-4" aria-hidden />
          {t('exercises.actions.generateBatch')}
        </Button>
        <Button variant="default" size="sm" onClick={() => setNewExerciseOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t('exercises.actions.newExercise')}
        </Button>
      </div>

      {batchError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {batchError}
        </div>
      )}

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
