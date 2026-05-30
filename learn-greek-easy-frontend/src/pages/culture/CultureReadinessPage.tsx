// src/pages/culture/CultureReadinessPage.tsx
//
// CX-01 Batch 3 — Exam Readiness full page.
// Data: cultureDeckAPI.getReadiness() + mockExamAPI.getStatistics()
// Design: /design_handoff_culture/culture.jsx ReadinessScreen + culture.css

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import '@/features/decks/dx/dx.css';
import { Breadcrumb, DxSvgDefs, Kicker } from '@/features/decks/dx';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CategoryReadiness, CultureReadinessResponse } from '@/services/cultureDeckAPI';
import { mockExamAPI } from '@/services/mockExamAPI';
import type { MockExamHistoryItem, MockExamStatisticsResponse } from '@/types/mockExam';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Tone driven by readiness % threshold: ≥60 → success, ≥30 → warning, else danger */
function readinessTone(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 60) return 'success';
  if (pct >= 30) return 'warning';
  return 'danger';
}

/** Human-readable verdict label */
function verdictLabel(
  verdict: CultureReadinessResponse['verdict'],
  t: (k: string, fb: string) => string
): string {
  const map: Record<string, string> = {
    not_ready: t('readiness.verdictNotReady', 'Not Ready'),
    getting_there: t('readiness.verdictGettingThere', 'Getting There'),
    ready: t('readiness.verdictReady', 'Ready'),
    thoroughly_prepared: t('readiness.verdictThoroughlyPrepared', 'Thoroughly Prepared'),
  };
  return map[verdict] ?? verdict;
}

