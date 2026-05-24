import { useTranslation } from 'react-i18next';

import type { AdminExerciseListItem } from '@/types/situation';

import { ExerciseItemPayload } from './ExerciseItemPayload';

interface AdminExerciseBodyProps {
  exercise: AdminExerciseListItem;
}

export function AdminExerciseBody({ exercise }: AdminExerciseBodyProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="px-4 pb-4">
      {exercise.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('situations.detail.exercises.empty.noExercisesInGroup')}
        </p>
      ) : (
        <div className="space-y-3">
          {[...exercise.items]
            .sort((a, b) => a.item_index - b.item_index)
            .map((item) => (
              <ExerciseItemPayload
                key={item.item_index}
                exerciseType={exercise.exercise_type}
                payload={item.payload as Record<string, unknown>}
                audioUrl={exercise.audio_url ?? undefined}
                readingText={exercise.reading_text ?? undefined}
                anchorPictureUrl={exercise.anchor_picture_url ?? undefined}
                anchorDescriptionText={exercise.anchor_description_text ?? undefined}
              />
            ))}
        </div>
      )}
    </div>
  );
}
