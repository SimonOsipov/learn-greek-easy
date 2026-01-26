import React, { useEffect, useMemo, useRef } from 'react';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, BarChart3, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Props for QuestionFeedback component
 */
export interface QuestionFeedbackProps {
  /** Whether the user's answer was correct */
  isCorrect: boolean;

  /** The correct option (for display when wrong) */
  correctOption: {
    /** Option label: "A", "B", "C", or "D" */
    label: string;
    /** Multilingual option text */
    text: Record<SupportedLanguage, string>;
  };

  /** XP earned for this answer (retained for analytics, not displayed in UI) */
  xpEarned: number;

  /** Current display language for the correct answer text */
  language: SupportedLanguage;

  /** Callback when user clicks "Next Question" or "View Summary" */
  onNextQuestion: () => void;

  /** Whether this is the last question in session */
  isLastQuestion?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Source article URL for news-sourced questions */
  sourceArticleUrl?: string | null;
}

/**
 * Animation variants for the feedback card.
 * Respects prefers-reduced-motion preference.
 */
const feedbackVariants = {
  initial: (prefersReducedMotion: boolean) =>
    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 },
  animate: (prefersReducedMotion: boolean) =>
    prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
  exit: (prefersReducedMotion: boolean) =>
    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 },
};

/**
 * QuestionFeedback Component
 *
 * Displays immediate feedback after a user submits an answer in the culture exam.
 * Shows whether the answer was correct or wrong, reveals the correct answer if
 * wrong, and provides navigation to the next question or summary.
 *
 * Features:
 * - Green/red visual distinction for correct/wrong answers
 * - Animated entry with framer-motion (respects prefers-reduced-motion)
 * - Auto-focus on action button for keyboard accessibility
 * - Screen reader announcements for accessibility
 *
 * Note: xpEarned prop is retained for analytics purposes but not displayed in UI.
 *
 * @example
 * ```tsx
 * <QuestionFeedback
 *   isCorrect={false}
 *   correctOption={{ label: 'B', text: { en: 'Athens', el: 'Αθήνα', ru: 'Афины' } }}
 *   xpEarned={2}
 *   language="en"
 *   onNextQuestion={handleNext}
 *   isLastQuestion={false}
 * />
 * ```
 */
export const QuestionFeedback: React.FC<QuestionFeedbackProps> = ({
  isCorrect,
  correctOption,
  xpEarned: _xpEarned, // Retained for analytics, not displayed
  language,
  onNextQuestion,
  isLastQuestion = false,
  className,
  sourceArticleUrl,
}) => {
  const { t } = useTranslation('culture');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Auto-focus the action button for keyboard accessibility
  useEffect(() => {
    // Small delay to ensure animation is complete
    const timer = setTimeout(
      () => {
        buttonRef.current?.focus();
      },
      prefersReducedMotion ? 100 : 350
    );

    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  // Get the correct answer text in the current language
  const correctAnswerText = correctOption.text[language] || correctOption.text.en;

  // Screen reader announcement text
  const srAnnouncement = isCorrect
    ? t('feedback.srCorrectSimple', { defaultValue: 'Correct!' })
    : t('feedback.srWrongSimple', {
        label: correctOption.label,
        answer: correctAnswerText,
        defaultValue: `Wrong. The correct answer was ${correctOption.label}: ${correctAnswerText}.`,
      });

  return (
    <>
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {srAnnouncement}
      </div>

      {/* Visual feedback card */}
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={feedbackVariants}
        custom={prefersReducedMotion}
        transition={{
          duration: prefersReducedMotion ? 0.1 : 0.3,
          ease: 'easeOut',
        }}
        className={className}
      >
        <Card
          className={cn(
            'relative overflow-hidden border-2 p-6',
            isCorrect
              ? 'border-success/50 bg-gradient-to-br from-emerald-50 to-green-50 dark:border-success/30 dark:from-emerald-950/50 dark:to-green-950/50'
              : 'border-destructive/50 bg-gradient-to-br from-red-50 to-rose-50 dark:border-destructive/30 dark:from-red-950/50 dark:to-rose-950/50'
          )}
        >
          {/* Result header */}
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            )}
            <h3
              className={cn('text-xl font-bold', isCorrect ? 'text-success' : 'text-destructive')}
            >
              {isCorrect ? t('feedback.correct', 'Correct!') : t('feedback.wrong', 'Wrong!')}
            </h3>
          </div>

          {/* Correct answer reveal (when wrong) */}
          {!isCorrect && (
            <div className="mt-4 rounded-lg bg-background/60 p-3">
              <p className="text-sm font-medium text-muted-foreground">
                {t('feedback.correctAnswerWas', 'The correct answer was:')}
              </p>
              <p className="mt-1 font-semibold text-foreground">
                {t('feedback.optionWithLabel', {
                  label: correctOption.label,
                  text: correctAnswerText,
                  defaultValue: `Option ${correctOption.label}: ${correctAnswerText}`,
                })}
              </p>
            </div>
          )}

          {/* Source article link - only show if valid URL */}
          {sourceArticleUrl && sourceArticleUrl.startsWith('http') && (
            <a
              href={sourceArticleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
              data-testid="source-article-link"
            >
              <ExternalLink className="h-4 w-4" />
              {t('feedback.sourceArticle', 'Source article')}
            </a>
          )}

          {/* Action button */}
          <div className="mt-6">
            <Button
              ref={buttonRef}
              onClick={onNextQuestion}
              className={cn(
                'w-full',
                isCorrect
                  ? 'bg-success text-success-foreground hover:bg-success/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              size="lg"
            >
              {isLastQuestion ? (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('feedback.viewSummary', 'View Summary')}
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('feedback.nextQuestion', 'Next Question')}
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
    </>
  );
};