/** Capitalise first letter for display (category names are lowercase from API) */
function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format seconds as "Xm Ys" */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/** Format ISO date string as "DD Mon YYYY" */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** dot tone per category label (cycle through accent colours) */
function catDotTone(index: number): 'amber' | 'primary' | 'green' | undefined {
  const tones: Array<'amber' | 'primary' | 'green'> = ['amber', 'primary', 'green'];
  return tones[index % tones.length];
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

/** Large SVG donut ring. Uses cx-donut-* CSS from index.css. */
function ReadinessDonut({ percent }: { percent: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const tone = readinessTone(percent);
  const offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <div className="cx-donut" data-tone={tone} aria-label={`${percent}% readiness`}>
      <svg viewBox="0 0 180 180">
        <circle className="cx-donut-track" cx="90" cy="90" r={r} strokeWidth="12" />
        <circle
          className="cx-donut-fill"
          cx="90"
          cy="90"
          r={r}
          strokeWidth="12"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="cx-donut-center">
        <b>{Math.round(percent)}%</b>
        <span>Ready</span>
      </div>
    </div>
  );
}

/** Hero: 3-col layout — donut | summary | (cover stack at ≥1100px) */
function ReadinessHero({
  readiness,
  examStats,
}: {
  readiness: CultureReadinessResponse;
  examStats: MockExamStatisticsResponse['stats'];
}) {
  const { t } = useTranslation('culture');
  const tone = readinessTone(readiness.readiness_percentage);
  const lowestCat = readiness.categories[0]; // sorted ascending by readiness_percentage

  return (
    <section className="dx-hero-resume">
      {/* DxSvgDefs provides the gradient for DonutRing if used; harmless here */}
      <DxSvgDefs />
      <div className="cx-readiness-hero-grid">
        {/* Col 1: donut + verdict pill */}
        <div className="cx-donut-wrap">
          <ReadinessDonut percent={readiness.readiness_percentage} />
          <span className="cx-donut-verdict" data-tone={tone}>
            {verdictLabel(readiness.verdict, t)}
          </span>
        </div>

        {/* Col 2: summary */}
        <div className="dx-hero-resume-l">
          <Kicker>{t('readiness.heroKicker', 'What this means')}</Kicker>
          <div>
            <h2 className="dx-hero-resume-h">
              {t('readiness.heroTitle', {
                learned: readiness.questions_learned,
                total: readiness.questions_total,
                defaultValue: '{{learned}} of {{total}} questions learned',
              })}
            </h2>
            {readiness.accuracy_percentage !== null && (
              <p className="dx-hero-resume-el">
                {t('readiness.heroAccuracy', {
                  pct: readiness.accuracy_percentage,
                  defaultValue: 'Overall accuracy {{pct}}%',
                })}
              </p>
            )}
          </div>
          <p className="dx-hero-resume-desc">
            {t(
              'readiness.heroDesc',
              'The Cyprus culture & history exam asks 25 questions in 45 minutes and you need 60% to pass. History and Politics are pulling your score down the most. Start there.'
            )}
          </p>
          <div className="dx-hero-resume-stats">
            <div className="dx-hero-resume-stat">
              <b>{examStats.total_exams}</b>
              <span>{t('readiness.heroMockExams', 'Mock exams')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{Math.round(examStats.average_score)}%</b>
              <span>{t('readiness.heroAverage', 'Average score')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{Math.round(examStats.best_score)}%</b>
              <span>{t('readiness.heroBest', 'Best score')}</span>
            </div>
          </div>
          <div className="cx-hero-ctas">
            <Link to="/practice/culture-exam" className="dx-action-cta">
              <GraduationCap aria-hidden="true" />
              {t('readiness.ctaMockExam', 'Take mock exam')}
            </Link>
            {lowestCat && (
              <Link to={`/culture/decks/${lowestCat.deck_ids[0] ?? ''}`} className="cx-cta-ghost">
                {t('readiness.ctaPractice', {
                  category: capFirst(lowestCat.category),
                  defaultValue: 'Practice {{category}}',
                })}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Category bars panel */
function CategoryPanel({ categories }: { categories: CategoryReadiness[] }) {
  const { t } = useTranslation('culture');
  // lowest = categories[0] (API returns ascending)
  const lowest = categories[0];

  return (
    <div className="dx-action">
      <div className="dx-action-head">
        <div className="dx-section-eyebrow">
          <Kicker tone="violet">{t('readiness.catEyebrow', "Where you're weakest")}</Kicker>
          <h2 className="dx-action-h">{t('readiness.catTitle', 'Progress by category')}</h2>
        </div>
        <span className="dx-action-pct">
          {t('readiness.catMeta', 'red bars are below 30% · pass-mark 60%')}
        </span>
      </div>

      <div className="cx-cat-list">
        {categories.map((cat, idx) => {
          const tone = readinessTone(cat.readiness_percentage);
          const dotTone = catDotTone(idx);
          return (
            <div key={cat.category} className="cx-cat-row">
              <div className="cx-cat-l" data-tone={dotTone}>
                {capFirst(cat.category)}
              </div>
              <div className="cx-cat-bar" data-tone={tone}>
                <span style={{ width: `${Math.max(cat.readiness_percentage, 1)}%` }} />
              </div>
              <div className="cx-cat-meta">
                <span className="cx-cat-pct">{Math.round(cat.readiness_percentage)}%</span>
                <span
                  className="cx-cat-accuracy"
                  data-tone={cat.accuracy_percentage !== null ? tone : undefined}
                >
                  {cat.accuracy_percentage !== null
                    ? t('readiness.catAccuracy', {
                        pct: Math.round(cat.accuracy_percentage),
                        defaultValue: 'Accuracy: {{pct}}%',
                      })
                    : t('readiness.catNoAttempts', 'No attempts yet')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {lowest && (
        <Link
          to={`/culture/decks/${lowest.deck_ids[0] ?? ''}`}
          className="dx-action-cta"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          {t('readiness.catCta', {
            category: capFirst(lowest.category),
            pct: Math.round(lowest.readiness_percentage),
            defaultValue: 'Practice {{category}} — {{pct}}% ready',
          })}
        </Link>
      )}
    </div>
  );
}

/** Recent mock exam attempts section */
function AttemptsSection({
  recentExams,
  stats,
}: {
  recentExams: MockExamHistoryItem[];
  stats: MockExamStatisticsResponse['stats'];
}) {
  const { t } = useTranslation('culture');

  return (
    <section className="dx-section">
      <div className="dx-section-head">
        <div className="dx-section-eyebrow">
          <Kicker tone="amber">{t('readiness.attemptsEyebrow', 'Recent mock exams')}</Kicker>
          <h2 className="dx-section-h">
            {t('readiness.attemptsTitle', {
              n: recentExams.length,
              defaultValue: 'Last {{n}} attempts',
            })}
          </h2>
        </div>
        {recentExams.length > 0 && (
          <span className="cx-section-meta">
            {t('readiness.attemptsMeta', {
              passRate: Math.round(stats.pass_rate),
              best: Math.round(stats.best_score),
              defaultValue: 'Pass rate: {{passRate}}% · Best: {{best}}%',
            })}
          </span>
        )}
      </div>

      {recentExams.length === 0 ? (
        <div className="cx-attempts-empty">
          <BookOpen aria-hidden="true" style={{ width: 40, height: 40, opacity: 0.4 }} />
          <p>{t('readiness.attemptsEmpty', 'No mock exams yet')}</p>
          <Link to="/practice/culture-exam" className="cx-cta-ghost">
            {t('readiness.ctaTakeMock', 'Take mock exam')}
          </Link>
        </div>
      ) : (
        <div className="cx-attempts">
          {recentExams.map((exam) => {
            const pct = Math.round((exam.score / exam.total_questions) * 100);
            const passStr = String(exam.passed);
            return (
              <div key={exam.id} className="cx-attempt">
                <span className="cx-attempt-icon" data-pass={passStr}>
                  {exam.passed ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <XCircle aria-hidden="true" />
                  )}
                </span>
                <div className="cx-attempt-body">
                  <div className="cx-attempt-h">
                    {exam.score}/{exam.total_questions} <small>({pct}%)</small>
                  </div>
                  <div className="cx-attempt-meta">
                    {formatDate(exam.completed_at)}
                    <span>·</span>
                    <Clock aria-hidden="true" style={{ width: 12, height: 12 }} />
                    {formatDuration(exam.time_taken_seconds)}
                  </div>
                </div>
                <span className="cx-attempt-score">{pct}%</span>
                <span className="cx-attempt-tag" data-pass={passStr}>
                  {exam.passed ? t('readiness.passed', 'Passed') : t('readiness.failed', 'Failed')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Loading skeleton for the full page */
function ReadinessPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export const CultureReadinessPage: React.FC = () => {
  const { t } = useTranslation('culture');

  const readinessQuery = useQuery({
    queryKey: ['cultureReadiness'],
    queryFn: () => cultureDeckAPI.getReadiness(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const examStatsQuery = useQuery({
    queryKey: ['mockExamStatistics'],
    queryFn: () => mockExamAPI.getStatistics(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const isLoading = readinessQuery.isLoading || examStatsQuery.isLoading;
  const isError = readinessQuery.isError || examStatsQuery.isError;

  const readiness = readinessQuery.data ?? null;
  const examStats = examStatsQuery.data ?? null;

  // Retry both queries
  const handleRetry = () => {
    void readinessQuery.refetch();
    void examStatsQuery.refetch();
  };

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const breadcrumb = (
    <Breadcrumb
      trail={[
        { label: t('readiness.breadcrumbCulture', 'Culture'), to: '/culture' },
        { label: t('readiness.breadcrumbReadiness', 'Exam Readiness') },
      ]}
    />
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 pb-20 lg:pb-8">
        {breadcrumb}
        <ReadinessPageSkeleton />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (isError || !readiness || !examStats) {
    return (
      <div className="space-y-6 pb-20 lg:pb-8">
        {breadcrumb}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('readiness.loadError', 'Failed to load readiness data')}</AlertTitle>
          <AlertDescription>
            {readinessQuery.error instanceof Error
              ? readinessQuery.error.message
              : examStatsQuery.error instanceof Error
                ? examStatsQuery.error.message
                : 'An error occurred.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={handleRetry}>
          {t('readiness.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  // ── Nudge banner (shown only when motivation is set) ──────────────────────
  const nudge = readiness.motivation;
  const overallTone = readinessTone(readiness.readiness_percentage);

  // ── Metric strip ──────────────────────────────────────────────────────────
  const needMore = Math.max(0, 60 - Math.round(readiness.readiness_percentage));

  const metrics = [
    {
      icon: <Target aria-hidden="true" />,
      label: t('readiness.metricReadiness', 'Readiness'),
      value: Math.round(readiness.readiness_percentage),
      sub: '%',
      trend: t('readiness.metricReadinessTrend', { n: needMore, defaultValue: 'need {{n}}% more' }),
      trendFlat: false,
      tone: 'green' as const,
    },
    {
      icon: <TrendingUp aria-hidden="true" />,
      label: t('readiness.metricAccuracy', 'Accuracy'),
      value:
        readiness.accuracy_percentage !== null ? Math.round(readiness.accuracy_percentage) : '—',
      sub: readiness.accuracy_percentage !== null ? '%' : undefined,
      trend: t('readiness.metricAccuracyTrend', 'on attempted questions'),
      trendFlat: true,
      tone: 'amber' as const,
    },
    {
      icon: <BookOpen aria-hidden="true" />,
      label: t('readiness.metricLearned', 'Learned'),
      value: readiness.questions_learned,
      sub: `/ ${readiness.questions_total}`,
      trend: t('readiness.metricLearnedTrend', {
        n: readiness.categories.length,
        defaultValue: 'across {{n}} categories',
      }),
      trendFlat: true,
      tone: 'violet' as const,
    },
    {
      icon: <Flame aria-hidden="true" />,
      label: t('readiness.metricStreak', 'Streak'),
      value: '—',
      sub: t('readiness.days', 'days'),
      unwired: true,
      unwiredLabel: 'Streak — not yet connected to backend data.',
      tone: 'primary' as const,
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Breadcrumb */}
      {breadcrumb}

      {/* Index head: kicker + H1 + subtitle */}
      <div className="dx-index-head">
        <Kicker tone={overallTone === 'danger' ? 'amber' : 'violet'}>
          {t('readiness.kicker', {
            total: readiness.questions_total,
            defaultValue: 'Exam readiness · {{total}} questions',
          })}
        </Kicker>
        <h1 className="dx-index-h">{t('readiness.title', 'Cyprus Culture Exam')}</h1>
        <p style={{ fontSize: 15, color: 'hsl(var(--fg-2))', margin: 0, lineHeight: 1.55 }}>
          {t(
            'readiness.subtitle',
            "An honest read on where you stand right now, what's pulling your score down, and what to study next."
          )}
        </p>
      </div>

      {/* Nudge banner */}
      {nudge && (
        <div className="cx-nudge" role="note">
          <span className="cx-nudge-icon">
            <Zap aria-hidden="true" />
          </span>
          <span>{nudge.message_key}</span>
        </div>
      )}

      {/* Readiness hero */}
      <ReadinessHero readiness={readiness} examStats={examStats.stats} />

      {/* Metric strip */}
      <CultureMetricStrip metrics={metrics} />

      {/* Category panel */}
      {readiness.categories.length > 0 && <CategoryPanel categories={readiness.categories} />}

      {/* Recent attempts */}
      <AttemptsSection recentExams={examStats.recent_exams} stats={examStats.stats} />
    </div>
  );
};
