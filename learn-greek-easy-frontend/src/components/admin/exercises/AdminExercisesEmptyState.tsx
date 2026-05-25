import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';

interface AdminExercisesEmptyStateProps {
  modality: 'listening' | 'reading';
}

export function AdminExercisesEmptyState({ modality: _modality }: AdminExercisesEmptyStateProps) {
  const { t } = useTranslation('admin');

  const source = useAdminExercisesStore((s) => s.source);
  const type = useAdminExercisesStore((s) => s.type);
  const level = useAdminExercisesStore((s) => s.level);
  const status = useAdminExercisesStore((s) => s.status);
  const qDebounced = useAdminExercisesStore((s) => s.qDebounced);

  const hasActiveFilters =
    source !== 'all' || type !== 'all' || level !== 'all' || status !== 'all' || qDebounced !== '';

  return (
    <div
      className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
      data-testid="admin-exercises-empty"
    >
      <Search className="text-fg-3 mb-3 size-10" aria-hidden />
      <p className="text-sm font-medium">{t('exercises.empty.heading')}</p>
      <p className="text-sm">{t('exercises.empty.hint')}</p>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => useAdminExercisesStore.getState().resetFilters()}
        >
          {t('exercises.empty.clearFiltersButton')}
        </Button>
      )}
    </div>
  );
}
