import React, { useEffect, useMemo, useRef } from 'react';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Star, ArrowRight, BarChart3 } from 'lucide-react';
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

  /** XP earned for this answer */
  xpEarned: number;

  /** Current display language for the correct answer text */
  language: SupportedLanguage;

  /** Callback when user clicks "Next Question" or "View Summary" */
  onNextQuestion: () => void;

  /** Whether this is the last question in session */
  isLastQuestion?: boolean;

  /** Additional CSS classes */
  className?: string;
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
 * Animation variants for the XP badge
 */
const xpVariants = {
  initial: (prefersReducedMotion: boolean) =>
    prefersReducedMotion ? { scale: 1 } : { scale: 0.8, opacity: 0 },
  animate: (prefersReducedMotion: boolean) =>
    prefersReducedMotion ? { scale: 1 } : { scale: 1, opacity: 1 },
};

/**
 * QuestionFeedback Component
 *
 * Displays immediate feedback after a user submits an answer in the culture exam.
 * Shows whether the answer was correct or wrong, reveals the correct answer if
 * wrong, displays XP earned, and provides navigation to the next question or summary.
 *
 * Features:
 * - Green/red visual distinction for correct/wrong answers
 * - Animated entry with framer-motion (respects prefers-reduced-motion)
 * - XP earned display with star icon
 * - Auto-focus on action button for keyboard accessibility
 * - Screen reader announcements for accessibility
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
  xpEarned,
  language,
  onNextQuestion,
  isLastQuestion = false,
  className,
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
    ? t('feedback.srCorrect', { xp: xpEarned, defaultValue: `Correct! You earned ${xpEarned} XP.` })
    : t('feedback.srWrong', {
        label: correctOption.label,
        answer: correctAnswerText,
        xp: xpEarned,
        defaultValue: `Wrong. The correct answer was ${correctOption.label}: ${correctAnswerText}. You earned ${xpEarned} XP.`,
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
              ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 dark:border-emerald-700 dark:from-emerald-950/50 dark:to-green-950/50'
              : 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:border-red-700 dark:from-red-950/50 dark:to-rose-950/50'
          )}
        >
          {/* Result header */}
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <CheckCircle
                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            ) : (
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" aria-hidden="true" />
            )}
            <h3
              className={cn(
                'text-xl font-bold',
                isCorrect
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-red-800 dark:text-red-200'
              )}
            >
              {isCorrect ? t('feedback.correct', 'Correct!') : t('feedback.wrong', 'Wrong!')}
            </h3>
          </div>

          {/* Correct answer reveal (when wrong) */}
          {!isCorrect && (
            <div className="mt-4 rounded-lg bg-white/60 p-3 dark:bg-gray-900/40">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('feedback.correctAnswerWas', 'The correct answer was:')}
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                {t('feedback.optionWithLabel', {
                  label: correctOption.label,
                  text: correctAnswerText,
                  defaultValue: `Option ${correctOption.label}: ${correctAnswerText}`,
                })}
              </p>
            </div>
          )}

          {/* XP earned badge */}
          <motion.div
            variants={xpVariants}
            custom={prefersReducedMotion}
            transition={{
              delay: prefersReducedMotion ? 0 : 0.2,
              duration: prefersReducedMotion ? 0.1 : 0.3,
              ease: 'easeOut',
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
          >
            <Star className="h-4 w-4" fill="currentColor" aria-hidden="true" />
            <span className="font-semibold">{t('feedback.xpEarned', { xp: xpEarned })}</span>
          </motion.div>

          {/* Action button */}
          <div className="mt-6">
            <Button
              ref={buttonRef}
              onClick={onNextQuestion}
              className={cn(
                'w-full',
                isCorrect
                  ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'
                  : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600'
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
