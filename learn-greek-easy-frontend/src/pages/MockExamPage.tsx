/**
 * Mock Exam Landing Page
 *
 * Displays user statistics, recent exam history, and provides
 * entry point to start or continue mock citizenship exams.
 */

import React, { useEffect, useState, useCallback } from 'react';

import {
  GraduationCap,
  AlertCircle,
  Trophy,
  Target,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import log from '@/lib/logger';
import { mockExamAPI } from '@/services/mockExamAPI';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type {
  MockExamStatisticsResponse,
  MockExamQueueResponse,
  MockExamHistoryItem,
} from '@/types/mockExam';

/**
 * Format seconds to "Xm Ys" format
 */
function formatTime(totalSeconds: number): { minutes: number; seconds: number } {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Loading skeleton for stats cards
 */
const StatsLoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i}>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-16" />
        </CardContent>
      </Card>
    ))}
  </div>
);

/**
 * Loading skeleton for history list
 */
const HistoryLoadingSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </CardContent>
      </Card>
    ))}
  </div>
);

/**
 * Statistics grid displaying exam performance metrics
 */
interface StatsGridProps {
  stats: MockExamStatisticsResponse['stats'] | null;
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const { t } = useTranslation('mockExam');

  const statsConfig = [
    {
      key: 'totalExams',
      label: t('stats.totalExams'),
      value: stats?.total_exams ?? 0,
      icon: GraduationCap,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    },
    {
      key: 'passRate',
      label: t('stats.passRate'),
      value: stats?.total_exams ? `${Math.round(stats.pass_rate)}%` : t('stats.notAvailable'),
      icon: Target,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/50',
    },
    {
      key: 'averageScore',
      label: t('stats.averageScore'),
      value: stats?.total_exams ? `${Math.round(stats.average_score)}%` : t('stats.notAvailable'),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    },
    {
      key: 'bestScore',
      label: t('stats.bestScore'),
      value: stats?.total_exams ? `${Math.round(stats.best_score)}%` : t('stats.notAvailable'),
      icon: Award,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {statsConfig.map(({ key, label, value, icon: Icon, color, bgColor }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className={`rounded-full p-3 ${bgColor}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/**
 * History item component
 */
interface HistoryItemProps {
  exam: MockExamHistoryItem;
}

const HistoryItemCard: React.FC<HistoryItemProps> = ({ exam }) => {
  const { t } = useTranslation('mockExam');
  const { minutes, seconds } = formatTime(exam.time_taken_seconds);
  const percentage = Math.round((exam.score / exam.total_questions) * 100);

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              exam.passed ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'
            }`}
          >
            {exam.passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {t('history.score', { score: exam.score, total: exam.total_questions })}
              </span>
              <span className="text-sm text-muted-foreground">
                ({t('history.percentage', { percentage })})
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{formatDate(exam.completed_at || exam.started_at)}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t('history.timeTaken', { minutes, seconds })}
              </span>
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            exam.passed
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
          }`}
        >
          {exam.passed ? t('history.passed') : t('history.failed')}
        </span>
      </CardContent>
    </Card>
  );
};

/**
 * Empty history state
 */
const EmptyHistoryState: React.FC = () => {
  const { t } = useTranslation('mockExam');

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Trophy className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="mt-4 max-w-sm text-muted-foreground">{t('history.empty')}</p>
    </div>
  );
};

/**
 * Mock Exam Landing Page Component
 */
export const MockExamPage: React.FC = () => {
  const { t } = useTranslation('mockExam');
  const navigate = useNavigate();

  // Local state
  const [statistics, setStatistics] = useState<MockExamStatisticsResponse | null>(null);
  const [queueInfo, setQueueInfo] = useState<MockExamQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store state
  const hasRecoverableSession = useMockExamSessionStore((state) => state.hasRecoverableSession);
  const checkRecoverableSession = useMockExamSessionStore((state) => state.checkRecoverableSession);

  /**
   * Load statistics and queue info
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch statistics and queue info in parallel
      const [statsResponse, queueResponse] = await Promise.all([
        mockExamAPI.getStatistics().catch((err) => {
          log.error('Failed to load statistics:', err);
          return null;
        }),
        mockExamAPI.getQuestionQueue().catch((err) => {
          log.error('Failed to load queue info:', err);
          return null;
        }),
      ]);

      setStatistics(statsResponse);
      setQueueInfo(queueResponse);

      // Check for recoverable session
      checkRecoverableSession();
    } catch (err) {
      log.error('Failed to load mock exam data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [checkRecoverableSession]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle start exam button click
   */
  const handleStartExam = () => {
    navigate('/practice/culture-exam/session');
  };

  /**
   * Handle continue exam button click
   */
  const handleContinueExam = () => {
    navigate('/practice/culture-exam/session');
  };

  const canStartExam = queueInfo?.can_start_exam ?? false;

  return (
    <div className="space-y-6 pb-8" data-testid="mock-exam-page">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="mock-exam-title"
        >
          {t('page.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-100">{t('states.error')}</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
              >
                {t('states.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <>
          <StatsLoadingSkeleton />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <HistoryLoadingSkeleton />
            </CardContent>
          </Card>
        </>
      )}

      {/* Main Content */}
      {!isLoading && !error && (
        <>
          {/* Statistics Grid */}
          <StatsGrid stats={statistics?.stats ?? null} />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            {hasRecoverableSession && (
              <Button
                size="lg"
                onClick={handleContinueExam}
                className="gap-2"
                data-testid="continue-exam-button"
              >
                <RotateCcw className="h-5 w-5" />
                {t('actions.continueExam')}
              </Button>
            )}
            <Button
              size="lg"
              variant={hasRecoverableSession ? 'outline' : 'default'}
              onClick={handleStartExam}
              disabled={!canStartExam}
              className="gap-2"
              data-testid="start-exam-button"
            >
              <PlayCircle className="h-5 w-5" />
              {t('actions.startExam')}
            </Button>
          </div>

          {/* Not enough questions warning */}
          {!canStartExam && queueInfo && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t('states.notEnoughQuestions')}
                </p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('history.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {statistics?.recent_exams && statistics.recent_exams.length > 0 ? (
                <div className="space-y-3">
                  {statistics.recent_exams.slice(0, 5).map((exam) => (
                    <HistoryItemCard key={exam.id} exam={exam} />
                  ))}
                </div>
              ) : (
                <EmptyHistoryState />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
