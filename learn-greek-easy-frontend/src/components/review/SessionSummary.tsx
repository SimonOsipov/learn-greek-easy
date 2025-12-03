import { CheckCircle, TrendingUp, Clock, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatTime,
  getEncouragingMessage,
  getAccuracyColor,
  formatRatingBreakdown,
  hasProgressTransitions,
} from '@/lib/sessionSummaryUtils';
import type { SessionSummary as SessionSummaryType } from '@/types/review';

export interface SessionSummaryProps {
  summary: SessionSummaryType;
  onBackToDeck: () => void;
  onReviewAgain: () => void;
  onDashboard: () => void;
}

/**
 * SessionSummary Component
 *
 * Displays comprehensive post-session statistics including:
 * - Completion message with performance-based encouragement
 * - Statistics grid (cards reviewed, accuracy, time spent, avg per card)
 * - Rating breakdown (Again/Hard/Good/Easy with percentages)
 * - Progress transitions (state changes: new→learning→mastered)
 * - Action buttons (Back to Deck, Review Again, Dashboard)
 *
 * Edge cases handled:
 * - Zero cards reviewed: Shows simplified message
 * - Perfect score (100%): Special celebration
 * - All "again" (0%): Supportive encouragement
 *
 * Responsive:
 * - Mobile (< 640px): 2x2 grids, stacked buttons
 * - Desktop (≥ 640px): 1x4 grids, row buttons
 */
export function SessionSummary({
  summary,
  onBackToDeck,
  onReviewAgain,
  onDashboard,
}: SessionSummaryProps) {
  // Edge case: no cards reviewed
  if (summary.cardsReviewed === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
        <Card className="bg-gray-50 text-center">
          <CardContent className="pb-6 pt-8">
            <p className="mb-4 text-lg text-gray-700">Session ended without reviewing any cards.</p>
            <Button
              size="lg"
              onClick={onBackToDeck}
              className="bg-gradient-to-br from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
            >
              Back to Deck
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const message = getEncouragingMessage(summary.accuracy, summary.cardsReviewed);
  const accuracyColor = getAccuracyColor(summary.accuracy);
  const showTransitions = hasProgressTransitions(summary);
  const ratingBreakdown = formatRatingBreakdown(summary);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-2 sm:space-y-6 sm:p-4">
      {/* 1. Completion Message */}
      <Card
        className="border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 text-center"
        role="status"
        aria-live="polite"
      >
        <CardContent className="pb-4 pt-6 sm:pb-6 sm:pt-8">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500 sm:mb-4 sm:h-16 sm:w-16" />
          <h2 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">Session Complete!</h2>
          <p className="text-base text-gray-700 sm:text-lg">{message}</p>
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
            <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{summary.cardsReviewed}</p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">Cards Reviewed</p>
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
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">Accuracy</p>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <Clock
              className="mx-auto mb-2 h-6 w-6 text-orange-500 sm:h-8 sm:w-8"
              aria-hidden="true"
            />
            <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {formatTime(summary.totalTime)}
            </p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">Time Spent</p>
          </CardContent>
        </Card>

        {/* Avg Per Card */}
        <Card>
          <CardContent className="pt-4 text-center sm:pt-6">
            <Clock
              className="mx-auto mb-2 h-6 w-6 text-purple-500 sm:h-8 sm:w-8"
              aria-hidden="true"
            />
            <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {summary.averageTimePerCard}s
            </p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">Avg Per Card</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Rating Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {ratingBreakdown.map((item) => (
              <div key={item.label} className={`p-3 text-center sm:p-4 ${item.bgColor} rounded-lg`}>
                <p className={`text-xl font-bold sm:text-2xl ${item.color}`}>{item.count}</p>
                <p className="mt-1 text-sm text-gray-700">{item.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Progress Transitions (Conditional) */}
      {showTransitions && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Made</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {summary.transitions.newToLearning > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">
                    🆕
                  </span>
                  <span className="font-semibold">{summary.transitions.newToLearning}</span> cards
                  moved to Learning
                </p>
              )}
              {summary.transitions.learningToReview > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">
                    📚
                  </span>
                  <span className="font-semibold">{summary.transitions.learningToReview}</span>{' '}
                  cards graduated to Review
                </p>
              )}
              {summary.transitions.reviewToMastered > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">
                    ✨
                  </span>
                  <span className="font-semibold">{summary.transitions.reviewToMastered}</span>{' '}
                  cards mastered!
                </p>
              )}
              {summary.transitions.toRelearning > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">
                    🔄
                  </span>
                  <span className="font-semibold">{summary.transitions.toRelearning}</span> cards
                  need review
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={onBackToDeck}
          className="flex-1 bg-gradient-to-br from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
        >
          Back to Deck
        </Button>
        <Button size="lg" variant="outline" onClick={onReviewAgain} className="flex-1">
          Review Again
        </Button>
        <Button size="lg" variant="ghost" onClick={onDashboard} className="hidden sm:block">
          Dashboard
        </Button>
      </div>
    </div>
  );
}
