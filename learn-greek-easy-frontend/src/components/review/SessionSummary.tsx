import { CheckCircle, TrendingUp, Clock, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatTime,
  getEncouragingMessage,
  getAccuracyColor,
  formatRatingBreakdown,
} from '@/lib/sessionSummaryUtils';
import type { SessionSummary as SessionSummaryType } from '@/types/review';

export interface SessionSummaryProps {
  summary: SessionSummaryType;
  onBackToDashboard: () => void;
}

/**
 * SessionSummary Component
 *
 * Displays post-session statistics including:
 * - Completion message with performance-based encouragement
 * - Statistics grid (cards reviewed, accuracy, time spent, avg per card)
 * - Rating breakdown (Again/Hard/Good/Easy with percentages)
 * - Single action button (Back to Dashboard)
 *
 * Edge cases handled:
 * - Zero cards reviewed: Shows simplified message
 * - Perfect score (100%): Special celebration
 * - All "again" (0%): Supportive encouragement
 *
 * Responsive:
 * - Mobile (< 640px): 2x2 grids
 * - Desktop (≥ 640px): 1x4 grids
 */
export function SessionSummary({ summary, onBackToDashboard }: SessionSummaryProps) {
  const { t } = useTranslation('review');

  // Edge case: no cards reviewed
  if (summary.cardsReviewed === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
        <Card className="bg-muted/50 text-center">
          <CardContent className="pb-6 pt-8">
            <p className="mb-4 text-lg text-foreground">{t('session.sessionEndedNoCards')}</p>
            <Button size="lg" onClick={onBackToDashboard}>
              {t('summary.backToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const message = getEncouragingMessage(summary.accuracy, summary.cardsReviewed);
  const accuracyColor = getAccuracyColor(summary.accuracy);
  const ratingBreakdown = formatRatingBreakdown(summary);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-2 sm:space-y-6 sm:p-4">
      {/* 1. Completion Message */}
      <Card
        className="border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 text-center dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20"
        role="status"
        aria-live="polite"
      >
        <CardContent className="pb-4 pt-6 sm:pb-6 sm:pt-8">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500 sm:mb-4 sm:h-16 sm:w-16" />
          <h2 className="mb-2 text-xl font-bold text-foreground sm:text-2xl">
            {t('summary.title')}
          </h2>
          <p className="text-base text-foreground sm:text-lg">{message}</p>
        </CardContent>
      </Card>

      {/* 2. Statistics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* Cards Reviewed */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <Target
              className="mx-auto mb-2 h-6 w-6 text-blue-500 sm:h-8 sm:w-8"
              aria-hidden="true"
            />
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {summary.cardsReviewed}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {t('summary.cardsReviewed')}
            </p>
          </CardContent>
        </Card>

        {/* Accuracy (PRIMARY METRIC) */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <TrendingUp
              className={`mx-auto mb-2 h-6 w-6 sm:h-8 sm:w-8 ${accuracyColor}`}
              aria-hidden="true"
            />
            <p className={`text-2xl font-bold sm:text-3xl ${accuracyColor}`}>{summary.accuracy}%</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t('summary.accuracy')}</p>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <Clock
              className="mx-auto mb-2 h-6 w-6 text-orange-500 sm:h-8 sm:w-8"
              aria-hidden="true"
            />
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {formatTime(summary.totalTime)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {t('summary.timeSpent')}
            </p>
          </CardContent>
        </Card>

        {/* Avg Per Card */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <Clock
              className="mx-auto mb-2 h-6 w-6 text-purple-500 sm:h-8 sm:w-8"
              aria-hidden="true"
            />
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {summary.averageTimePerCard}
              {t('summary.seconds')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {t('summary.avgPerCard')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Rating Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('summary.ratingBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {ratingBreakdown.map((item) => (
              <div key={item.label} className={`p-3 text-center sm:p-4 ${item.bgColor} rounded-lg`}>
                <p className={`text-xl font-bold sm:text-2xl ${item.color}`}>{item.count}</p>
                <p className="mt-1 text-sm text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Action Button */}
      <div className="flex justify-center">
        <Button size="lg" onClick={onBackToDashboard}>
          {t('summary.backToDashboard')}
        </Button>
      </div>
    </div>
  );
}
