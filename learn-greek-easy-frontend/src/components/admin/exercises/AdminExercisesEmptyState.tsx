import { BookOpen, Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminExercisesEmptyStateProps {
  modality: 'listening' | 'reading';
}

export function AdminExercisesEmptyState({ modality }: AdminExercisesEmptyStateProps) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
      data-testid="admin-exercises-empty"
    >
      {modality === 'listening' ? (
        <Headphones className="h-10 w-10 opacity-40" />
      ) : (
        <BookOpen className="h-10 w-10 opacity-40" />
      )}
      <p className="text-sm">{t(`exercises.empty.${modality}`)}</p>
    </div>
  );
}
