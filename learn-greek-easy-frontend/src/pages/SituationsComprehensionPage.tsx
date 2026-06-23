/**
 * Situations Comprehension Overview Page (SIT-27-09 + SIT-27-10)
 *
 * The account-wide comprehension screen for the Situations track. Mirrors the
 * Culture MockExamPage readiness IA: a donut + verdict hero, an honest nudge
 * banner, a 4-up metric strip, per-topic confidence bars, and a recent-sessions
 * list — all fed by GET /situations/comprehension (SIT-27-04).
 *
 * Free / no paywall: registered under the no-role ProtectedRoute in App.tsx.
 *
 * Honesty note: the payload exposes real account-wide values
 * (comprehension_percentage, streak, whats_new_count, per-topic confidence) but
 * NO account-wide review aggregates. recent_sessions is capped at 5 rows, so the
 * hero stats use only the account-wide values; the recent-session badges
 * (pass/fail, Strong/Review) describe each row and are not framed as aggregates.
 */

import React, { useEffect, useRef } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  Sparkles,
  Target,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import type { CultureMetric } from '@/components/culture/redesign/CultureMetricStrip';
import { situationToCoverProps } from '@/components/situations/situationToCoverProps';
import { SituationTopicCatRow } from '@/components/situations/SituationTopicCatRow';
import { Skeleton } from '@/components/ui/skeleton';
import '@/features/decks/dx/dx.css';
import { Breadcrumb, DxCover, DxSvgDefs, Kicker } from '@/features/decks/dx';
import { track } from '@/lib/analytics';
import { situationAPI } from '@/services/situationAPI';
import type {
  RecentSession,
  SituationComprehensionResponse,
  TopicConfidence,
} from '@/types/situation';

const PRACTICE_ROUTE = '/practice/exercises';
/** Review-accuracy / score pass threshold, mirrors the culture exam pass-mark. */
const PASS_THRESHOLD = 60;
/** SM-2 quality at/above which a review row is tagged "Strong" rather than "Review". */
const STRONG_QUALITY = 4;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Tone driven by comprehension %: ≥60 → success, ≥30 → warning, else danger.
 *  Mirrors MockExamPage.readinessTone so the donut/verdict colours match. */
function comprehensionTone(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 60) return 'success';
  if (pct >= 30) return 'warning';
  return 'danger';
}

/** Map the shared verdict key to a localized label. Same 4 keys as readiness. */
function verdictLabel(verdict: string, t: (k: string, fb: string) => string): string {
  const map: Record<string, string> = {
    not_ready: t('situations.comprehension.verdictNotReady', 'Just starting'),
    getting_there: t('situations.comprehension.verdictGettingThere', 'Getting there'),
    ready: t('situations.comprehension.verdictReady', 'Confident'),
    thoroughly_prepared: t('situations.comprehension.verdictThoroughlyPrepared', 'Fluent'),
  };
  return map[verdict] ?? verdict;
}

/** Localized topic label (Listening / Reading / Dialogue / Visual). */
function topicLabel(topic: string, t: (k: string, fb: string) => string): string {
  const map: Record<string, string> = {
    Listening: t('situations.comprehension.topicListening', 'Listening'),
    Reading: t('situations.comprehension.topicReading', 'Reading'),
    Dialogue: t('situations.comprehension.topicDialogue', 'Dialogue'),
    Visual: t('situations.comprehension.topicVisual', 'Visual'),
  };
  return map[topic] ?? topic;
}

/** Cycle the label dot tone for visual variety, mirroring CategoryPanel. */
function catDotTone(index: number): 'amber' | 'primary' | 'green' {
  const tones: Array<'amber' | 'primary' | 'green'> = ['amber', 'primary', 'green'];
  return tones[index % tones.length];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Row %: score / max_score. max_score is ≥1 from the schema, but guard anyway. */
function sessionPct(s: RecentSession): number {
  return s.max_score > 0 ? Math.round((s.score / s.max_score) * 100) : 0;
}

/** The weakest topic (lowest confidence) drives the "Practise {topic}" CTA. */
function lowestTopic(topics: TopicConfidence[]): TopicConfidence | undefined {
  if (topics.length === 0) return undefined;
  return topics.reduce((min, c) => (c.confidence_percentage < min.confidence_percentage ? c : min));
}

// ────────────────────────────────────────────────────────────────────────────
// Loading skeletons
// ────────────────────────────────────────────────────────────────────────────

const HeroSkeleton: React.FC = () => <Skeleton className="h-64 w-full rounded-2xl" />;

const StripSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-2xl" />
    ))}
  </div>
);

const ListSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-6 w-56" />
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-xl" />
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Hero: donut + verdict + "what this means" + session stats + CTA + cover stack
// ────────────────────────────────────────────────────────────────────────────

interface HeroProps {
  data: SituationComprehensionResponse;
  cover?: ReturnType<typeof situationToCoverProps>;
}

const ComprehensionHero: React.FC<HeroProps> = ({ data, cover }) => {
  const { t } = useTranslation('common');
  const pct = data.comprehension_percentage;
  const tone = comprehensionTone(pct);
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);

  return (
    <section className="dx-hero-resume" data-testid="comprehension-hero">
      <DxSvgDefs />
      <div className="cx-readiness-hero-grid">
        {/* Col 1: donut + verdict pill */}
        <div className="cx-donut-wrap">
          <div
            className="cx-donut"
            data-tone={tone}
            aria-label={`${Math.round(pct)}% comprehension`}
          >
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
              <b data-testid="comprehension-donut-pct">{Math.round(pct)}%</b>
              <span>{t('situations.comprehension.donutLabel', 'understood')}</span>
            </div>
          </div>
          <span className="cx-donut-verdict" data-tone={tone} data-testid="comprehension-verdict">
            {verdictLabel(data.verdict, t)}
          </span>
        </div>

        {/* Col 2: "what this means" + session stats + CTA */}
        <div className="dx-hero-resume-l">
          <Kicker>{t('situations.comprehension.heroKicker', 'What this means')}</Kicker>
          <div>
            <h2 className="dx-hero-resume-h">
              {t('situations.comprehension.heroTitle', {
                pct: Math.round(pct),
                defaultValue: 'You understand about {{pct}}% of your situations',
              })}
            </h2>
          </div>
          <p className="dx-hero-resume-desc">
            {t(
              'situations.comprehension.heroDesc',
              'Comprehension is a weighted blend of how far each exercise has progressed through review. Keep practising the topics below to raise it.'
            )}
          </p>

          {/* Session stats — real account-wide values only (no over-5-row
              aggregates). Comprehension% is NOT repeated here: it already owns
              the donut and the metric strip; a third bare repeat would be noise. */}
          <div className="dx-hero-resume-stats">
            <div className="dx-hero-resume-stat">
              <b>{data.recent_sessions.length}</b>
              <span>{t('situations.comprehension.statSessions', 'Recent reviews')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{data.streak}</b>
              <span>{t('situations.comprehension.statStreak', 'Day streak')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{data.whats_new_count}</b>
              <span>{t('situations.comprehension.statWhatsNew', 'New this week')}</span>
            </div>
          </div>

          <div className="cx-hero-ctas">
            <Link
              to={PRACTICE_ROUTE}
              className="cx-cta-primary"
              data-testid="comprehension-practice-cta"
            >
              {t('situations.comprehension.ctaPractice', 'Practise exercises')}
            </Link>
          </div>
        </div>

        {/* Col 3: cover stack — hidden below 1100px by the grid CSS. */}
        {cover && (
          <div className="dx-cover-stack">
            <DxCover deck={cover} variant="stack-front" className="dx-cover dx-cover-3">
              <div className="dx-cover-foot">
                <span className="dx-cover-pct">{Math.round(pct)}%</span>
                <span className="dx-cover-bar">
                  <span style={{ width: `${Math.round(pct)}%` }} />
                </span>
              </div>
            </DxCover>
          </div>
        )}
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Recent session row (cx-attempt)
// ────────────────────────────────────────────────────────────────────────────

const RecentSessionRow: React.FC<{ session: RecentSession; index: number }> = ({
  session,
  index,
}) => {
  const { t } = useTranslation('common');
  const pct = sessionPct(session);
  const passed = pct >= PASS_THRESHOLD;
  const strong = session.quality >= STRONG_QUALITY;
  const passStr = String(passed);

  return (
    <div className="cx-attempt" data-testid={`comprehension-session-${index}`}>
      <span className="cx-attempt-icon" data-pass={passStr}>
        {passed ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
      </span>
      <div className="cx-attempt-body">
        <div className="cx-attempt-h">
          {session.score}/{session.max_score} <small>({pct}%)</small>
        </div>
        <div className="cx-attempt-meta">
          {formatDate(session.reviewed_at)}
          <span>·</span>
          <Clock aria-hidden="true" style={{ width: 12, height: 12 }} />
          <span>
            {t('situations.comprehension.sessionQuality', {
              quality: session.quality,
              defaultValue: 'quality {{quality}}/5',
            })}
          </span>
        </div>
      </div>
      <span className="cx-attempt-score">{pct}%</span>
      <span className="cx-attempt-tag" data-pass={String(strong)}>
        {strong
          ? t('situations.comprehension.tagStrong', 'Strong')
          : t('situations.comprehension.tagReview', 'Review')}
      </span>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export const SituationsComprehensionPage: React.FC = () => {
  const { t } = useTranslation('common');
  const hasTrackedPageView = useRef(false);

  // First situation drives the hero cover stack (purely decorative). Loaded
  // best-effort; a failure simply omits the cover column.
  const listQuery = useQuery({
    queryKey: ['situations', 'comprehension-cover'],
    queryFn: () => situationAPI.getList({ page: 1, page_size: 1 }),
    retry: false,
    staleTime: 60_000,
  });

  const comprehensionQuery = useQuery({
    queryKey: ['situations-comprehension'],
    queryFn: () => situationAPI.getComprehension(),
    retry: false,
    staleTime: 60_000,
  });

  const data = comprehensionQuery.data ?? null;
  const isLoading = comprehensionQuery.isLoading;
  const isError = comprehensionQuery.isError;

  const coverItem = listQuery.data?.items?.[0];
  const cover = coverItem ? situationToCoverProps(coverItem) : undefined;

  useEffect(() => {
    if (data && !hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      track('situation_comprehension_viewed', {
        comprehension_percentage: data.comprehension_percentage,
        verdict: data.verdict,
        streak: data.streak,
      });
    }
  }, [data]);

  // ── Derived view data (only when comprehension data is present) ────────────
  const topics = data?.topic_confidence ?? [];
  const confidentCount = topics.filter((c) => c.confidence_percentage >= PASS_THRESHOLD).length;
  const weakest = lowestTopic(topics);
  const sessions = data?.recent_sessions ?? [];

  const metrics: CultureMetric[] = data
    ? [
        {
          icon: <Gauge size={18} aria-hidden />,
          label: t('situations.comprehension.metricComprehension', 'Comprehension'),
          value: Math.round(data.comprehension_percentage),
          sub: '%',
          tone: 'violet',
        },
        {
          icon: <Target size={18} aria-hidden />,
          label: t('situations.comprehension.metricConfident', 'Confident in'),
          value: confidentCount,
          sub: t('situations.comprehension.metricConfidentSub', {
            total: topics.length,
            defaultValue: '/ {{total}} topics',
          }),
          tone: 'green',
        },
        {
          icon: <Flame size={18} aria-hidden />,
          label: t('situations.comprehension.metricStreak', 'Streak'),
          value: data.streak,
          sub: t('situations.comprehension.days', 'days'),
          tone: 'amber',
        },
        {
          icon: <Sparkles size={18} aria-hidden />,
          label: t('situations.comprehension.metricWhatsNew', 'New this week'),
          value: data.whats_new_count,
          tone: 'primary',
        },
      ]
    : [];

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="situations-comprehension-page">
      <Breadcrumb
        trail={[
          { label: t('situations.comprehension.breadcrumbHub', 'Situations'), to: '/situations' },
          { label: t('situations.comprehension.breadcrumb', 'Comprehension') },
        ]}
      />

      <div className="dx-index-head">
        <Kicker tone="violet">{t('situations.comprehension.kicker', 'Your progress')}</Kicker>
        <h1 className="dx-index-h" data-testid="comprehension-title">
          {t('situations.comprehension.title', 'Comprehension')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {t(
            'situations.comprehension.subtitle',
            'How well you understand your situations — and where to practise next.'
          )}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <>
          <HeroSkeleton />
          <StripSkeleton />
          <ListSkeleton />
        </>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="cx-nudge" role="alert" data-testid="comprehension-error">
          <span className="cx-nudge-icon">
            <Zap aria-hidden="true" />
          </span>
          <span>
            {t(
              'situations.comprehension.error',
              "We couldn't load your comprehension just now. Try again in a moment."
            )}
          </span>
        </div>
      )}

      {/* Loaded */}
      {!isLoading && !isError && data && (
        <>
          <ComprehensionHero data={data} cover={cover} />

          {/* Honest / warm nudge banner — default honest. */}
          <div className="cx-nudge" role="note" data-testid="comprehension-nudge">
            <span className="cx-nudge-icon">
              <Zap aria-hidden="true" />
            </span>
            <span>
              {weakest && weakest.confidence_percentage < PASS_THRESHOLD
                ? t('situations.comprehension.nudgeWeak', {
                    topic: topicLabel(weakest.topic, t),
                    defaultValue:
                      '{{topic}} is your weakest topic right now — a few reviews there will move the needle most.',
                  })
                : t(
                    'situations.comprehension.nudgeStrong',
                    'Solid progress across every topic. Keep your streak alive with a quick review.'
                  )}
            </span>
          </div>

          {/* 4-up metric strip */}
          <CultureMetricStrip metrics={metrics} />

          {/* Per-topic confidence bars */}
          <div className="dx-action" data-testid="comprehension-topics">
            <div className="dx-action-head">
              <div className="dx-section-eyebrow">
                <Kicker tone="violet">
                  {t('situations.comprehension.topicsEyebrow', 'By topic')}
                </Kicker>
                <h2 className="dx-action-h">
                  {t('situations.comprehension.topicsTitle', 'Comprehension by topic')}
                </h2>
              </div>
              <span className="dx-action-pct">
                {t('situations.comprehension.topicsMeta', 'red bars are below 40%')}
              </span>
            </div>

            <div className="cx-cat-list">
              {topics.map((c, idx) => (
                <SituationTopicCatRow
                  key={c.topic}
                  label={topicLabel(c.topic, t)}
                  confidence={c.confidence_percentage}
                  accuracy={c.accuracy}
                  dotTone={catDotTone(idx)}
                  testId={`comprehension-topic-${c.topic}`}
                />
              ))}
            </div>

            {weakest && (
              <Link
                to={PRACTICE_ROUTE}
                className="dx-action-cta"
                data-testid="comprehension-topic-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  textDecoration: 'none',
                }}
              >
                {t('situations.comprehension.topicCta', {
                  topic: topicLabel(weakest.topic, t),
                  pct: Math.round(weakest.confidence_percentage),
                  defaultValue: 'Practise {{topic}} — {{pct}}% confident',
                })}
              </Link>
            )}
          </div>

          {/* Recent sessions */}
          <section className="dx-section" data-testid="comprehension-recent">
            <div className="dx-section-head">
              <div className="dx-section-eyebrow">
                <Kicker tone="amber">
                  {t('situations.comprehension.recentEyebrow', 'Recent practice')}
                </Kicker>
                <h2 className="dx-section-h">
                  {t('situations.comprehension.recentTitle', {
                    n: sessions.length,
                    defaultValue: 'Last {{n}} reviews',
                  })}
                </h2>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div className="cx-attempts">
                {sessions.map((s, idx) => (
                  <RecentSessionRow key={`${s.reviewed_at}-${idx}`} session={s} index={idx} />
                ))}
              </div>
            ) : (
              <div className="cx-attempts-empty" data-testid="comprehension-recent-empty">
                <BookOpen aria-hidden="true" style={{ width: 40, height: 40, opacity: 0.4 }} />
                <p>
                  {t(
                    'situations.comprehension.recentEmpty',
                    'No reviews yet. Practise a situation to start building comprehension.'
                  )}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
