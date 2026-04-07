import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CardStatus, ExerciseQueueItem } from '@/services/exerciseAPI';

interface MultilingualField {
  el: string;
  en: string;
  ru: string;
}

interface SelectCorrectAnswerPayload {
  prompt: MultilingualField;
  options: MultilingualField[];
  correct_answer_index: number;
}

function isSelectCorrectAnswerPayload(payload: unknown): payload is SelectCorrectAnswerPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<SelectCorrectAnswerPayload>;
  return (
    !!value.prompt && Array.isArray(value.options) && typeof value.correct_answer_index === 'number'
  );
}

const STATUS_STYLES: Record<CardStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  learning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  mastered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

interface ExercisePreviewCardProps {
  exercise: ExerciseQueueItem;
}

export function ExercisePreviewCard({ exercise }: ExercisePreviewCardProps) {
  const { t } = useTranslation();

  if (exercise.exercise_type !== 'select_correct_answer') return null;
  const rawPayload = exercise.items[0]?.payload;
  if (!isSelectCorrectAnswerPayload(rawPayload)) return null;
  const payload = rawPayload;

  return (
    <Card data-testid="exercise-preview-card">
      <CardHeader>
        <p className="text-sm font-medium">{payload.prompt.el}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge
            className={cn('border-0', STATUS_STYLES[exercise.status])}
            data-testid="exercise-preview-status"
          >
            {t(`exercise.status.${exercise.status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payload.options.map((option, index) => (
            <div
              key={index}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                index === payload.correct_answer_index
                  ? 'border-l-2 border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-border'
              )}
            >
              {index + 1}. {option.el}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
