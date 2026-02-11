import { type FC } from 'react';

import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

/** Props for the ExplanationCard component */
export interface ExplanationCardProps {
  /** Whether the user's answer was correct */
  isCorrect: boolean;

  /** Optional explanation text to display (e.g., fun fact or context) */
  explanationText?: string;

  /** The correct answer details, shown when the user answered incorrectly */
  correctAnswer?: {
    /** Option label: "A", "B", "C", or "D" */
    label: string;
    /** The correct answer text */
    text: string;
  };

  /** URL to the source article. null means explicitly no source. */
  sourceArticleUrl?: string | null;

  /** Card ID used for analytics tracking (e.g., error reporting, link clicks) */
  cardId?: string;

  /** Additional CSS classes applied to the outer container */
  className?: string;
}

export const ExplanationCard: FC<ExplanationCardProps> = ({
  isCorrect,
  explanationText: _explanationText,
  correctAnswer,
  sourceArticleUrl: _sourceArticleUrl,
  cardId: _cardId,
  className,
}) => {
  const { t } = useTranslation('culture');

  return (
    <div
      className={cn(
        // Base layout
        'rounded-2xl border-[1px] px-5 py-4',
        // Correct state
        isCorrect && 'bg-[var(--cult-correct-soft)]',
        // Incorrect state
        !isCorrect && 'bg-[var(--cult-incorrect-soft)]',
        // Parent positioning
        className
      )}
      style={{
        borderColor: `color-mix(in srgb, var(${isCorrect ? '--cult-correct' : '--cult-incorrect'}) 20%, transparent)`,
      }}
      data-testid="explanation-card"
    >
      {/* Result header */}
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <X className="h-4 w-4 text-red-600" strokeWidth={2.5} aria-hidden="true" />
        )}
        <span
          className={cn(
            'font-cult-mono text-[13px] font-semibold uppercase tracking-wide',
            isCorrect ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {isCorrect ? t('explanation.correct') : t('explanation.incorrect')}
        </span>
      </div>

      {/* Correct answer reveal */}
      {!isCorrect && correctAnswer && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('explanation.correctAnswerReveal', {
            label: correctAnswer.label,
            text: correctAnswer.text,
            defaultValue: 'The correct answer was: {{label}}: {{text}}',
          })}
        </p>
      )}
    </div>
  );
};
