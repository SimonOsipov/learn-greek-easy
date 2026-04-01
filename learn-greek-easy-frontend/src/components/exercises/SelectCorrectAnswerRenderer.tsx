import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { ExerciseItemPayload } from '@/services/exerciseAPI';

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

interface SelectCorrectAnswerRendererProps {
  items: ExerciseItemPayload[];
  onAnswer: (selectedIndex: number, correctIndex: number) => void;
  feedbackState: { selectedIndex: number; correctIndex: number } | null;
  disabled: boolean;
}

function getLocalizedText(field: MultilingualField, lang: string): string {
  if (lang === 'ru') return field.ru;
  return field.en;
}

export function SelectCorrectAnswerRenderer({
  items,
  onAnswer,
  feedbackState,
  disabled,
}: SelectCorrectAnswerRendererProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru' : 'en';

  const rawPayload = items[0]?.payload;
  if (!rawPayload) return null;
  const payload = rawPayload as unknown as SelectCorrectAnswerPayload;
  const { prompt, options, correct_answer_index } = payload;

  const handleOptionClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (disabled || feedbackState !== null) return;
    onAnswer(index, correct_answer_index);
    (e.currentTarget as HTMLButtonElement).blur();
  };

  const getOptionClasses = (index: number): string => {
    const base = 'w-full border rounded-lg p-4 text-left transition-colors flex items-center gap-3';

    if (feedbackState !== null) {
      if (index === feedbackState.correctIndex) {
        return cn(
          base,
          'cursor-not-allowed border-[var(--practice-correct)] bg-[var(--practice-correct-soft)]'
        );
      }
      if (index === feedbackState.selectedIndex && index !== feedbackState.correctIndex) {
        return cn(
          base,
          'cursor-not-allowed border-[var(--practice-incorrect)] bg-[var(--practice-incorrect-soft)]'
        );
      }
      return cn(base, 'cursor-not-allowed opacity-[0.35]');
    }

    if (disabled) {
      return cn(base, 'cursor-not-allowed opacity-50');
    }

    return cn(base, 'cursor-pointer hover:bg-accent');
  };

  return (
    <div data-testid="sca-renderer">
      <p data-testid="sca-prompt" className="mb-6 text-center text-lg font-medium">
        {getLocalizedText(prompt, lang)}
      </p>
      {feedbackState !== null && <div data-testid="sca-feedback" className="hidden" />}
      <div
        className={cn(
          'grid gap-3',
          options.length === 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {options.map((option, index) => (
          <button
            key={index}
            data-testid={`sca-option-${index}`}
            className={getOptionClasses(index)}
            disabled={disabled || feedbackState !== null}
            onClick={(e) => handleOptionClick(e, index)}
            type="button"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {index + 1}
            </span>
            <span>{getLocalizedText(option, lang)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
