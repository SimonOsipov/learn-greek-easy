/**
 * Mock Exam Landing Page
 *
 * Displays user statistics, recent exam history, and provides
 * entry point to start or continue mock citizenship exams.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';

import {
  GraduationCap,
  AlertCircle,
  Target,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import type { CultureMetric } from '@/components/culture/redesign/CultureMetricStrip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import '@/features/decks/dx/dx.css';
import { Breadcrumb, Kicker } from '@/features/decks/dx';
import { track } from '@/lib/analytics';
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
 * Loading skeleton for the metric strip (mirrors the dx-metric 4-up layout)
 */
const StatsLoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-2xl" />
    ))}
  </div>
);

/**
 * Loading skeleton for the recent-attempts section (mirrors cx-attempts rows)
 */
const HistoryLoadingSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-6 w-56" />
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
  const hasExams = Boolean(stats?.total_exams);

  const metrics: CultureMetric[] = [
    {
      icon: <GraduationCap aria-hidden="true" />,
      label: t('stats.totalExams'),
      value: stats?.total_exams ?? 0,
      tone: 'primary',
    },
    {
      icon: <Target aria-hidden="true" />,
      label: t('stats.passRate'),
      value: hasExams ? Math.round(stats!.pass_rate) : t('stats.notAvailable'),
      sub: hasExams ? '%' : undefined,
      tone: 'green',
    },
    {
      icon: <TrendingUp aria-hidden="true" />,
      label: t('stats.averageScore'),
      value: hasExams ? Math.round(stats!.average_score) : t('stats.notAvailable'),
      sub: hasExams ? '%' : undefined,
      tone: 'violet',
    },
    {
      icon: <Award aria-hidden="true" />,
      label: t('stats.bestScore'),
      value: hasExams ? Math.round(stats!.best_score) : t('stats.notAvailable'),
      sub: hasExams ? '%' : undefined,
      tone: 'amber',
    },
  ];

  return <CultureMetricStrip metrics={metrics} />;
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
  const passStr = String(exam.passed);

  return (
    <div className="cx-attempt">
      <span className="cx-attempt-icon" data-pass={passStr}>
        {exam.passed ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
      </span>
      <div className="cx-attempt-body">
        <div className="cx-attempt-h">
          {exam.score}/{exam.total_questions} <small>({percentage}%)</small>
        </div>
        <div className="cx-attempt-meta">
          {formatDate(exam.completed_at || exam.started_at)}
          <span>·</span>
          <Clock aria-hidden="true" style={{ width: 12, height: 12 }} />
          {/* span isolates the duration text node for the unit-test matcher; cx-attempt-meta styles children inline */}
          <span>{t('history.timeTaken', { minutes, seconds })}</span>
        </div>
      </div>
      <span className="cx-attempt-score">{percentage}%</span>
      <span className="cx-attempt-tag" data-pass={passStr}>
        {exam.passed ? t('history.passed') : t('history.failed')}
      </span>
    </div>
  );
};

/**
 * Empty history state
 */
const EmptyHistoryState: React.FC = () => {
  const { t } = useTranslation('mockExam');

  return (
    <div className="cx-attempts-empty">
      <BookOpen aria-hidden="true" style={{ width: 40, height: 40, opacity: 0.4 }} />
      <p>{t('history.empty')}</p>
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

  // Ref to prevent duplicate tracking
  const hasTrackedPageView = useRef(false);

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

  // Track page view after data loads
  useEffect(() => {
    if (!isLoading && !error && statistics && !hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      track('mock_exam_page_viewed', {
        has_previous_attempts: (statistics.stats?.total_exams ?? 0) > 0,
        best_score: statistics.stats?.best_score ?? null,
        total_attempts: statistics.stats?.total_exams ?? 0,
      });
    }
  }, [isLoading, error, statistics]);

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
      {/* Breadcrumb */}
      <Breadcrumb
        trail={[
          { label: t('breadcrumb.culture', 'Culture'), to: '/culture' },
          { label: t('breadcrumb.mock', 'Mock Exam') },
        ]}
      />

      {/* Index head: kicker + H1 + subtitle */}
      <div className="dx-index-head">
        <Kicker tone="violet">{t('page.kicker')}</Kicker>
        <h1 className="dx-index-h" data-testid="mock-exam-title">
          {t('page.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger" />
            <div className="flex-1">
              <h3 className="font-medium text-danger">{t('states.error')}</h3>
              <p className="mt-1 text-sm text-danger">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="mt-3 border-danger/40 text-danger hover:bg-danger/10"
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
          <Skeleton className="h-14 w-full rounded-xl" />
          <HistoryLoadingSkeleton />
        </>
      )}

      {/* Main Content */}
      {!isLoading && !error && (
        <>
          {/* Statistics Grid */}
          <StatsGrid stats={statistics?.stats ?? null} />

          {/* Action Buttons */}
          {hasRecoverableSession ? (
            <div className="cx-hero-ctas">
              <button
                type="button"
                className="cx-cta-primary"
                onClick={handleContinueExam}
                data-testid="continue-exam-button"
              >
                <RotateCcw aria-hidden="true" />
                {t('actions.continueExam')}
              </button>
              <button
                type="button"
                className="cx-cta-ghost"
                onClick={handleStartExam}
                disabled={!canStartExam}
                data-testid="start-exam-button"
              >
                {t('actions.startExam')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="dx-action-cta"
              onClick={handleStartExam}
              disabled={!canStartExam}
              data-testid="start-exam-button"
            >
              <PlayCircle aria-hidden="true" />
              {t('actions.startExam')}
            </button>
          )}

          {/* Not enough questions warning */}
          {!canStartExam && queueInfo && (
            <div className="cx-nudge" role="note">
              <span className="cx-nudge-icon">
                <AlertCircle aria-hidden="true" />
              </span>
              <span>{t('states.notEnoughQuestions')}</span>
            </div>
          )}

          {/* Recent History */}
          {(() => {
            const recentExams = statistics?.recent_exams?.slice(0, 5) ?? [];
            const hasAttempts = recentExams.length > 0;
            return (
              <section className="dx-section">
                <div className="dx-section-head">
                  <div className="dx-section-eyebrow">
                    <Kicker tone="amber">{t('history.eyebrow')}</Kicker>
                    <h2 className="dx-section-h">
                      {t('history.titleN', { n: recentExams.length })}
                    </h2>
                  </div>
                  {hasAttempts && statistics?.stats && (
                    <span className="cx-section-meta">
                      {t('history.meta', {
                        passRate: Math.round(statistics.stats.pass_rate),
                        best: Math.round(statistics.stats.best_score),
                      })}
                    </span>
                  )}
                </div>

                {hasAttempts ? (
                  <div className="cx-attempts">
                    {recentExams.map((exam) => (
                      <HistoryItemCard key={exam.id} exam={exam} />
                    ))}
                  </div>
                ) : (
                  <EmptyHistoryState />
                )}
              </section>
            );
          })()}
        </>
      )}
    </div>
  );
};
