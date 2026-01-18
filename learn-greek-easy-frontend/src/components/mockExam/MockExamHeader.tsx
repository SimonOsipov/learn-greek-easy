/**
 * Mock Exam Session Header
 *
 * Sticky header for the mock exam session displaying:
 * - Exit button (left)
 * - Timer with color-coded warnings (center)
 * - Progress "Question X of Y" (right)
 * - Score "X / Y correct" (right)
 */

import React from 'react';

import { ChevronLeft, Clock, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MockExamTimerWarningLevel } from '@/types/mockExamSession';

export interface MockExamHeaderProps {
  /** Callback when exit button is clicked */
  onExit: () => void;
  /** Formatted time string "MM:SS" */
  formattedTime: string;
  /** Timer warning level for color coding */
  warningLevel: MockExamTimerWarningLevel;
  /** Current question number (1-indexed) */
  currentQuestion: number;
  /** Total questions in exam */
  totalQuestions: number;
  /** Number of correct answers so far */
  correctCount: number;
  /** Total questions answered so far */
  answeredCount: number;
}

/**
 * MockExamHeader Component
 *
 * Provides navigation, timer display, and progress tracking for the mock exam session.
 * Timer colors change based on warning level:
 * - Normal: Default text color
 * - 5 min warning: Orange/amber
 * - 1 min warning: Red with animation
 */
export const MockExamHeader: React.FC<MockExamHeaderProps> = ({
  onExit,
  formattedTime,
  warningLevel,
  currentQuestion,
  totalQuestions,
  correctCount,
  answeredCount,
}) => {
  const { t } = useTranslation('mockExam');

  // Timer color based on warning level
  const timerColorClass =
    warningLevel === 'warning_1min'
      ? 'text-red-600 dark:text-red-400'
      : warningLevel === 'warning_5min'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground';

  // Timer icon color
  const iconColorClass =
    warningLevel === 'warning_1min'
      ? 'text-red-600 dark:text-red-400'
      : warningLevel === 'warning_5min'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      data-testid="mock-exam-header"
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        {/* Exit button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="gap-1"
          data-testid="mock-exam-exit-button"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t('session.abandon')}</span>
        </Button>

        {/* Timer display */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold transition-colors',
            warningLevel === 'warning_1min' && 'animate-pulse bg-red-100 dark:bg-red-950/50',
            warningLevel === 'warning_5min' && 'bg-amber-100 dark:bg-amber-950/50'
          )}
          data-testid="mock-exam-timer"
        >
          {warningLevel === 'warning_1min' ? (
            <AlertTriangle className={cn('h-5 w-5', iconColorClass)} aria-hidden="true" />
          ) : (
            <Clock className={cn('h-5 w-5', iconColorClass)} aria-hidden="true" />
          )}
          <span className={timerColorClass} aria-live="polite" aria-atomic="true">
            {formattedTime}
          </span>
        </div>

        {/* Progress and score */}
        <div className="flex items-center gap-4 text-sm">
          {/* Question progress */}
          <div className="hidden text-muted-foreground sm:block" data-testid="mock-exam-progress">
            {t('session.question', {
              current: currentQuestion,
              total: totalQuestions,
            })}
          </div>

          {/* Mobile-friendly short progress */}
          <div className="text-muted-foreground sm:hidden" data-testid="mock-exam-progress-short">
            {currentQuestion}/{totalQuestions}
          </div>

          {/* Score */}
          <div className="font-medium text-foreground" data-testid="mock-exam-score">
            <span className="text-success">{correctCount}</span>
            <span className="text-muted-foreground">/{answeredCount}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
