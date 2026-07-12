/**
 * Mock Exam Results Page
 *
 * Full-screen display of mock citizenship exam results.
 * Shows pass/fail status, score breakdown, and incorrect answer review.
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
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { QuestionLanguageSelector } from '@/components/shared';
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
import { tDynamic } from '@/i18n/tDynamic';
import { track } from '@/lib/analytics';
import log from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import { useXPStore } from '@/stores/xpStore';
import type { CultureLanguage } from '@/types/culture';
import type { MockExamTopicBreakdownItem } from '@/types/mockExam';
import type { MockExamQuestionState } from '@/types/mockExamSession';

/** Option letter mapping */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Get localized text from multilingual object
 */
function getLocalizedText(
  text: { el: string; en: string; ru: string },
  language: CultureLanguage
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
 * Tone driven by score % threshold: ≥60 → success, ≥30 → warning, else danger.
 * Mirrors readinessTone() in MockExamPage — the shared cx-cat-bar tone idiom.
 */
function topicTone(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 60) return 'success';
  if (pct >= 30) return 'warning';
  return 'danger';
}

/**
 * Per-topic breakdown panel (WEDGE-04).
 *
 * Renders one horizontal cx-cat bar per topic in the backend's canonical
 * CultureTopic order. Topic labels resolve from the `deck` namespace
 * (culture.categories.*) — the same source MockExamPage's category rows use.
 *
 * A topic that was NOT tested in this attempt (`percentage === null`) renders an
 * empty bar track with NO inner fill span (an inner span would get the CSS
 * default 12px danger-red min-width) and a muted "not in this attempt" note in
 * place of the score/percentage.
 */
