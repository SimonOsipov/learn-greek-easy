import type { SessionSummary as SessionSummaryType } from '@/types/review';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, TrendingUp, Clock, Target } from 'lucide-react';
import {
  formatTime,
  getEncouragingMessage,
  getAccuracyColor,
  formatRatingBreakdown,
  hasProgressTransitions,
} from '@/lib/sessionSummaryUtils';

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
      <div className="w-full max-w-3xl mx-auto space-y-6 p-4">
        <Card className="text-center bg-gray-50">
          <CardContent className="pt-8 pb-6">
            <p className="text-lg text-gray-700 mb-4">
              Session ended without reviewing any cards.
            </p>
            <Button
              size="lg"
              onClick={onBackToDeck}
              className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
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
    <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 p-2 sm:p-4">
      {/* 1. Completion Message */}
      <Card
        className="text-center bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200"
        role="status"
        aria-live="polite"
      >
        <CardContent className="pt-6 sm:pt-8 pb-4 sm:pb-6">
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Session Complete!
          </h2>
          <p className="text-base sm:text-lg text-gray-700">{message}</p>
        </CardContent>
      </Card>

      {/* 2. Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Cards Reviewed */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 text-center">
            <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {summary.cardsReviewed}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Cards Reviewed</p>
          </CardContent>
        </Card>

        {/* Accuracy (PRIMARY METRIC) */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 text-center">
            <TrendingUp
              className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 ${accuracyColor}`}
              aria-hidden="true"
            />
            <p className={`text-2xl sm:text-3xl font-bold ${accuracyColor}`}>
              {summary.accuracy}%
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Accuracy</p>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 text-center">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatTime(summary.totalTime)}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Time Spent</p>
          </CardContent>
        </Card>

        {/* Avg Per Card */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 text-center">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {summary.averageTimePerCard}s
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Avg Per Card</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Rating Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {ratingBreakdown.map((item) => (
              <div
                key={item.label}
                className={`text-center p-3 sm:p-4 ${item.bgColor} rounded-lg`}
              >
                <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>
                  {item.count}
                </p>
                <p className="text-sm text-gray-700 mt-1">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.percentage}%</p>
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
                  <span className="mr-2" aria-hidden="true">🆕</span>
                  <span className="font-semibold">{summary.transitions.newToLearning}</span>{' '}
                  cards moved to Learning
                </p>
              )}
              {summary.transitions.learningToReview > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">📚</span>
                  <span className="font-semibold">{summary.transitions.learningToReview}</span>{' '}
                  cards graduated to Review
                </p>
              )}
              {summary.transitions.reviewToMastered > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">✨</span>
                  <span className="font-semibold">{summary.transitions.reviewToMastered}</span>{' '}
                  cards mastered!
                </p>
              )}
              {summary.transitions.toRelearning > 0 && (
                <p className="text-gray-700">
                  <span className="mr-2" aria-hidden="true">🔄</span>
                  <span className="font-semibold">{summary.transitions.toRelearning}</span>{' '}
                  cards need review
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          onClick={onBackToDeck}
          className="flex-1 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          Back to Deck
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onReviewAgain}
          className="flex-1"
        >
          Review Again
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={onDashboard}
          className="hidden sm:block"
        >
          Dashboard
        </Button>
      </div>
    </div>
  );
}
