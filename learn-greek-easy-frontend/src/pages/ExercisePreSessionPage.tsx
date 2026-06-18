import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  Clock,
  Flame,
  Headphones,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';

import { Kicker } from '@/components/ui/kicker';
import { UnwiredDot } from '@/features/decks/dx/atoms/UnwiredDot';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseModality, ExerciseQueueItem } from '@/services/exerciseAPI';
import { useExercisePracticeStore } from '@/stores/exercisePracticeStore';

import './exercise-dashboard.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

type ModalityFilter = 'all' | ExerciseModality;

/** Map exercise_type to a localized label using the provided t() function */
function exerciseTypeLabel(
  exerciseType: ExerciseQueueItem['exercise_type'],
  t: (key: string) => string
): string {
  switch (exerciseType) {
    case 'select_correct_answer':
      return t('exercises.dashboard.panels.recommended.typeLabel.select_correct_answer');
    case 'select_picture_from_description':
      return t('exercises.dashboard.panels.recommended.typeLabel.select_picture_from_description');
    case 'select_description_from_picture':
      return t('exercises.dashboard.panels.recommended.typeLabel.select_description_from_picture');
    default:
      return exerciseType;
  }
}

/** Map modality to family data-fam value */
function modalityToFam(modality: ExerciseModality | null): string {
  if (modality === 'reading') return 'reading';
  if (modality === 'listening') return 'listening';
  return 'reading';
}

