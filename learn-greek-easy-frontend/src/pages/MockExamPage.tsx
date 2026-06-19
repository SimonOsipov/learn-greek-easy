/**
 * Mock Exam Landing Page
 *
 * The single Culture-exam hub. Leads with the readiness donut + verdict hero,
 * then the exam launcher, metric strip, category progress, and recent history.
 */

import React, { useEffect, useRef } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  Flame,
  PlayCircle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import type { CultureMetric } from '@/components/culture/redesign/CultureMetricStrip';
import { Skeleton } from '@/components/ui/skeleton';
import '@/features/decks/dx/dx.css';
import { Breadcrumb, DxSvgDefs, Kicker } from '@/features/decks/dx';
import { track } from '@/lib/analytics';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CategoryReadiness, CultureReadinessResponse } from '@/services/cultureDeckAPI';
import { mockExamAPI } from '@/services/mockExamAPI';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamHistoryItem } from '@/types/mockExam';

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

// ────────────────────────────────────────────────────────────────────────────
// Readiness helpers (ported from CultureReadinessPage)
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

/** dot tone per category label (cycle through accent colours) */
function catDotTone(index: number): 'amber' | 'primary' | 'green' | undefined {
  const tones: Array<'amber' | 'primary' | 'green'> = ['amber', 'primary', 'green'];
  return tones[index % tones.length];
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

// ────────────────────────────────────────────────────────────────────────────
// Readiness sub-components (ported from CultureReadinessPage)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Large SVG donut ring. Uses cx-donut-* CSS from index.css.
 *
 * `centerLabel` is the localized readiness unit-label rendered under the
 * percentage ("45% Ready" = "45% readiness"). It is the UNIT, not the verdict —
 * the verdict has its own pill below the donut (cx-donut-verdict).
 */
function ReadinessDonut({ percent, centerLabel }: { percent: number; centerLabel: string }) {
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
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

/** Hero: donut + verdict pill + "what this means" explainer + learned/accuracy */
function ReadinessHero({ readiness }: { readiness: CultureReadinessResponse }) {
  const { t } = useTranslation('mockExam');
  const tone = readinessTone(readiness.readiness_percentage);
  const lowestCat = readiness.categories[0]; // sorted ascending by readiness_percentage
  const lowestDeckId = lowestCat?.deck_ids?.[0];

  return (
    <section className="dx-hero-resume">
      {/* DxSvgDefs provides the gradient for DonutRing if used; harmless here */}
      <DxSvgDefs />
      <div className="cx-readiness-hero-grid">
        {/* Col 1: donut + verdict pill */}
        <div className="cx-donut-wrap">
          <ReadinessDonut
            percent={readiness.readiness_percentage}
            centerLabel={t('readiness.donutLabel', 'Ready')}
          />
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
          {/* Only render the CTA when the weakest category has a real deck id —
              guard against a broken `/culture/decks/` link (CodeRabbit). */}
          {lowestCat && lowestDeckId && (
            <div className="cx-hero-ctas">
              <Link to={`/culture/decks/${lowestDeckId}`} className="cx-cta-ghost">
                {t('readiness.ctaPractice', {
                  category: capFirst(lowestCat.category),
                  defaultValue: 'Practice {{category}}',
                })}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Category bars panel */
function CategoryPanel({ categories }: { categories: CategoryReadiness[] }) {
  const { t } = useTranslation('mockExam');
  // lowest = categories[0] (API returns ascending)
  const lowest = categories[0];
  const lowestDeckId = lowest?.deck_ids?.[0];

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

      {/* Only render the CTA when the weakest category has a real deck id —
          guard against a broken `/culture/decks/` link (CodeRabbit). */}
      {lowest && lowestDeckId && (
        <Link
          to={`/culture/decks/${lowestDeckId}`}
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

/**
 * The single curated metric strip (Decision 1 + Decision 5).
 *
 * Curated set = Accuracy · Learned · Best score · Streak. The readiness donut
 * (hero) owns Readiness%, so it is NOT repeated here; the exam-volume stats
 * (Total exams / Pass rate / Average) are demoted to the recent-attempts meta
 * line, so they are not repeated as cards either (AC-4). Streak stays the
 * unwired `—` placeholder — there is no streak endpoint (AC-8 / Decision 4).
 *
 * Accuracy / Learned / category count come from readiness; Best score comes
 * from the mock-exam statistics. Both sources can be null (a readiness or stats
 * failure must not block the page, AC-6) — each metric degrades to `—`.
 *
 * NOTE: labels resolve via the `mockExam` namespace — the whole `readiness` key
 * block (including `metricBestScore`) was migrated culture → mockExam in
 * PRACT2-11-03, and all readiness sub-components now read from it.
 */
interface CuratedMetricStripProps {
  readiness: CultureReadinessResponse | null;
  bestScore: number | null;
}

const CuratedMetricStrip: React.FC<CuratedMetricStripProps> = ({ readiness, bestScore }) => {
  const { t } = useTranslation('mockExam');

  const accuracy = readiness?.accuracy_percentage ?? null;

  const metrics: CultureMetric[] = [
    {
      icon: <TrendingUp aria-hidden="true" />,
      label: t('readiness.metricAccuracy', 'Accuracy'),
      value: accuracy !== null ? Math.round(accuracy) : '—',
      sub: accuracy !== null ? '%' : undefined,
      trend: t('readiness.metricAccuracyTrend', 'on attempted questions'),
      trendTone: 'flat',
      tone: 'amber',
    },
    {
      icon: <BookOpen aria-hidden="true" />,
      label: t('readiness.metricLearned', 'Learned'),
      value: readiness?.questions_learned ?? '—',
      sub: readiness ? `/ ${readiness.questions_total}` : undefined,
      trend: t('readiness.metricLearnedTrend', {
        n: readiness?.categories.length ?? 0,
        defaultValue: 'across {{n}} categories',
      }),
      trendTone: 'flat',
      tone: 'violet',
    },
    {
      icon: <Award aria-hidden="true" />,
      label: t('readiness.metricBestScore', 'Best Score'),
      value: bestScore !== null ? Math.round(bestScore) : '—',
      sub: bestScore !== null ? '%' : undefined,
      tone: 'green',
    },
    {
      icon: <Flame aria-hidden="true" />,
      label: t('readiness.metricStreak', 'Streak'),
      value: '—',
      sub: t('readiness.days', 'days'),
      unwired: true,
      unwiredLabel: 'Streak — not yet connected to backend data.',
      tone: 'primary',
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
  // Note: the ported readiness sub-components (ReadinessHero, CategoryPanel,
  // CuratedMetricStrip) read their `t('readiness.*')` copy from the `mockExam`
  // namespace too — the readiness key block was migrated culture → mockExam in
  // PRACT2-11-03.
  const navigate = useNavigate();

  // Store state
  const hasRecoverableSession = useMockExamSessionStore((state) => state.hasRecoverableSession);
  const checkRecoverableSession = useMockExamSessionStore((state) => state.checkRecoverableSession);

  // Ref to prevent duplicate tracking
  const hasTrackedPageView = useRef(false);

  // ── Data fetch — TanStack useQuery for all three reads ────────────────────
  // retry: false on all three — the global QueryClient default is retry: 1,
  // which keeps `isLoading` true through a retry on failure and delays the
  // launcher skeleton→content transition. The pre-PRACT2-11 page settled
  // failures immediately (Promise.all + .catch(() => null)); retry: false
  // restores that immediate graceful degradation per AC-6.
  const readinessQuery = useQuery({
    queryKey: ['cultureReadiness'],
    queryFn: () => cultureDeckAPI.getReadiness(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const statsQuery = useQuery({
    queryKey: ['mockExamStatistics'],
    queryFn: () => mockExamAPI.getStatistics(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const queueQuery = useQuery({
    queryKey: ['mockExamQueue'],
    queryFn: () => mockExamAPI.getQuestionQueue(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  // Initial-load skeleton only: render content once all three queries have
  // SETTLED (resolved OR errored). A stats/queue/readiness FAILURE must NOT
  // block the page — each section degrades gracefully on its own (AC-6).
  const isLoading = readinessQuery.isLoading || statsQuery.isLoading || queueQuery.isLoading;

  const readiness = readinessQuery.data ?? null;
  const statistics = statsQuery.data ?? null;
  const queueInfo = queueQuery.data ?? null;

  // Check for a recoverable session once the queries settle.
  useEffect(() => {
    if (!isLoading) {
      checkRecoverableSession();
    }
  }, [isLoading, checkRecoverableSession]);

  // Track page view once statistics resolves successfully. Gated on the stats
  // query ONLY (today's payload is wholly stats-derived) — a readiness or queue
  // failure must neither suppress nor delay the event.
  useEffect(() => {
    if (
      !statsQuery.isLoading &&
      !statsQuery.isError &&
      statsQuery.data &&
      !hasTrackedPageView.current
    ) {
      hasTrackedPageView.current = true;
      track('mock_exam_page_viewed', {
        has_previous_attempts: (statsQuery.data.stats?.total_exams ?? 0) > 0,
        best_score: statsQuery.data.stats?.best_score ?? null,
        total_attempts: statsQuery.data.stats?.total_exams ?? 0,
      });
    }
  }, [statsQuery.isLoading, statsQuery.isError, statsQuery.data]);

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

      {/* Loading State — initial skeleton until all three queries settle */}
      {isLoading && (
        <>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <StatsLoadingSkeleton />
          <Skeleton className="h-14 w-full rounded-xl" />
          <HistoryLoadingSkeleton />
        </>
      )}

      {/* Main Content — renders once the initial load has settled, regardless
          of stats/queue/readiness errors. Readiness-derived sections below are
          ADDITIVE: each is gated on the presence of readiness data, so a
          readiness failure simply omits the hero/nudge/category while the
          launcher + stats + history still render (AC-6 graceful degradation). */}
      {!isLoading && (
        <>
          {/* Readiness hero (only when readiness data is present) */}
          {readiness && <ReadinessHero readiness={readiness} />}

          {/* Motivation nudge (only when set) */}
          {readiness?.motivation && (
            <div className="cx-nudge" role="note">
              <span className="cx-nudge-icon">
                <Zap aria-hidden="true" />
              </span>
              <span>{readiness.motivation.message_key}</span>
            </div>
          )}

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

          {/* The single curated metric strip: Accuracy · Learned · Best · Streak.
              Best score is null until there is at least one exam (so it renders
              `—`, not a meaningless 0). The donut owns Readiness% and the
              exam-volume stats live in the attempts meta — neither is duplicated
              here (AC-4). */}
          <CuratedMetricStrip
            readiness={readiness}
            bestScore={statistics?.stats.total_exams ? statistics.stats.best_score : null}
          />

          {/* Category progress panel (only when readiness data is present) */}
          {readiness?.categories && readiness.categories.length > 0 && (
            <CategoryPanel categories={readiness.categories} />
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
                        totalExams: statistics.stats.total_exams,
                        passRate: Math.round(statistics.stats.pass_rate),
                        average: Math.round(statistics.stats.average_score),
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
