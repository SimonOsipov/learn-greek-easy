import { type FC } from 'react';

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
  correctAnswer: _correctAnswer,
  sourceArticleUrl: _sourceArticleUrl,
  cardId: _cardId,
  className,
}) => {
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
      {/* Inner content -- implemented in subsequent subtasks */}
    </div>
  );
};
