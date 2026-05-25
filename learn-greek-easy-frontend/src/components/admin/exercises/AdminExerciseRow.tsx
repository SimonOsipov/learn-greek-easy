import { BookOpen, ChevronDown, ChevronUp, Headphones, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { AdminExerciseListItem, ExerciseSourceType } from '@/types/situation';

const SOURCE_TYPE_ICONS: Record<ExerciseSourceType, React.ElementType> = {
  description: BookOpen,
  dialog: Headphones,
  picture: Image,
};

interface AdminExerciseRowProps {
  exercise: AdminExerciseListItem;
  isOpen: boolean;
  onToggle: () => void;
}

export function AdminExerciseRow({ exercise, isOpen, onToggle }: AdminExerciseRowProps) {
  const { t } = useTranslation('admin');
  const Icon = SOURCE_TYPE_ICONS[exercise.source_type] ?? BookOpen;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-4 py-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      onClick={onToggle}
      aria-expanded={isOpen}
      data-testid={`admin-exercise-item-${exercise.id}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2">
        {/* Situation name */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{exercise.situation_title_el}</p>
          <p className="truncate text-xs text-muted-foreground">{exercise.situation_title_en}</p>
        </div>
        {/* Badges */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {t(`exercises.filters.source.${exercise.source_type}`)}
          </Badge>
          <Badge variant="outline">{t(`exercises.types.${exercise.exercise_type}`)}</Badge>
          <Badge
            variant={exercise.status === 'approved' ? 'default' : 'secondary'}
            className={
              exercise.status === 'approved'
                ? 'bg-success text-success-foreground hover:bg-success/90'
                : undefined
            }
          >
            {t(`exercises.statuses.${exercise.status}`)}
          </Badge>
          {exercise.source_type === 'description' && exercise.audio_level && (
            <Badge variant="outline">{exercise.audio_level}</Badge>
          )}
          <Badge variant="secondary">
            {t('exercises.row.itemCount', { count: exercise.item_count })}
          </Badge>
        </div>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
