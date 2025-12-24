/**
 * Culture Session Summary Page
 *
 * Full-screen display of practice session results.
 * Shows statistics, XP earned, and question breakdown.
 *
 * Features:
 * - Session statistics (accuracy, time, XP)
 * - Question-by-question breakdown
 * - Navigation to practice again or return to decks
 * - PostHog analytics tracking
 */

import { useEffect, useRef } from 'react';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  RefreshCw,
  Star,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { CultureBadge } from '@/components/culture';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import type { SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { useCultureSessionStore } from '@/stores/cultureSessionStore';

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
 * Get performance message based on accuracy
 */
function getPerformanceMessage(
  accuracy: number,
  t: (key: string, fallback?: string) => string
): string {
  if (accuracy >= 90) return t('summary.performance.excellent', 'Excellent!');
  if (accuracy >= 70) return t('summary.performance.good', 'Good job!');
  if (accuracy >= 50) return t('summary.performance.keepPracticing', 'Keep practicing!');
  return t('summary.performance.needsWork', 'Keep trying!');
}

/**
 * Loading skeleton for summary page
 */
function SummaryPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
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

export function CultureSessionSummaryPage() {
  const { t, i18n } = useTranslation(['culture', 'common']);
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  const { summary, clearSummary, resetSession } = useCultureSessionStore();

  // Ref to prevent duplicate tracking
  const hasTrackedComplete = useRef(false);

  // Redirect if no summary available
  useEffect(() => {
    if (!summary) {
      console.warn('No culture session summary available, redirecting to decks');
      navigate('/decks', { replace: true });
    }
  }, [summary, navigate]);

  // Track session completion
  useEffect(() => {
    if (summary && !hasTrackedComplete.current) {
      hasTrackedComplete.current = true;

      try {
        track('culture_session_completed', {
          deck_id: summary.deckId,
          session_id: summary.sessionId,
          questions_total: summary.questionResults.length,
          questions_correct: summary.stats.correctCount,
          accuracy: summary.stats.accuracy,
          duration_sec: summary.durationSeconds,
          xp_earned: summary.stats.xpEarned,
        });
      } catch {
        // Silent failure
      }
    }
  }, [summary, track]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearSummary();
    };
  }, [clearSummary]);

  // Loading/redirect state
  if (!summary) {
    return <SummaryPageSkeleton />;
  }

  // Error state
  if (!deckId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="container mx-auto max-w-3xl px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('summary.error', 'Error')}</AlertTitle>
            <AlertDescription>{t('summary.invalidDeckId', 'Invalid deck ID')}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/decks')}>
              {t('summary.goToDecks', 'Go to Decks')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentLanguage = (i18n.language || 'en') as SupportedLanguage;
  const performanceMessage = getPerformanceMessage(summary.stats.accuracy, t);

  // Navigation handlers
  const handleBackToDecks = () => {
    resetSession();
    navigate('/decks');
  };

  const handlePracticeAgain = () => {
    resetSession();
    navigate(`/culture/${deckId}/practice`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        {/* Header Card - Performance Summary */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CultureBadge category={summary.category} size="sm" />
              <CardTitle className="text-lg">{summary.deckName}</CardTitle>
            </div>
            <CardDescription className="text-purple-200">
              {t('summary.practiceComplete', 'Practice Complete')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Performance message */}
            <div className="flex items-center gap-3">
              <Trophy className="h-10 w-10 text-amber-300" />
              <div>
                <p className="text-2xl font-bold">{performanceMessage}</p>
                <p className="text-sm text-purple-200">
                  {t('summary.accuracyPercent', '{{accuracy}}% accuracy', {
                    accuracy: summary.stats.accuracy,
                  })}
                </p>
              </div>
            </div>

            {/* XP earned */}
            <div className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-3">
              <Star className="h-6 w-6 text-amber-300" fill="currentColor" />
              <span className="text-xl font-semibold">
                +{summary.stats.xpEarned} XP {t('summary.earned', 'earned')}
              </span>
            </div>
          </CardContent>

          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full bg-white/10" />
        </Card>

        {/* Statistics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Questions Answered */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Target className="mb-2 h-8 w-8 text-purple-600" />
              <p className="text-2xl font-bold">{summary.stats.questionsAnswered}</p>
              <p className="text-center text-sm text-gray-500">
                {t('summary.questionsAnswered', 'Questions')}
              </p>
            </CardContent>
          </Card>

          {/* Correct */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <CheckCircle className="mb-2 h-8 w-8 text-emerald-600" />
              <p className="text-2xl font-bold">{summary.stats.correctCount}</p>
              <p className="text-center text-sm text-gray-500">{t('summary.correct', 'Correct')}</p>
            </CardContent>
          </Card>

          {/* Incorrect */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <XCircle className="mb-2 h-8 w-8 text-red-500" />
              <p className="text-2xl font-bold">{summary.stats.incorrectCount}</p>
              <p className="text-center text-sm text-gray-500">
                {t('summary.incorrect', 'Incorrect')}
              </p>
            </CardContent>
          </Card>

          {/* Time Spent */}
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <Clock className="mb-2 h-8 w-8 text-blue-600" />
              <p className="text-2xl font-bold">{formatDuration(summary.durationSeconds)}</p>
              <p className="text-center text-sm text-gray-500">
                {t('summary.timeSpent', 'Time Spent')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Question Breakdown */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('summary.questionBreakdown', 'Question Breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.questionResults.map((result, index) => {
              const questionText = getLocalizedText(result.question.question_text, currentLanguage);
              const selectedText = getLocalizedText(
                result.question.options[result.selectedOption - 1],
                currentLanguage
              );
              const correctText = getLocalizedText(
                result.question.options[result.correctOption - 1],
                currentLanguage
              );

              return (
                <div
                  key={result.question.id}
                  className={cn(
                    'rounded-lg border p-3',
                    result.isCorrect
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {result.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-gray-900">
                        {index + 1}. {questionText}
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-500">
                          {t('summary.yourAnswer', 'Your answer')}:
                        </span>{' '}
                        <span
                          className={cn(
                            'font-medium',
                            result.isCorrect ? 'text-emerald-700' : 'text-red-600'
                          )}
                        >
                          {OPTION_LETTERS[result.selectedOption - 1]}: {selectedText}
                        </span>
                      </p>
                      {!result.isCorrect && (
                        <p className="text-sm">
                          <span className="text-gray-500">
                            {t('summary.correctAnswer', 'Correct answer')}:
                          </span>{' '}
                          <span className="font-medium text-emerald-700">
                            {OPTION_LETTERS[result.correctOption - 1]}: {correctText}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      <Star className="h-3 w-3" fill="currentColor" />+{result.xpEarned}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={handleBackToDecks} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('summary.backToDecks', 'Back to Decks')}
          </Button>
          <Button onClick={handlePracticeAgain} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('summary.practiceAgain', 'Practice Again')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CultureSessionSummaryPage;
