// src/pages/culture/CultureDeckDetailPage.tsx

/**
 * Culture Deck Detail Page — Batch 2 redesign (CX-01)
 *
 * Displays details of a culture deck and allows starting practice sessions.
 * Uses CultureHero, CultureMetricStrip, and dx-action* panel from the dx system.
 */

import React, { useEffect, useState } from 'react';

import { BookOpen, AlertCircle, RotateCcw, Trophy, Clock } from 'lucide-react';
import '@/features/decks/dx/dx.css';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { QuestionBrowser } from '@/components/culture/QuestionBrowser';
import { CultureHero } from '@/components/culture/redesign/CultureHero';
import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb, Kicker, UnwiredDot } from '@/features/decks/dx';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureDeckDetailResponse } from '@/services/cultureDeckAPI';

// ─────────────────────────────────────────────────────────────────────────────
// Topic chips — no backend data per question, rendered as non-functional UI
// ─────────────────────────────────────────────────────────────────────────────

const TOPIC_CHIPS = [
  { value: 'all', labelKey: 'detail.topicAll' },
  { value: 'politics', labelKey: 'detail.topicPolitics' },
  { value: 'culture', labelKey: 'detail.topicCulture' },
  { value: 'history', labelKey: 'detail.topicHistory' },
  { value: 'geography', labelKey: 'detail.topicGeography' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function CultureDeckDetailPage() {
  const { t, i18n } = useTranslation(['deck', 'culture']);
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<CultureDeckDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  const fetchDeck = React.useCallback(() => {
    if (!deckId) return;
    setIsLoading(true);
    setError(null);
    cultureDeckAPI
      .getById(deckId)
      .then(setDeck)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load deck. Please try again.';
        setError(msg);
      })
      .finally(() => setIsLoading(false));
  }, [deckId]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  // ── Guard states ───────────────────────────────────────────────────────────

  if (!deckId) {
    return <NotFoundState />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchDeck} />;
  }

  if (!deck) {
    return <NotFoundState />;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const deckName = getLocalizedDeckName(deck, i18n.language);
  const cultureCategory = deck.category;

  const prog = deck.progress;
  const total = prog?.questions_total ?? deck.question_count ?? 0;
  const mastered = prog?.questions_mastered ?? 0;
  const learning = prog?.questions_learning ?? 0;
  const newQ = prog?.questions_new ?? total;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  // "to practice" = new + due-learning (questions not yet mastered and not in-review)
  const toPractice = newQ + learning;

  const hasProgress = mastered > 0 || learning > 0;
  const ctaLabel =
    selectedTopic === 'all'
      ? hasProgress
        ? t('culture:practice.continuePractice', 'Continue Practice')
        : t('culture:practice.startPractice', 'Start Practice')
      : hasProgress
        ? `${t('culture:practice.continuePractice', 'Continue Practice')} · ${t(`culture:detail.topic${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)}`, selectedTopic)} ${t('culture:detail.topicOnly', 'only')}`
        : `${t('culture:practice.startPractice', 'Start Practice')} · ${t(`culture:detail.topic${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)}`, selectedTopic)} ${t('culture:detail.topicOnly', 'only')}`;

  // CultureHero expects a Deck-compatible object
  const coverDeck = {
    id: deck.id,
    level: 'A1' as const,
    category: 'culture' as const,
    coverImageUrl: deck.cover_image_url ?? undefined,
  };

  const heroKicker = `${cultureCategory.charAt(0).toUpperCase() + cultureCategory.slice(1)} · ${total} ${t('culture:deck.questions', 'questions')}`;

  const heroStats = [
    { label: t('culture:deck.questions', 'Questions'), value: total },
    {
      label: t('culture:detail.inReview', 'In review'),
      value: learning,
    },
    {
      label: t('culture:detail.completePct', 'Complete'),
      value: `${pct}%`,
    },
  ];

  const heroCtas = [
    {
      label: hasProgress
        ? t('culture:practice.continuePractice', 'Continue Practice')
        : t('culture:practice.startPractice', 'Start Practice'),
      to: `/culture/${deckId}/practice`,
      primary: true,
      testId: 'hero-practice-cta',
    },
  ];

  return (
    <div data-testid="deck-detail" className="container mx-auto px-4 py-6 md:py-8">
      {/* 1. Breadcrumb */}
      <div className="mb-6" data-testid="breadcrumb">
        <Breadcrumb
          trail={[
            { label: t('culture:list.title', 'Culture'), to: '/culture' },
            { label: deckName },
          ]}
        />
      </div>

      <div className="space-y-6">
        {/* 2. Resume hero */}
        <CultureHero
          kicker={heroKicker}
          kickerTone="primary"
          title={deckName}
          description={
            deck.description
              ? `${deck.description} ${t('culture:detail.examMirrorNote', 'Each deck mirrors the real citizenship exam.')}`
              : t('culture:detail.examMirrorNote', 'Each deck mirrors the real citizenship exam.')
          }
          stats={heroStats}
          ctas={heroCtas}
          coverDeck={coverDeck}
        />

        {/* 3. Metric strip — 4 cards */}
        <CultureMetricStrip
          metrics={[
            {
              icon: <BookOpen className="h-5 w-5" />,
              label: t('culture:detail.metricToPractice', 'To practice'),
              value: toPractice,
              tone: 'primary',
            },
            {
              icon: <RotateCcw className="h-5 w-5" />,
              label: t('culture:detail.metricInReview', 'In review'),
              value: learning,
              tone: 'amber',
            },
            {
              icon: <Trophy className="h-5 w-5" />,
              label: t('culture:detail.metricMastered', 'Mastered'),
              value: `${mastered}/${total}`,
              tone: 'green',
            },
            {
              icon: <Clock className="h-5 w-5" />,
              label: t('culture:detail.metricTimeOnDeck', 'Time on deck'),
              value: '—',
              sub: t('culture:hub.minutes', 'min'),
              tone: 'violet',
              // No time-on-deck backend source exists yet
              unwired: true,
              unwiredLabel: t(
                'culture:detail.metricTimeUnwired',
                'Time on deck — not yet connected to backend data.'
              ),
            },
          ]}
        />

        {/* 4. Action panel */}
        <div className="dx-action" data-testid="culture-action-panel">
          {/* Eyebrow kicker */}
          <Kicker tone="primary">
            {t('culture:detail.actionEyebrow', 'Pick what to practice')}
          </Kicker>

          {/* Progress head: title + pct */}
          <div className="dx-action-head">
            <h3 className="dx-action-h">
              {t('culture:detail.actionYourProgress', 'Your progress')} &middot;{' '}
              <span className="dx-action-pct">{pct}%</span>
            </h3>
          </div>

          {/* Counts line */}
          <div className="dx-action-legend">
            <span className="dx-action-legend-item" data-tone="todo">
              {t('culture:detail.actionCounts', {
                defaultValue: '{{new}} new · {{learning}} learning · {{mastered}} mastered',
                new: newQ,
                learning,
                mastered,
              })}
            </span>
          </div>

          {/* Gradient progress bar */}
          <div
            className="dx-action-bar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('culture:detail.progressBarLabel', 'Deck completion progress')}
          >
            <span data-testid="culture-action-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          {/* Legend */}
          <div className="dx-action-legend">
            <span className="dx-action-legend-item" data-tone="todo">
              {t('culture:detail.legendToPractice', 'To practice')}
            </span>
            <span className="dx-action-legend-item" data-tone="learn">
              {t('culture:detail.legendLearning', 'Learning')}
            </span>
            <span className="dx-action-legend-item" data-tone="master">
              {t('culture:detail.legendMastered', 'Mastered')}
            </span>
          </div>

          {/* Topic chips — not wired to filter; red-dot flags row as placeholder */}
          <div className="dx-action-want">
            <p className="dx-action-want-l">
              {t('culture:detail.actionTopicLabel', 'Topic')}
              {/* Red dot on the chip row — topic data does not exist per-question */}
              <UnwiredDot
                tone="danger"
                aria-label={t(
                  'culture:detail.topicUnwired',
                  'Topic filtering — not yet connected to backend data.'
                )}
              />
            </p>
            <div className="dx-action-want-chips">
              {TOPIC_CHIPS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  className="dx-action-want-chip"
                  aria-pressed={selectedTopic === value}
                  onClick={() => setSelectedTopic(value)}
                >
                  {t(`culture:${labelKey}`, value.charAt(0).toUpperCase() + value.slice(1))}
                </button>
              ))}
            </div>
          </div>

          {/* Full-width primary CTA */}
          <button
            type="button"
            className="dx-action-cta"
            data-testid="start-practice-button"
            onClick={() => navigate(`/culture/${deckId}/practice`)}
          >
            {ctaLabel}
          </button>
        </div>

        {/* 5. Question browser */}
        <div>
          <div className="cx-section-head mb-4">
            <Kicker tone="primary">
              {t('culture:detail.questionsEyebrow', 'Questions in this deck')}
            </Kicker>
          </div>
          <QuestionBrowser
            deckId={deckId}
            totalQuestions={deck.question_count}
            category={cultureCategory}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => {
  return (
    <div data-testid="deck-detail" className="container mx-auto px-4 py-6 md:py-8">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="space-y-6">
        {/* Hero skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <div className="flex gap-6">
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-12 w-20" />
              </div>
              <Skeleton className="h-12 w-48" />
            </div>
          </CardContent>
        </Card>

        {/* Metric strip skeleton */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>

        {/* Action panel skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-2 w-full" />
              <div className="flex gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-24 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Question grid skeleton */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:w-64" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-4 w-40" />
          <div
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            className="grid gap-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useTranslation('deck');

  return (
    <div data-testid="deck-detail" className="container mx-auto px-4 py-6 md:py-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('detail.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-practice-incorrect" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t('detail.error.failedToLoad')}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.error.description')}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              {t('detail.goBack')}
            </Button>
            <Button onClick={onRetry}>{t('detail.tryAgain')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Not found state
// ─────────────────────────────────────────────────────────────────────────────

const NotFoundState: React.FC = () => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();

  return (
    <div data-testid="deck-detail" className="container mx-auto px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button onClick={() => navigate('/culture')}>{t('detail.browseAll')}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CultureDeckDetailPage;
