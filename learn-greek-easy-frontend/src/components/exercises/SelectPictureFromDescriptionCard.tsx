import { useEffect, useRef } from 'react';

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
      return cn(base, 'cursor-not-allowed border-practice-correct bg-practice-correct-soft');
    }
    if (index === feedbackState.selectedIndex && index !== feedbackState.correctIndex) {
      return cn(base, 'cursor-not-allowed border-practice-incorrect bg-practice-incorrect-soft');
    }
    return cn(base, 'cursor-not-allowed border-transparent opacity-35');
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
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const promptId = `spfd-prompt-${exerciseId}`;

  // Auto-focus first option when exercise changes (must be before any early return)
  useEffect(() => {
    optionRefs.current[0]?.focus();
  }, [exerciseId]);

  const rawPayload = items[0]?.payload;
  if (!rawPayload) return null;
  const payload = rawPayload as unknown as SelectPictureFromDescriptionPayload;
  const { prompt_description, options, correct_index } = payload;

  const handleOptionClick = (index: number) => {
    if (disabled || feedbackState !== null) return;
    onAnswer(index, correct_index);
  };

  // 2D grid arrow-key navigation (2 cols x 2 rows)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    let target = -1;

    if (e.key === 'ArrowRight') {
      if (col < 1) target = index + 1;
    } else if (e.key === 'ArrowLeft') {
      if (col > 0) target = index - 1;
    } else if (e.key === 'ArrowDown') {
      if (row < 1) target = index + 2;
    } else if (e.key === 'ArrowUp') {
      if (row > 0) target = index - 2;
    }

    if (target >= 0 && target < options.length) {
      e.preventDefault();
      optionRefs.current[target]?.focus();
    }
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
      <h2 className="mb-1 text-center text-sm font-medium text-muted-foreground">
        {t('exercises.session.pictureMatch.pickPicturePrompt')}
      </h2>
      <p id={promptId} className="mb-6 text-center text-lg font-medium">
        {prompt_description}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt: PictureMatchOption, i: number) => (
          <button
            key={i}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            data-testid={`spfd-option-${i}`}
            className={getOptionClasses(i, feedbackState, disabled)}
            disabled={disabled || feedbackState !== null}
            onClick={() => handleOptionClick(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            type="button"
            aria-pressed={feedbackState !== null ? feedbackState.selectedIndex === i : false}
            aria-label={t('exercises.session.pictureMatch.optionLabel', { number: i + 1 })}
            aria-describedby={promptId}
          >
            <PictureOption
              imageUrl={opt.image_url}
              optionIndex={i}
              exerciseId={exerciseId}
              alt={t('exercises.session.pictureMatch.optionLabel', { number: i + 1 })}
            />
            {feedbackState !== null && i === feedbackState.correctIndex && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-practice-correct drop-shadow" />
              </div>
            )}
            {feedbackState !== null &&
              i === feedbackState.selectedIndex &&
              i !== feedbackState.correctIndex && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-practice-incorrect drop-shadow" />
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