function TopicBreakdownPanel({ items }: { items: MockExamTopicBreakdownItem[] }) {
  const { t } = useTranslation('mockExam');
  // Category display names live in the `deck` namespace (culture.categories.*).
  const { t: tDeck } = useTranslation('deck');

  return (
    <Card className="mt-6" data-testid="topic-breakdown">
      <CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t('breakdown.title')}</h2>
        <div className="cx-cat-list">
          {items.map((item) => {
            const hasScore = item.percentage !== null;
            return (
              <div key={item.topic} className="cx-cat-row" data-testid={`topic-bar-${item.topic}`}>
                <div className="cx-cat-l">
                  {tDynamic(tDeck, `culture.categories.${item.topic}`)}
                </div>
                {hasScore ? (
                  <div className="cx-cat-bar" data-tone={topicTone(item.percentage as number)}>
                    <span style={{ width: `${item.percentage}%` }} />
                  </div>
                ) : (
                  // Empty track, no inner span — a zero-asked topic has no fill.
                  <div className="cx-cat-bar" />
                )}
                <div className="cx-cat-meta">
                  {hasScore ? (
                    <>
                      <span className="cx-cat-mastered">
                        {t('breakdown.count', { correct: item.correct, asked: item.asked })}
                      </span>
                      <span className="cx-cat-accuracy">
                        {t('breakdown.percentage', { pct: item.percentage })}
                      </span>
                    </>
                  ) : (
                    <span className="cx-cat-accuracy">{t('breakdown.notInAttempt')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground" data-testid="topic-breakdown-disclaimer">
          {t('breakdown.disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for results page
 */
function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto space-y-6 px-4">
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
  const loadXPStats = useXPStore((state) => state.loadXPStats);

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

      track('mock_exam_results_viewed', {
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

  // Refresh XP stats when summary is available
  useEffect(() => {
    if (summary) {
      loadXPStats(true);
    }
  }, [summary, loadXPStats]);

  // Track accordion expand for incorrect answers review
  const handleAccordionChange = (value: string) => {
    setAccordionValue(value);

    if (value === 'incorrect-answers' && summary) {
      track('mock_exam_incorrect_review_expanded', {
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
    track('mock_exam_retry_clicked', {
      session_id: summary.sessionId,
      previous_passed: summary.passed,
      previous_score: summary.score,
    });

    resetSession();
    navigate('/practice/culture-exam/session');
  };

  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header Card - Pass/Fail Status */}
        <Card
          className={cn(
            'relative overflow-hidden border-0',
            summary.passed
              ? 'bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success)/.8)] text-[hsl(var(--success-foreground))]'
              : 'bg-gradient-to-br from-[hsl(var(--danger))] to-[hsl(var(--danger)/.85)] text-[hsl(var(--destructive-foreground))]'
          )}
        >
          <CardContent className="p-6 md:p-8">
            {/* Status Icon and Text */}
            <div className="flex items-center gap-4">
              {summary.passed ? (
                <Trophy className="h-12 w-12 text-[hsl(var(--practice-gold))]" />
              ) : (
                <XCircle className="h-12 w-12 opacity-80" />
              )}
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {summary.passed
                    ? t('results.passed', 'Congratulations! You passed!')
                    : t('results.failed', "You didn't pass this time")}
                </h1>
                <p className="mt-1 opacity-80">{t('results.title', 'Exam Complete')}</p>
              </div>
            </div>

            {/* Decorative circles */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-current opacity-10" />
            <div className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full bg-current opacity-10" />
          </CardContent>
        </Card>

        {/* Statistics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Correct Answers */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <CheckCircle className="mb-2 h-8 w-8 text-[hsl(var(--practice-correct))]" />
              <p
                className="font-practice-mono text-2xl font-bold text-foreground"
                data-testid="mock-exam-score"
              >
                {summary.score}
              </p>
              <p className="text-center text-sm text-muted-foreground">{t('common:correct')}</p>
            </CardContent>
          </Card>

          {/* Percentage */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Percent className="mb-2 h-8 w-8 text-[hsl(var(--practice-accent))]" />
              <p className="font-practice-mono text-2xl font-bold text-foreground">
                {summary.percentage}%
              </p>
              <p className="text-center text-sm text-muted-foreground">{t('common:accuracy')}</p>
            </CardContent>
          </Card>

          {/* Time Taken */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Clock className="mb-2 h-8 w-8 text-[hsl(var(--chart-1))]" />
              <p className="font-practice-mono text-2xl font-bold text-foreground">
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
              <Target className="mb-2 h-8 w-8 text-[hsl(var(--practice-gold))]" />
              <p className="font-practice-mono text-2xl font-bold text-foreground">
                {summary.passThreshold}%
              </p>
              <p className="text-center text-sm text-muted-foreground">
                {t('results.passingScore', 'Passing Score: {{threshold}}%', {
                  threshold: summary.passThreshold,
                }).replace(`${summary.passThreshold}%`, '')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Per-topic breakdown (WEDGE-04). Guarded so injected/older summaries
            without the field (e.g. the E2E-08 partial summary) render nothing. */}
        {summary.topicBreakdown?.length ? (
          <TopicBreakdownPanel items={summary.topicBreakdown} />
        ) : null}

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
                  <XCircle className="h-5 w-5 text-[hsl(var(--practice-incorrect))]" />
                  <span className="font-semibold">
                    {t('results.incorrectAnswers', 'Review Incorrect Answers')} (
                    {incorrectQuestions.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6">
                {incorrectQuestions.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="mr-2 h-5 w-5 text-[hsl(var(--practice-correct))]" />
                    {t('results.perfectScore', 'Perfect! No incorrect answers.')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Language Selector */}
                    <div className="flex items-center justify-end">
                      <QuestionLanguageSelector
                        value={questionLanguage}
                        onChange={(lang) => setQuestionLanguage(lang, 'mock_exam')}
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
                          className="rounded-lg border border-[hsl(var(--practice-incorrect-glow))] bg-[hsl(var(--practice-incorrect-soft))] p-4"
                        >
                          <p className="mb-3 font-medium text-foreground">
                            {t('results.questionNumber', 'Question {{number}}', {
                              number: questionIndex + 1,
                            })}
                            : {questionText}
                          </p>

                          {/* User's answer (incorrect) */}
                          <div className="mb-2 flex items-start gap-2">
                            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--practice-incorrect))]" />
                            <div>
                              <span className="text-sm text-muted-foreground">
                                {t('results.yourAnswer', 'Your answer')}:
                              </span>{' '}
                              <span className="font-medium text-[hsl(var(--practice-incorrect))]">
                                {OPTION_LETTERS[selectedOptionIndex]}: {selectedText}
                              </span>
                            </div>
                          </div>

                          {/* Correct answer (correct) */}
                          <div className="flex items-start gap-2">
                            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--practice-correct))]" />
                            <div>
                              <span className="text-sm text-muted-foreground">
                                {t('results.correctAnswer', 'Correct answer')}:
                              </span>{' '}
                              <span className="font-medium text-[hsl(var(--practice-correct))]">
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
