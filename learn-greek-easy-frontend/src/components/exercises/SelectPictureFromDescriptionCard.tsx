import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type {
  ExerciseItemPayload,
  PictureMatchOption,
  SelectPictureFromDescriptionPayload,
} from '@/services/exerciseAPI';

import { PictureOption } from './PictureOption';

interface SelectPictureFromDescriptionCardProps {
  items: ExerciseItemPayload[];
  onAnswer: (selectedIndex: number, correctIndex: number) => void;
  feedbackState: { selectedIndex: number; correctIndex: number } | null;
  disabled: boolean;
  exerciseId: string;
}

function getOptionClasses(
  index: number,
  feedbackState: { selectedIndex: number; correctIndex: number } | null,
  disabled: boolean
): string {
  const base =
    'relative w-full overflow-hidden rounded-lg border-2 p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (feedbackState !== null) {
    if (index === feedbackState.correctIndex) {
      return cn(
        base,
        'cursor-not-allowed border-[hsl(var(--practice-correct))] bg-[hsl(var(--practice-correct-soft))]'
      );
    }
    if (index === feedbackState.selectedIndex && index !== feedbackState.correctIndex) {
      return cn(
        base,
        'cursor-not-allowed border-[hsl(var(--practice-incorrect))] bg-[hsl(var(--practice-incorrect-soft))]'
      );
    }
    return cn(base, 'cursor-not-allowed border-transparent opacity-[0.35]');
  }

  if (disabled) {
    return cn(base, 'cursor-not-allowed border-transparent opacity-50');
  }

  return cn(base, 'cursor-pointer border-transparent hover:border-accent');
}

export function SelectPictureFromDescriptionCard({
  items,
  onAnswer,
  feedbackState,
  disabled,
  exerciseId,
}: SelectPictureFromDescriptionCardProps) {
  const { t } = useTranslation('common');

  const rawPayload = items[0]?.payload;
  if (!rawPayload) return null;
  const payload = rawPayload as unknown as SelectPictureFromDescriptionPayload;
  const { prompt_description, options, correct_index } = payload;

  const handleOptionClick = (index: number) => {
    if (disabled || feedbackState !== null) return;
    onAnswer(index, correct_index);
  };

  const announcement =
    feedbackState !== null
      ? feedbackState.selectedIndex === feedbackState.correctIndex
        ? t('exercises.session.pictureMatch.correctAnnouncement')
        : t('exercises.session.pictureMatch.incorrectAnnouncement', {
            number: feedbackState.correctIndex + 1,
          })
      : '';

  return (
    <div data-testid="spfd-renderer">
      <p className="mb-6 text-center text-lg font-medium">{prompt_description}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt: PictureMatchOption, i: number) => (
          <button
            key={i}
            data-testid={`spfd-option-${i}`}
            className={getOptionClasses(i, feedbackState, disabled)}
            disabled={disabled || feedbackState !== null}
            onClick={() => handleOptionClick(i)}
            type="button"
          >
            <PictureOption
              imageUrl={opt.image_url}
              optionIndex={i}
              exerciseId={exerciseId}
              alt={opt.description_text ?? `Option ${i + 1}`}
            />
            {feedbackState !== null && i === feedbackState.correctIndex && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-[hsl(var(--practice-correct))] drop-shadow" />
              </div>
            )}
            {feedbackState !== null &&
              i === feedbackState.selectedIndex &&
              i !== feedbackState.correctIndex && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-[hsl(var(--practice-incorrect))] drop-shadow" />
                </div>
              )}
          </button>
        ))}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