/** Map modality to lucide icon component */
function ModalityIcon({ modality }: { modality: ExerciseModality | null }) {
  if (modality === 'listening') return <Headphones />;
  return <BookOpen />;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface MetricCardProps {
  tone: 'primary' | 'green' | 'amber' | 'violet';
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function MetricCard({ tone, icon, label, children }: MetricCardProps) {
  return (
    <div className="xd-metric" data-tone={tone}>
      <div className="xd-metric-icon">{icon}</div>
      <div className="xd-metric-body">
        <div className="xd-metric-l">{label}</div>
        <div className="xd-metric-v">{children}</div>
      </div>
    </div>
  );
}

interface PanelHeadProps {
  title: string;
  subtitle?: string;
}

function PanelHead({ title, subtitle }: PanelHeadProps) {
  return (
    <div className="xd-panel-head">
      <div>
        <h2 className="xd-panel-title">{title}</h2>
        {subtitle && <p className="xd-panel-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Completion Banner ───────────────────────────────────────────────────────

interface XdCompletionBannerProps {
  correct: number;
  total: number;
  accuracyPct: number;
  currentStreak: number;
  onPracticeAgain: () => void;
  onDismiss: () => void;
}

function XdCompletionBanner({
  correct,
  total,
  accuracyPct,
  currentStreak,
  onPracticeAgain,
  onDismiss,
}: XdCompletionBannerProps) {
  const { t } = useTranslation('common');
  const missed = total - correct;

  return (
    <div
      data-testid="xd-completion-banner"
      className="xd-complete"
      role="region"
      aria-label={t('exercises.dashboard.completion.title')}
    >
      <div className="xd-complete-mark" aria-hidden="true">
        <CheckCircle2 style={{ color: 'hsl(var(--success))', width: 28, height: 28 }} />
      </div>
      <div className="xd-complete-body">
        <h3 className="xd-complete-h">{t('exercises.dashboard.completion.title')}</h3>
        <p className="xd-complete-sub">
          {t('exercises.dashboard.completion.subtitle_other', { accuracy: accuracyPct, total })}
          {' · '}
          <b>{correct}</b> {t('exercises.dashboard.completion.correct')}, <b>{missed}</b>{' '}
          {t('exercises.dashboard.completion.missed')}.{' '}
          {currentStreak > 0 &&
            t('exercises.dashboard.completion.streak_other', { count: currentStreak })}
        </p>
      </div>
      <div className="xd-complete-actions">
        <button className="xd-complete-btn-primary" onClick={onPracticeAgain} type="button">
          <Play aria-hidden="true" />
          {t('exercises.dashboard.completion.practiceAgain')}
        </button>
        <button
          className="xd-complete-btn-glass"
          onClick={onDismiss}
          type="button"
          aria-label={t('exercises.dashboard.completion.dismiss')}
        >
          <X aria-hidden="true" />
          {t('exercises.dashboard.completion.dismiss')}
        </button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export const ExercisePreSessionPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const [modality, setModality] = useState<ModalityFilter>('all');

  // Route-state guard (D6): banner shows IFF sessionSummary is set AND we arrived from finish
  const fromFinish = (location.state as { fromFinish?: boolean } | null)?.fromFinish === true;
  const sessionSummary = useExercisePracticeStore((s) => s.sessionSummary);
  const clearSessionSummary = useExercisePracticeStore((s) => s.clearSessionSummary);

  const showBanner = fromFinish && sessionSummary !== null;

  // Fetch the full queue once, unfiltered; filter client-side per D8
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exerciseDashboardQueue'],
    queryFn: () => exerciseAPI.getQueue({}),
  });

  const { streak } = useStudyStreak();

  const totalInQueue = data ? data.total_due + data.total_new : 0;

  // Client-side filter by selected modality
  const filteredExercises: ExerciseQueueItem[] =
    data?.exercises.filter((ex) => {
      if (modality === 'all') return true;
      return ex.modality === modality;
    }) ?? [];

  const handleStartSession = () => {
    const query = modality !== 'all' ? `?modality=${modality}` : '';
    navigate(`/practice/exercises/session${query}`);
  };

  const handleStartFromCard = (item: ExerciseQueueItem) => {
    const params = new URLSearchParams();
    if (item.modality) params.set('modality', item.modality);
    if (item.situation_id) params.set('situation_id', item.situation_id);
    const qs = params.toString();
    navigate(`/practice/exercises/session${qs ? `?${qs}` : ''}`);
  };

  const modalityOptions: Array<{ value: ModalityFilter; label: string }> = [
    { value: 'all', label: t('exercises.dashboard.modality.all') },
    { value: 'listening', label: t('exercises.dashboard.modality.listening') },
    { value: 'reading', label: t('exercises.dashboard.modality.reading') },
  ];

  const currentStreak = streak?.currentStreak ?? null;
  const streakDisplay =
    currentStreak !== null && currentStreak > 0
      ? `${currentStreak} ${t('exercises.dashboard.metrics.streakDays', { count: currentStreak })}`
      : t('exercises.dashboard.metrics.streakNone');

  return (
    <div data-testid="exercise-pre-session-page" className="xd-main">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="xd-head">
        <div className="xd-head-l">
          <Kicker dot="primary" className="mb-2">
            {t('exercises.dashboard.kicker')}
          </Kicker>
          <h1 className="xd-h1">
            {t('exercises.dashboard.title')}{' '}
            <span className="xd-h1-en">{t('exercises.dashboard.titleSuffix')}</span>
          </h1>
          <p className="xd-sub">{t('exercises.dashboard.subtitle')}</p>
        </div>

        <div className="xd-head-actions" data-testid="dashboard-header-actions">
          {/* Start daily mix button */}
          <button
            className="xd-btn-start"
            onClick={handleStartSession}
            disabled={totalInQueue === 0 || isLoading}
            data-testid="start-daily-mix-btn"
          >
            <Play />
            {t('exercises.dashboard.startDailyMix')}
          </button>
          {/* Modality filter pills */}
          <div className="xd-modality-filter" data-testid="modality-filter">
            {modalityOptions.map(({ value, label }) => (
              <button
                key={value}
                className="xd-mod-pill"
                data-active={modality === value ? 'true' : 'false'}
                onClick={() => setModality(value)}
                aria-pressed={modality === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Completion banner (conditional) ────────────────────────────── */}
      {showBanner && sessionSummary && (
        <XdCompletionBanner
          correct={sessionSummary.correct}
          total={sessionSummary.total}
          accuracyPct={sessionSummary.accuracy_pct}
          currentStreak={streak?.currentStreak ?? 0}
          onPracticeAgain={() => {
            clearSessionSummary();
            navigate('/practice/exercises/session');
          }}
          onDismiss={() => {
            clearSessionSummary();
          }}
        />
      )}

      {/* ── Metric strip ───────────────────────────────────────────────── */}
      <div className="xd-metrics" data-testid="metric-strip">
        {/* Accuracy — RED-DOT */}
        <MetricCard
          tone="primary"
          icon={<TrendingUp />}
          label={t('exercises.dashboard.metrics.accuracy')}
        >
          <div className="xd-metric-placeholder">
            <UnwiredDot aria-label={t('exercises.dashboard.panels.accuracyChart.ariaLabel')} />
          </div>
        </MetricCard>

        {/* Exercises done — RED-DOT */}
        <MetricCard
          tone="green"
          icon={<CheckCircle />}
          label={t('exercises.dashboard.metrics.exercisesDone')}
        >
          <div className="xd-metric-placeholder">
            <UnwiredDot aria-label="Exercises done count — not yet connected to backend data." />
          </div>
        </MetricCard>

        {/* Current streak — REAL */}
        <MetricCard
          tone="amber"
          icon={<Flame />}
          label={t('exercises.dashboard.metrics.currentStreak')}
        >
          <span data-testid="current-streak-value">{streakDisplay}</span>
        </MetricCard>

        {/* Time practiced — RED-DOT */}
        <MetricCard
          tone="violet"
          icon={<Clock />}
          label={t('exercises.dashboard.metrics.timePracticed')}
        >
          <div className="xd-metric-placeholder">
            <UnwiredDot aria-label="Time practiced — not yet connected to backend data." />
          </div>
        </MetricCard>
      </div>

      {/* ── Panel grid ─────────────────────────────────────────────────── */}
      <div className="xd-grid">
        {/* Accuracy over time — RED-DOT (span 8) */}
        <div className="xd-panel xd-span-8" data-testid="panel-accuracy-chart">
          <PanelHead
            title={t('exercises.dashboard.panels.accuracyChart.title')}
            subtitle={t('exercises.dashboard.panels.accuracyChart.subtitle')}
          />
          <div className="xd-chart-placeholder" aria-hidden="true">
            {[40, 55, 48, 70, 60, 80, 65, 75, 55, 85, 70, 90].map((h, i) => (
              <div key={i} className="xd-chart-placeholder-bar" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="xd-placeholder-body">
            <UnwiredDot aria-label={t('exercises.dashboard.panels.accuracyChart.ariaLabel')} />
            <span className="xd-placeholder-label">
              {t('exercises.dashboard.panels.accuracyChart.subtitle')}
            </span>
          </div>
        </div>

        {/* Today's goal — RED-DOT (span 4) */}
        <div className="xd-panel xd-span-4" data-testid="panel-goal-ring">
          <PanelHead
            title={t('exercises.dashboard.panels.goal.title')}
            subtitle={t('exercises.dashboard.panels.goal.subtitle')}
          />
          <div className="xd-goal-placeholder">
            <div className="xd-ring-placeholder" aria-hidden="true" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="xd-week-placeholder" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="xd-week-placeholder-cell" />
                ))}
              </div>
            </div>
          </div>
          <div className="xd-placeholder-body">
            <UnwiredDot aria-label={t('exercises.dashboard.panels.goal.ariaLabel')} />
            <span className="xd-placeholder-label">
              {t('exercises.dashboard.panels.goal.subtitle')}
            </span>
          </div>
        </div>

        {/* Skill families — span 5 */}
        <div className="xd-panel xd-span-5" data-testid="panel-skill-families">
          <PanelHead
            title={t('exercises.dashboard.panels.skillFamilies.title')}
            subtitle={t('exercises.dashboard.panels.skillFamilies.subtitle')}
          />
          <div className="xd-fam-list">
            {/* Reading — REAL label, RED-DOT accuracy/mastery */}
            <div className="xd-fam-row" data-fam="reading">
              <div className="xd-fam-ic">
                <BookOpen />
              </div>
              <div className="xd-fam-mid">
                <div className="xd-fam-name">
                  {t('exercises.dashboard.panels.skillFamilies.reading')}
                </div>
                <div className="xd-fam-bar-track">
                  <span className="xd-fam-bar-fill" style={{ width: '0%' }} />
                </div>
              </div>
              <div className="xd-fam-acc-placeholder">
                <UnwiredDot
                  aria-label={t('exercises.dashboard.panels.skillFamilies.accuracyAriaLabel')}
                />
              </div>
            </div>

            {/* Listening — REAL label, RED-DOT accuracy/mastery */}
            <div className="xd-fam-row" data-fam="listening">
              <div className="xd-fam-ic">
                <Headphones />
              </div>
              <div className="xd-fam-mid">
                <div className="xd-fam-name">
                  {t('exercises.dashboard.panels.skillFamilies.listening')}
                </div>
                <div className="xd-fam-bar-track">
                  <span className="xd-fam-bar-fill" style={{ width: '0%' }} />
                </div>
              </div>
              <div className="xd-fam-acc-placeholder">
                <UnwiredDot
                  aria-label={t('exercises.dashboard.panels.skillFamilies.masteryAriaLabel')}
                />
              </div>
            </div>

            {/* Speaking — entirely RED-DOT (D5) */}
            <div className="xd-fam-row" data-fam="speaking">
              <div className="xd-fam-ic">
                <Zap />
              </div>
              <div className="xd-fam-mid">
                <div className="xd-fam-name">
                  {t('exercises.dashboard.panels.skillFamilies.speaking')}
                </div>
                <div className="xd-fam-bar-track">
                  <span className="xd-fam-bar-fill" style={{ width: '0%' }} />
                </div>
              </div>
              <div className="xd-fam-acc-placeholder">
                <UnwiredDot
                  aria-label={t('exercises.dashboard.panels.skillFamilies.speakingAriaLabel')}
                />
              </div>
            </div>

            {/* Production — entirely RED-DOT (D5) */}
            <div className="xd-fam-row" data-fam="production">
              <div className="xd-fam-ic">
                <Target />
              </div>
              <div className="xd-fam-mid">
                <div className="xd-fam-name">
                  {t('exercises.dashboard.panels.skillFamilies.production')}
                </div>
                <div className="xd-fam-bar-track">
                  <span className="xd-fam-bar-fill" style={{ width: '0%' }} />
                </div>
              </div>
              <div className="xd-fam-acc-placeholder">
                <UnwiredDot
                  aria-label={t('exercises.dashboard.panels.skillFamilies.productionAriaLabel')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Weak spots — RED-DOT (span 7) */}
        <div className="xd-panel xd-span-7" data-testid="panel-weak-spots">
          <PanelHead
            title={t('exercises.dashboard.panels.weakSpots.title')}
            subtitle={t('exercises.dashboard.panels.weakSpots.subtitle')}
          />
          <div className="xd-placeholder-body" style={{ flex: 1 }}>
            <UnwiredDot aria-label={t('exercises.dashboard.panels.weakSpots.ariaLabel')} />
            <span className="xd-placeholder-label">
              {t('exercises.dashboard.panels.weakSpots.subtitle')}
            </span>
          </div>
        </div>

        {/* Recommended for you — REAL (span 8) */}
        <div className="xd-panel xd-span-8" data-testid="panel-recommended">
          <PanelHead
            title={t('exercises.dashboard.panels.recommended.title')}
            subtitle={t('exercises.dashboard.panels.recommended.subtitle')}
          />

          {/* Loading */}
          {isLoading && (
            <div className="xd-rec-grid">
              {[0, 1].map((i) => (
                <div key={i} className="xd-rec-card" style={{ minHeight: 120 }}>
                  <div
                    className="animate-pulse"
                    style={{
                      height: 12,
                      width: '60%',
                      borderRadius: 6,
                      background: 'hsl(var(--fg) / 0.07)',
                    }}
                  />
                  <div
                    className="animate-pulse"
                    style={{
                      height: 16,
                      width: '80%',
                      borderRadius: 6,
                      background: 'hsl(var(--fg) / 0.07)',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <div className="xd-rec-empty">
              <AlertCircle style={{ width: 20, height: 20, color: 'hsl(var(--danger))' }} />
              <span className="xd-rec-empty-label">
                {t('exercises.dashboard.panels.recommended.errorLoad')}
              </span>
              <button
                onClick={() => void refetch()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'hsl(var(--primary))',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <RefreshCw style={{ width: 13, height: 13 }} />
                {t('exercises.dashboard.panels.recommended.errorRetry')}
              </button>
            </div>
          )}

          {/* Empty queue */}
          {!isLoading && !isError && filteredExercises.length === 0 && (
            <div className="xd-rec-empty" data-testid="recommended-empty">
              <span className="xd-rec-empty-label">
                {t('exercises.dashboard.panels.recommended.empty')}
              </span>
            </div>
          )}

          {/* Exercise cards — REAL */}
          {!isLoading && !isError && filteredExercises.length > 0 && (
            <div className="xd-rec-grid" data-testid="recommended-grid">
              {filteredExercises.slice(0, 4).map((item) => {
                const fam = modalityToFam(item.modality);
                return (
                  <button
                    key={item.exercise_id}
                    className="xd-rec-card"
                    data-fam={fam}
                    onClick={() => handleStartFromCard(item)}
                    data-testid="recommended-card"
                  >
                    <div className="xd-rec-top">
                      <span className="xd-rec-fam">
                        <span className="xd-rec-ic">
                          <ModalityIcon modality={item.modality} />
                        </span>
                        {item.modality ?? 'reading'}
                      </span>
                      {item.audio_level && <span className="xd-rec-level">{item.audio_level}</span>}
                    </div>
                    <p className="xd-rec-title">
                      {item.scenario_en ??
                        item.scenario_el ??
                        exerciseTypeLabel(item.exercise_type, t)}
                    </p>
                    <p className="xd-rec-type">{exerciseTypeLabel(item.exercise_type, t)}</p>
                    <div className="xd-rec-foot">
                      <span className="xd-rec-start">
                        <Play />
                        {t('exercises.dashboard.panels.recommended.startExercise')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sessions — RED-DOT (span 4) */}
        <div className="xd-panel xd-span-4" data-testid="panel-recent-sessions">
          <PanelHead
            title={t('exercises.dashboard.panels.recentSessions.title')}
            subtitle={t('exercises.dashboard.panels.recentSessions.subtitle')}
          />
          <div className="xd-placeholder-body" style={{ flex: 1 }}>
            <UnwiredDot aria-label={t('exercises.dashboard.panels.recentSessions.ariaLabel')} />
            <span className="xd-placeholder-label">
              {t('exercises.dashboard.panels.recentSessions.subtitle')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
