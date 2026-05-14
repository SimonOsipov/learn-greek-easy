import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { cn } from '@/lib/utils';
import type { ExerciseType } from '@/types/situation';

export function elText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val !== null && 'el' in val)
    return String((val as Record<string, unknown>).el);
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

const PICTURE_MATCH_TYPES = new Set<ExerciseType>([
  'select_picture_from_description',
  'select_description_from_picture',
]);

function PictureMatchBody({
  anchorPictureUrl,
  anchorDescriptionText,
}: {
  anchorPictureUrl?: string;
  anchorDescriptionText?: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-3 text-sm">
      {anchorPictureUrl && (
        <img
          src={anchorPictureUrl}
          alt={t('adminExercises.pictureMatch.anchorPictureAlt')}
          className="max-h-48 rounded-md border border-border object-cover"
        />
      )}
      {anchorDescriptionText && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 leading-relaxed">
          {anchorDescriptionText}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t('adminExercises.pictureMatch.runtimeNote')}
      </p>
    </div>
  );
}

export function ExerciseItemPayload({
  exerciseType,
  payload,
  audioUrl,
  readingText,
  anchorPictureUrl,
  anchorDescriptionText,
}: {
  exerciseType?: ExerciseType;
  payload: Record<string, unknown>;
  audioUrl?: string;
  readingText?: string;
  anchorPictureUrl?: string;
  anchorDescriptionText?: string;
}) {
  if (exerciseType !== undefined && PICTURE_MATCH_TYPES.has(exerciseType)) {
    return (
      <PictureMatchBody
        anchorPictureUrl={anchorPictureUrl}
        anchorDescriptionText={anchorDescriptionText}
      />
    );
  }

  const questionText = elText(
    payload.prompt ?? payload.question_text ?? payload.question ?? payload.text
  );
  const options = Array.isArray(payload.options) ? payload.options : undefined;
  // Production uses correct_answer_index (0-based), seed data uses correct_option (1-based)
  const correctIndex =
    typeof payload.correct_answer_index === 'number'
      ? payload.correct_answer_index
      : typeof payload.correct_option === 'number'
        ? payload.correct_option - 1
        : undefined;

  return (
    <div className="space-y-3 text-sm">
      {audioUrl && (
        <WaveformPlayer
          audioUrl={audioUrl}
          variant="admin"
          barCount={32}
          showSpeedControl={false}
        />
      )}
      {readingText && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm leading-relaxed">
          {readingText}
        </p>
      )}
      {questionText && <p className="font-medium">{questionText}</p>}
      {options && options.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, idx) => {
            const isCorrect = correctIndex !== undefined && idx === correctIndex;
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-md border px-3 py-2',
                  isCorrect
                    ? 'border-success/50 bg-success/10 font-semibold text-success'
                    : 'border-border text-muted-foreground'
                )}
              >
                {elText(opt)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
