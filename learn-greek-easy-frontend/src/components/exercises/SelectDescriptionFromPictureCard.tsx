import { useEffect, useRef } from 'react';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type {
  ExerciseItemPayload,
  PictureMatchOption,
  SelectDescriptionFromPicturePayload,
} from '@/services/exerciseAPI';

import { PictureOption } from './PictureOption';

interface SelectDescriptionFromPictureCardProps {
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
  const base = 'w-full border rounded-lg p-4 text-left transition-colors flex items-center gap-3';

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
    return cn(base, 'cursor-not-allowed opacity-[0.35]');
  }

  if (disabled) {
    return cn(base, 'cursor-not-allowed opacity-50');
  }

  return cn(base, 'cursor-pointer hover:bg-accent');
}

export function SelectDescriptionFromPictureCard({
  items,
  onAnswer,
  feedbackState,
  disabled,
  exerciseId,
}: SelectDescriptionFromPictureCardProps) {
  const { t } = useTranslation('common');
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const anchorImageId = `sdfp-anchor-${exerciseId}`;

  // Auto-focus first option when exercise changes (must be before any early return)
  useEffect(() => {
    optionRefs.current[0]?.focus();
  }, [exerciseId]);

  const rawPayload = items[0]?.payload;
  if (!rawPayload) return null;
  const payload = rawPayload as unknown as SelectDescriptionFromPicturePayload;
  const { anchor_image_url, options, correct_index } = payload;

  const handleOptionClick = (index: number) => {
    if (disabled || feedbackState !== null) return;
    onAnswer(index, correct_index);
  };

  // Vertical Up/Down arrow-key navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target = -1;

    if (e.key === 'ArrowDown') {
      if (index < options.length - 1) target = index + 1;
    } else if (e.key === 'ArrowUp') {
      if (index > 0) target = index - 1;
    }

    if (target >= 0) {
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
    <div data-testid="sdfp-renderer">
      <div className="mb-6">
        <PictureOption
          imageUrl={anchor_image_url}
          optionIndex={0}
          exerciseId={exerciseId}
          alt={t('exercises.session.pictureMatch.anchorAlt')}
          className="mx-auto mb-6 aspect-square w-full max-w-[280px]"
        />
        {/* Visually hidden anchor label for aria-describedby on option buttons */}
        <span id={anchorImageId} className="sr-only">
          {t('exercises.session.pictureMatch.anchorAlt')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt: PictureMatchOption, i: number) => (
          <button
            key={i}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            data-testid={`sdfp-option-${i}`}
            className={getOptionClasses(i, feedbackState, disabled)}
            disabled={disabled || feedbackState !== null}
            onClick={() => handleOptionClick(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            type="button"
            aria-pressed={feedbackState !== null ? feedbackState.selectedIndex === i : false}
            aria-label={t('exercises.session.pictureMatch.optionLabel', { number: i + 1 })}
            aria-describedby={anchorImageId}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {i + 1}
            </span>
            <span className="flex-1">{opt.description_text}</span>
            {feedbackState !== null && i === feedbackState.correctIndex && (
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[hsl(var(--practice-correct))]" />
            )}
            {feedbackState !== null &&
              i === feedbackState.selectedIndex &&
              i !== feedbackState.correctIndex && (
                <XCircle className="ml-auto h-5 w-5 shrink-0 text-[hsl(var(--practice-incorrect))]" />
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
