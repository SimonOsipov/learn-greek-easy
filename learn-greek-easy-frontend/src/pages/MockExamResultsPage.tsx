/**
 * Mock Exam Results Page
 *
 * Full-screen display of mock citizenship exam results.
 * Shows pass/fail status, score breakdown, XP earned, and incorrect answer review.
 *
 * Features:
 * - Pass/fail status with gradient header
 * - Score statistics (correct count, percentage, time, pass threshold)
 * - Incorrect answers accordion with question review
 * - Language selector for viewing questions in different languages
 * - Navigation to retry or return to landing
 * - PostHog analytics tracking
 */

import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Percent,
  RefreshCw,
  Star,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LanguageSelector } from '@/components/culture';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuestionLanguage } from '@/hooks/useQuestionLanguage';
import type { SupportedLanguage } from '@/i18n';
import {
  trackMockExamResultsViewed,
  trackMockExamIncorrectReviewExpanded,
  trackMockExamRetryClicked,
} from '@/lib/analytics';
import log from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamQuestionState } from '@/types/mockExamSession';

/** Option letter mapping */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Get localized text from multilingual object
 */
function getLocalizedText(
  text: { el: string; en: string; ru: string },
  language: SupportedLanguage
): string {
  return text[language] || text.en || '';
}

/**
 * Format duration in seconds to human readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/**
 * Loading skeleton for results page
 */
