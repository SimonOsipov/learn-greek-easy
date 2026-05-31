// src/pages/culture/CulturePage.tsx

import React, { useEffect, useState } from 'react';

import { AlertCircle, BookOpen, Flame, Target, Clock, CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { CultureHero } from '@/components/culture/redesign/CultureHero';
import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import { DecksGrid } from '@/components/decks/DecksGrid';
import { EmptyState } from '@/components/feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Kicker } from '@/features/decks/dx';
import '@/features/decks/dx/dx.css';
import { transformCultureDeckResponse } from '@/lib/cultureDeckTransform';
import { reportAPIError } from '@/lib/errorReporting';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureReadinessResponse } from '@/services/cultureDeckAPI';
import { progressAPI } from '@/services/progressAPI';
import type { DashboardStatsResponse } from '@/services/progressAPI';
import type { Deck } from '@/types/deck';

export const CulturePage: React.FC = () => {
  const { t } = useTranslation('culture');
  const location = useLocation();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<CultureReadinessResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStatsResponse | null>(null);

  const loadDecks = React.useCallback(() => {
    setError(null);
    setIsLoading(true);
    Promise.all([
      cultureDeckAPI.getList(),
      cultureDeckAPI.getReadiness().catch(() => null), // readiness is non-critical
      progressAPI.getDashboard().catch(() => null), // dashboard is non-critical
    ])
      .then(([res, readinessData, dashboardData]) => {
        setDecks(res.decks.map(transformCultureDeckResponse));
        setReadiness(readinessData);
        setDashboard(dashboardData);
      })
      .catch((err: unknown) => {
        reportAPIError(err, { operation: 'fetchCultureDecks', endpoint: '/api/v1/culture/decks' });
        setError(err instanceof Error ? err.message : 'Failed to load culture decks.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadDecks();
  }, [location.key, loadDecks]); // refetch on nav-back, mirroring DecksPage

  // ── Derived deck sections ──────────────────────────────────────────────────
  // deck.tags[0] holds the original API category (history, geography, politics, culture, traditions)
  const examDecks = decks.filter((d) => d.tags?.[0] === 'culture');
  const crossCuttingDecks = decks.filter((d) => d.tags?.[0] !== 'culture');

  // ── Resume deck: most recently practiced in-progress deck ────────────────
  const inProgress = decks.filter(
    (d) =>
      d.progress &&
      d.progress.cardsMastered > 0 &&
      d.progress.cardsMastered < (d.progress.cardsTotal ?? d.cardCount)
  );
  const resumeDeck =
    inProgress.reduce<Deck | undefined>((latest, d) => {
      if (!latest) return d;
      const a = d.progress?.lastStudied?.getTime() ?? -Infinity;
      const b = latest.progress?.lastStudied?.getTime() ?? -Infinity;
      return a > b ? d : latest;
    }, undefined) ?? decks[0];

  const resumePct =
    resumeDeck?.progress && resumeDeck.progress.cardsTotal > 0
      ? Math.round((resumeDeck.progress.cardsMastered / resumeDeck.progress.cardsTotal) * 100)
      : 0;

  const resumeStats = resumeDeck
    ? [
        {
          label: t('deck.questions', 'Questions'),
          value: String(resumeDeck.progress?.cardsTotal ?? resumeDeck.cardCount),
        },
        {
          label: t('deck.filterLearning', 'In review'),
          value: String(resumeDeck.progress?.cardsLearning ?? 0),
        },
        {
          label: t('list.complete', 'Complete %'),
          value: `${resumePct}%`,
        },
      ]
    : [];

  // Sibling covers for the hero stack (up to 2 decks that are NOT the resume deck)
  const siblingDecks = decks
    .filter((d) => d.id !== resumeDeck?.id)
    .slice(0, 2)
    .map((d) => ({ ...d, title: d.title }));

  // ── Readiness metric values ────────────────────────────────────────────────
  const readinessPct = readiness?.readiness_percentage ?? 0;
  const questionsLearned = readiness?.questions_learned ?? 0;
  const questionsTotal = readiness?.questions_total ?? decks.reduce((s, d) => s + d.cardCount, 0);

  const heroDescription = (() => {
    const p = resumeDeck?.progress;
    if (!p) return resumeDeck?.description ?? '';
    const answered = p.cardsMastered + p.cardsLearning;
    const deckTotal = p.cardsTotal ?? resumeDeck.cardCount;
    const vars = { answered, deckTotal, inReview: p.cardsLearning };
    return readiness
      ? t('hub.resumeSentence', {
          ...vars,
          examTotal: questionsTotal,
          pct: Math.round(readinessPct),
        })
      : t('hub.resumeSentenceNoReadiness', vars);
  })();

  const metrics = [
    {
      icon: <Target size={18} aria-hidden />,
      label: t('hub.metricReadiness', 'Exam readiness'),
      value: `${Math.round(readinessPct)}`,
      sub: '%',
      trend: t('hub.metricReadinessTrend', 'need 60% to pass'),
      trendTone: 'down' as const,
      tone: 'primary' as const,
    },
    {
      icon: <Flame size={18} aria-hidden />,
      label: t('hub.metricStreak', 'Streak'),
      value: String(dashboard?.streak.culture_current_streak ?? 0),
      sub: t('hub.days', 'days'),
      tone: 'amber' as const,
    },
    {
      icon: <CheckSquare size={18} aria-hidden />,
      label: t('hub.metricLearned', 'Questions learned'),
      value: `${questionsLearned}`,
      sub: `/ ${questionsTotal}`,
      trend:
        questionsTotal > 0
          ? t('hub.metricLearnedTrend', '{{pct}}% of total', {
              pct: Math.round((questionsLearned / questionsTotal) * 100),
            })
          : '',
      trendTone: 'flat' as const,
      tone: 'green' as const,
    },
    {
      icon: <Clock size={18} aria-hidden />,
      label: t('hub.metricWeek', 'This week'),
      value: '0',
      sub: t('hub.minutes', 'min'),
      trend: t('hub.metricWeekTrend', 'No culture source yet'),
      trendTone: 'flat' as const,
      tone: 'violet' as const,
      unwired: true,
      unwiredLabel: 'This week minutes — not yet connected to backend data.',
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="dx-index-head">
        <Kicker tone="primary">{t('hub.kicker', 'Browse · Cyprus culture & exam prep')}</Kicker>
        <h1 className="dx-index-h" data-testid="culture-title">
          {t('list.title')}
        </h1>
        <p className="text-sm text-fg2 md:text-base">{t('list.subtitle')}</p>
      </div>

      {/* ── Error State ─────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('list.errorLoading')}</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={loadDecks} className="mt-3 block">
              {t('list.tryAgain')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Loading State ────────────────────────────────────────────────────── */}
      {isLoading && !error && <DeckGridSkeleton />}

      {/* ── Loaded content ──────────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <>
          {/* Resume hero + mock-exam CTA */}
          {resumeDeck && (
            <CultureHero
              kicker={t('hub.heroKicker', 'Continue where you left off')}
              kickerTone="primary"
              title={resumeDeck.title}
              description={heroDescription}
              stats={resumeStats}
              ctas={[
                {
                  label: t('practice.continuePractice', 'Continue'),
                  to: `/culture/${resumeDeck.id}/practice`,
                  primary: true,
                },
                {
                  label: t('page.mockExamCta.cta', 'Take mock exam'),
                  to: '/practice/culture-exam',
                  primary: false,
                  testId: 'culture-mock-exam-cta',
                },
              ]}
              coverDeck={resumeDeck}
              siblingDecks={siblingDecks}
              coverFootPct={resumePct}
            />
          )}

          {/* Mock-exam CTA (when no resume deck so there's always a CTA).
              testId is on the Link itself so `culture-mock-exam-cta` is always the
              navigating link element, matching the hero CTA render path. */}
          {!resumeDeck && (
            <Link
              to="/practice/culture-exam"
              className="cx-cta-ghost"
              data-testid="culture-mock-exam-cta"
            >
              {t('page.mockExamCta.cta', 'Take mock exam')}
            </Link>
          )}

          {/* What's-new strip */}
          {decks.length > 0 && (
            <div className="cx-whatsnew">
              <span className="cx-whatsnew-chip">
                {t('hub.chipsExamDecks', '{{n}} cultural exam decks', { n: examDecks.length })}
              </span>
              <span className="cx-whatsnew-sep" aria-hidden />
              <span className="cx-whatsnew-chip">
                {t('hub.chipsQuestions', '{{n}} questions', { n: questionsTotal })}
              </span>
              <span className="cx-whatsnew-sep" aria-hidden />
              <span className="cx-whatsnew-chip">
                {t('hub.chipsCategories', '{{n}} categories', {
                  n:
                    new Set(crossCuttingDecks.map((d) => d.tags?.[0])).size ||
                    crossCuttingDecks.length,
                })}
              </span>
              <Link to="/culture/readiness" className="cx-whatsnew-cta">
                {t('hub.checkReadiness', 'Check readiness →')}
              </Link>
            </div>
          )}

          {/* Metric strip */}
          <CultureMetricStrip metrics={metrics} />

          {/* Section 1: Cultural exam decks */}
          {examDecks.length > 0 && (
            <section aria-label={t('hub.sectionExamLabel', 'Cultural exam decks')}>
              <div className="cx-section-head">
                <Kicker tone="violet">{t('hub.sectionExamKicker', 'Exam papers')}</Kicker>
                <h2 className="cx-section-h">
                  {t('hub.sectionExamTitle', 'Cultural exam decks')}
                  <span className="cx-section-meta">{examDecks.length}</span>
                </h2>
              </div>
              <DecksGrid
                decks={examDecks}
                ariaLabel={t('hub.sectionExamLabel', 'Cultural exam decks')}
                gridLayout="cx"
              />
            </section>
          )}

          {/* Section 2: Cross-cutting study decks */}
          {crossCuttingDecks.length > 0 && (
            <section aria-label={t('hub.sectionCrossLabel', 'Cross-cutting study decks')}>
              <div className="cx-section-head">
                <Kicker tone="cyan">{t('hub.sectionCrossKicker', 'Topic decks')}</Kicker>
                <h2 className="cx-section-h">
                  {t('hub.sectionCrossTitle', 'Cross-cutting study decks')}
                  <span className="cx-section-meta">{crossCuttingDecks.length}</span>
                </h2>
              </div>
              <DecksGrid
                decks={crossCuttingDecks}
                ariaLabel={t('hub.sectionCrossLabel', 'Cross-cutting study decks')}
                gridLayout="cx"
              />
            </section>
          )}

          {/* Fallback: show all decks together when no sectioning (e.g. during tests) */}
          {examDecks.length === 0 && crossCuttingDecks.length === 0 && decks.length > 0 && (
            <DecksGrid decks={decks} ariaLabel={t('list.ariaLabel')} />
          )}

          {/* Empty state */}
          {decks.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title={t('list.empty.title')}
              description={t('list.empty.description')}
            />
          )}
        </>
      )}
    </div>
  );
};

// Loading skeleton components
const DeckCardSkeleton: React.FC = () => {
  const { t } = useTranslation('deck');
  return (
    <div
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      role="status"
      aria-label={t('skeleton.loadingCard')}
    >
      <Skeleton className="h-1 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
};

const DeckGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <DeckCardSkeleton key={i} />
    ))}
  </div>
);
