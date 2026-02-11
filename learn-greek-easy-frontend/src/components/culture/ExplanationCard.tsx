import { type FC, useState } from 'react';

import { Check, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ReportErrorButton, ReportErrorModal } from '@/components/card-errors';
import { trackNewsSourceLinkClicked } from '@/lib/analytics';
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
  explanationText,
  correctAnswer,
  sourceArticleUrl,
  cardId,
  className,
}) => {
  const { t } = useTranslation('culture');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleSourceLinkClick = () => {
    if (!sourceArticleUrl || !cardId) return;

    let domain = 'unknown';
    try {
      domain = new URL(sourceArticleUrl).hostname;
    } catch {
      // URL parsing failed, use fallback
    }

    trackNewsSourceLinkClicked({
      card_id: cardId,
      article_domain: domain,
    });
  };

  return (
    <>
      <div
        className={cn(
          'animate-cult-slide-up',
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

        {/* Explanation body text */}
        {explanationText && (
          <p
            className="mt-2 font-cult-serif text-sm leading-[1.7] text-slate-500"
            data-testid="explanation-text"
          >
            {explanationText}
          </p>
        )}

        {/* Source article link */}
        {sourceArticleUrl && sourceArticleUrl.startsWith('http') && (
          <a
            href={sourceArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
            data-testid="source-article-link"
            onClick={handleSourceLinkClick}
          >
            <ExternalLink className="h-4 w-4" />
            {t('feedback.sourceArticle', 'Source article')}
          </a>
        )}

        {/* Report error button */}
        {cardId && (
          <div className="mt-4 flex justify-start">
            <ReportErrorButton
              onClick={() => setIsReportModalOpen(true)}
              data-testid="culture-report-error-button"
            />
          </div>
        )}
      </div>

      {/* Report error modal */}
      {cardId && (
        <ReportErrorModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          cardId={cardId}
          cardType="CULTURE"
        />
      )}
    </>
  );
};