function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto max-w-3xl space-y-6 px-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function MockExamResultsPage() {
  const { t } = useTranslation(['mockExam', 'common']);
  const navigate = useNavigate();
  const { questionLanguage, setQuestionLanguage } = useQuestionLanguage();

  const { summary, resetSession } = useMockExamSessionStore();

  // Ref to prevent duplicate tracking
  const hasTrackedView = useRef(false);

  // Track accordion open state for analytics
  const [accordionValue, setAccordionValue] = useState<string>('');

  // Redirect if no summary available
  useEffect(() => {
    if (!summary) {
      log.warn('No mock exam summary available, redirecting to culture exam page');
      navigate('/practice/culture-exam', { replace: true });
    }
  }, [summary, navigate]);

  // Track results viewed
  useEffect(() => {
    if (summary && !hasTrackedView.current) {
      hasTrackedView.current = true;

      trackMockExamResultsViewed({
        session_id: summary.sessionId,
        score: summary.score,
        total_questions: summary.totalQuestions,
        passed: summary.passed,
        percentage: summary.percentage,
        timer_expired: summary.timerExpired,
        xp_earned: summary.xpEarned,
      });
    }
  }, [summary]);

  // Track accordion expand for incorrect answers review
  const handleAccordionChange = (value: string) => {
    setAccordionValue(value);

    if (value === 'incorrect-answers' && summary) {
      trackMockExamIncorrectReviewExpanded({
        session_id: summary.sessionId,
        incorrect_count: incorrectQuestions.length,
      });
    }
  };

  // Loading/redirect state
  if (!summary) {
    return <ResultsPageSkeleton />;
  }

  // Filter incorrect questions for review
  const incorrectQuestions = summary.questionResults.filter(
    (q: MockExamQuestionState) => q.isCorrect === false && q.selectedOption !== null
  );

  // Navigation handlers
  const handleBackToLanding = () => {
    resetSession();
    navigate('/practice/culture-exam');
  };

  const handleStartNewExam = () => {
    trackMockExamRetryClicked({
      session_id: summary.sessionId,
      previous_passed: summary.passed,
      previous_score: summary.score,
    });

    resetSession();
    navigate('/practice/culture-exam/session');
  };

  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        {/* Header Card - Pass/Fail Status */}
        <Card
          className={cn(
            'relative overflow-hidden border-0 text-white',
            summary.passed
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
              : 'bg-gradient-to-br from-red-500 to-rose-600'
          )}
        >
          <CardContent className="p-6 md:p-8">
            {/* Status Icon and Text */}
            <div className="flex items-center gap-4">
              {summary.passed ? (
                <Trophy className="h-12 w-12 text-amber-300" />
              ) : (
                <XCircle className="h-12 w-12 text-white/80" />
              )}
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {summary.passed
                    ? t('results.passed', 'Congratulations! You passed!')
                    : t('results.failed', "You didn't pass this time")}
                </h1>
                <p className="mt-1 text-white/80">{t('results.title', 'Exam Complete')}</p>
              </div>
            </div>

            {/* Score Display */}
            <div className="mt-6 flex flex-wrap items-center gap-4 md:gap-6">
              <div className="rounded-lg bg-white/20 px-4 py-3">
                <p className="text-sm text-white/80">{t('results.score', 'Your Score')}</p>
                <p className="text-3xl font-bold">
                  {summary.score}/{summary.totalQuestions}
                </p>
                <p className="text-lg font-semibold">{summary.percentage}%</p>
              </div>

              {/* XP Earned Badge */}
              <div className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-3">
                <Star className="h-6 w-6 text-amber-300" fill="currentColor" />
                <span className="text-xl font-semibold">
                  +{summary.xpEarned} XP {t('common:earned', 'earned')}
                </span>
              </div>
            </div>

            {/* Decorative circles */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full bg-white/10" />
          </CardContent>
        </Card>

        {/* Statistics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Correct Answers */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <CheckCircle className="mb-2 h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="text-2xl font-bold text-foreground">{summary.score}</p>
              <p className="text-center text-sm text-muted-foreground">
                {t('common:correct', 'Correct')}
              </p>
            </CardContent>
          </Card>

          {/* Percentage */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Percent className="mb-2 h-8 w-8 text-purple-600 dark:text-purple-400" />
              <p className="text-2xl font-bold text-foreground">{summary.percentage}%</p>
              <p className="text-center text-sm text-muted-foreground">
                {t('common:accuracy', 'Accuracy')}
              </p>
            </CardContent>
          </Card>

          {/* Time Taken */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Clock className="mb-2 h-8 w-8 text-blue-600 dark:text-blue-400" />
              <p className="text-2xl font-bold text-foreground">
                {summary.timerExpired
                  ? t('results.timeExpired', 'Time Expired')
                  : formatDuration(summary.timeTakenSeconds)}
              </p>
              <p className="text-center text-sm text-muted-foreground">
                {t('results.timeTaken', 'Time Taken')}
              </p>
            </CardContent>
          </Card>

          {/* Pass Threshold */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Target className="mb-2 h-8 w-8 text-orange-600 dark:text-orange-400" />
              <p className="text-2xl font-bold text-foreground">{summary.passThreshold}%</p>
              <p className="text-center text-sm text-muted-foreground">
                {t('results.passingScore', 'Passing Score: {{threshold}}%', {
                  threshold: summary.passThreshold,
                }).replace(`${summary.passThreshold}%`, '')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Incorrect Answers Accordion */}
        <Card className="mt-6">
          <Accordion
            type="single"
            collapsible
            value={accordionValue}
            onValueChange={handleAccordionChange}
          >
            <AccordionItem value="incorrect-answers" className="border-0">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold">
                    {t('results.incorrectAnswers', 'Review Incorrect Answers')} (
                    {incorrectQuestions.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6">
                {incorrectQuestions.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="mr-2 h-5 w-5 text-emerald-500" />
                    {t('results.perfectScore', 'Perfect! No incorrect answers.')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Language Selector */}
                    <div className="flex items-center justify-end">
                      <LanguageSelector
                        value={questionLanguage}
                        onChange={setQuestionLanguage}
                        size="sm"
                      />
                    </div>

                    {/* Incorrect Question Cards */}
                    {incorrectQuestions.map((result) => {
                      const questionIndex = summary.questionResults.findIndex(
                        (q) => q.question.id === result.question.id
                      );
                      const questionText = getLocalizedText(
                        result.question.question_text,
                        questionLanguage
                      );

                      // Safely get the selected option text
                      const selectedOptionIndex = (result.selectedOption ?? 1) - 1;
                      const selectedText = result.question.options[selectedOptionIndex]
                        ? getLocalizedText(
                            result.question.options[selectedOptionIndex],
                            questionLanguage
                          )
                        : '';

                      // Safely get the correct option text
                      const correctOptionIndex = (result.correctOption ?? 1) - 1;
                      const correctText = result.question.options[correctOptionIndex]
                        ? getLocalizedText(
                            result.question.options[correctOptionIndex],
                            questionLanguage
                          )
                        : '';

                      return (
                        <div
                          key={result.question.id}
                          className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
                        >
                          <p className="mb-3 font-medium text-foreground">
                            {t('results.questionNumber', 'Question {{number}}', {
                              number: questionIndex + 1,
                            })}
                            : {questionText}
                          </p>

                          {/* User's answer (red) */}
                          <div className="mb-2 flex items-start gap-2">
                            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                            <div>
                              <span className="text-sm text-muted-foreground">
                                {t('results.yourAnswer', 'Your answer')}:
                              </span>{' '}
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {OPTION_LETTERS[selectedOptionIndex]}: {selectedText}
                              </span>
                            </div>
                          </div>

                          {/* Correct answer (green) */}
                          <div className="flex items-start gap-2">
                            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                            <div>
                              <span className="text-sm text-muted-foreground">
                                {t('results.correctAnswer', 'Correct answer')}:
                              </span>{' '}
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {OPTION_LETTERS[correctOptionIndex]}: {correctText}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={handleBackToLanding}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('results.backToHome', 'Back to Culture Exam')}
          </Button>
          <Button onClick={handleStartNewExam} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('results.tryAgain', 'Try Again')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MockExamResultsPage;
