// src/pages/ExercisePracticePage.tsx

/**
 * Exercise Practice Session Page — PRACT2-12-05 redesign
 *
 * Full-screen practice experience with a 2-col layout:
 *   Left: session bar (Exit + progress) + question or result panel
 *   Right rail (sticky): Live stats + Session stepper
 *
 * Routing and full-screen wrapper are unchanged from the pre-redesign version.
 * The store's auto-advance timer is removed; `phase` drives question/result switch.
 */

import { useEffect, useCallback, useState, useRef } from 'react';

import { AlertCircle, CheckCircle2, Flame, BarChart2, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { ExerciseContentStep } from '@/components/exercises/ExerciseContentStep';
import { SelectCorrectAnswerRenderer } from '@/components/exercises/SelectCorrectAnswerRenderer';
import { SelectDescriptionFromPictureCard } from '@/components/exercises/SelectDescriptionFromPictureCard';
import { SelectPictureFromDescriptionCard } from '@/components/exercises/SelectPictureFromDescriptionCard';
import { XdResult } from '@/components/exercises/XdResult';
import { LanguageSwitcher } from '@/components/i18n';
import { PracticeHeader, ProgressIndicator } from '@/components/practice';
import { QuestionLanguageSelector } from '@/components/shared';
import { ThemeSwitcher } from '@/components/theme';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePracticeKeyboard } from '@/hooks/usePracticeKeyboard';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { track } from '@/lib/analytics/track';
import type { ExerciseModality, ExerciseQueueItem } from '@/services/exerciseAPI';
import { useExercisePracticeStore } from '@/stores/exercisePracticeStore';
import { useQuestionLanguageStore } from '@/stores/questionLanguageStore';
import { selectLiveStats, selectStepperStatus } from '@/stores/sessionSelectors';

import './exercise-dashboard.css';

// ============================================
// XdSessBar — top bar for the session
// ============================================

interface XdSessBarProps {
  currentIndex: number;
  total: number;
  onExit: () => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

function XdSessBar({ currentIndex, total, onExit, language, onLanguageChange }: XdSessBarProps) {
  const { t } = useTranslation('common');
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div
      className="xd-sessbar flex flex-wrap items-center gap-2 border-b px-4 py-2"
      style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--bg))' }}
    >
      <button
        type="button"
        onClick={onExit}
        data-testid="exercise-practice-close-button"
        className="flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors hover:opacity-80"
        style={{ color: 'hsl(var(--fg-2))' }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t('exercises.session.backToExercises')}
      </button>

      <span className="text-sm font-medium" style={{ color: 'hsl(var(--fg))' }}>
        {t('exercises.dashboard.startDailyMix')}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs tabular-nums" style={{ color: 'hsl(var(--fg-2))' }}>
          {Math.min(currentIndex + 1, total)}&nbsp;/&nbsp;{total}
        </span>
        <div className="xd-sessbar-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <QuestionLanguageSelector
          value={language as 'el' | 'en' | 'ru'}
          onChange={(lang) => onLanguageChange(lang)}
          variant="pill"
          size="sm"
        />
        <LanguageSwitcher variant="icon" />
        <ThemeSwitcher />
      </div>
    </div>
  );
}

// ============================================
// XdLiveStats — live stats rail card
// ============================================

interface XdLiveStatsProps {
  correct: number;
  missed: number;
  accuracyPct: number;
  elapsedSeconds: number;
  currentStreak?: number;
}

function XdLiveStats({
  correct,
  missed,
  accuracyPct,
  elapsedSeconds,
  currentStreak,
}: XdLiveStatsProps) {
  const { t } = useTranslation('common');
  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const ss = String(elapsedSeconds % 60).padStart(2, '0');

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'hsl(var(--card))' }}>
      <div
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'hsl(var(--fg-2))' }}
      >
        <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('exercises.session.rail.liveStats')}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div
          className="flex flex-col items-center rounded-lg px-2 py-2"
          style={{ backgroundColor: 'hsl(var(--bg))' }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--success))' }}>
            {correct}
          </span>
          <span className="text-xs" style={{ color: 'hsl(var(--fg-2))' }}>
            {t('exercises.session.correct')}
          </span>
        </div>
        <div
          className="flex flex-col items-center rounded-lg px-2 py-2"
          style={{ backgroundColor: 'hsl(var(--bg))' }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--danger))' }}>
            {missed}
          </span>
          <span className="text-xs" style={{ color: 'hsl(var(--fg-2))' }}>
            {t('exercises.session.rail.missed')}
          </span>
        </div>
        <div
          className="flex flex-col items-center rounded-lg px-2 py-2"
          style={{ backgroundColor: 'hsl(var(--bg))' }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--fg))' }}>
            {accuracyPct}%
          </span>
          <span className="text-xs" style={{ color: 'hsl(var(--fg-2))' }}>
            {t('exercises.session.accuracy')}
          </span>
        </div>
        <div
          className="flex flex-col items-center rounded-lg px-2 py-2"
          style={{ backgroundColor: 'hsl(var(--bg))' }}
        >
          <span className="xd-livestat-elapsed text-lg font-bold tabular-nums">
            {mm}:{ss}
          </span>
          <span className="text-xs" style={{ color: 'hsl(var(--fg-2))' }}>
            {t('exercises.session.rail.elapsed')}
          </span>
        </div>
      </div>

      {currentStreak !== undefined && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: 'hsl(var(--bg))' }}
        >
          <div className="xd-rail-flame" aria-hidden="true">
            <Flame />
          </div>
          <div>
            <div className="text-sm font-semibold tabular-nums" style={{ color: 'hsl(var(--fg))' }}>
              {currentStreak} {t('exercises.session.rail.streakDays', { count: currentStreak })}
            </div>
            <div className="text-xs" style={{ color: 'hsl(var(--fg-2))' }}>
              {t('exercises.session.rail.streakSubline')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// XdStepper — per-exercise status dots
// ============================================

interface XdStepperProps {
  statuses: ('correct' | 'incorrect' | 'current' | 'pending')[];
  currentIndex: number;
  total: number;
  queue: ExerciseQueueItem[];
}

/** Map exercise_type to a localized label (mirrors ExercisePreSessionPage helper) */
function stepperTypeLabel(
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

function XdStepper({ statuses, currentIndex, total, queue }: XdStepperProps) {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'hsl(var(--card))' }}>
      <div
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'hsl(var(--fg-2))' }}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        {t('exercises.session.stepper.header')} ·{' '}
        {
          Object.keys(statuses).filter(
            (_, i) => statuses[i] === 'correct' || statuses[i] === 'incorrect'
          ).length
        }
        /{total}
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: '320px' }}>
        {statuses.map((status, i) => {
          const item = queue[i];
          const typeLabel = item
            ? stepperTypeLabel(item.exercise_type, t)
            : t('exercises.session.stepper.exerciseN', { n: i + 1 });
          const modality = item?.modality ?? null;
          const level = item?.audio_level ?? null;
          const subline = modality || level ? [modality, level].filter(Boolean).join(' · ') : null;

          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
              style={{
                backgroundColor: i === currentIndex ? 'hsl(var(--bg))' : 'transparent',
                fontWeight: i === currentIndex ? '600' : '400',
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor:
                    status === 'correct'
                      ? 'hsl(var(--success))'
                      : status === 'incorrect'
                        ? 'hsl(var(--danger))'
                        : status === 'current'
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--border))',
                  color:
                    status === 'pending' ? 'hsl(var(--fg-2))' : 'hsl(var(--primary-foreground))',
                }}
                aria-hidden="true"
              >
                {status === 'correct'
                  ? '✓'
                  : status === 'incorrect'
                    ? '✗'
                    : String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  style={{ color: status === 'pending' ? 'hsl(var(--fg-2))' : 'hsl(var(--fg))' }}
                >
                  {typeLabel}
                </div>
                {subline && <div className="xd-step-fam">{subline}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export const ExercisePracticePage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modalityParam = searchParams.get('modality');

  // Only pass ExerciseModality (not 'all') to store
  const modality =
    modalityParam === 'listening' || modalityParam === 'reading'
      ? (modalityParam as ExerciseModality)
      : undefined;

  const {
    queue,
    currentIndex,
    isLoading,
    error,
    feedbackState,
    phase,
    sessionSummary,
    answers,
    sessionStartTime,
    exerciseStartTime,
    startSession,
    submitAnswer,
    advance,
    resetSession,
    clearError,
  } = useExercisePracticeStore();

  const { language, setLanguage } = useQuestionLanguageStore();
  const { streak } = useStudyStreak();

  const currentExercise = queue[currentIndex] ?? null;
  const sessionComplete = sessionSummary !== null;
  const [showExitDialog, setShowExitDialog] = useState(false);

  // One-shot guard: prevents double-navigation on re-renders after sessionComplete
  const hasNavigatedRef = useRef(false);

  // 1s elapsed tick — lives in the page, not the store
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionStartTime || sessionComplete) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      return;
    }
    // Initialize from sessionStartTime
    setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [sessionStartTime, sessionComplete]);

  // Mount: start session
  useEffect(() => {
    startSession(modality).catch(() => {});
  }, [modality]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live stats + stepper from pure selectors
  const liveStats = selectLiveStats({ queue, currentIndex, answers });
  const stepperStatuses = selectStepperStatus({ queue, currentIndex, answers });

  // Navigation
  const backToExercises = useCallback(() => {
    resetSession();
    navigate('/practice/exercises');
  }, [navigate, resetSession]);

  // Exit logic
  const handleExit = useCallback(() => {
    if (Object.keys(answers).length > 0 && !sessionComplete) {
      setShowExitDialog(true);
    } else {
      backToExercises();
    }
  }, [answers, sessionComplete, backToExercises]);

  const handleConfirmedExit = useCallback(() => {
    setShowExitDialog(false);
    backToExercises();
  }, [backToExercises]);

  // Answer handler
  const handleAnswer = useCallback(
    (selectedIndex: number, correctIndex: number) => {
      if (!currentExercise || feedbackState !== null) return;
      const responseTimeMs = exerciseStartTime ? Date.now() - exerciseStartTime : 0;
      const isCorrect = selectedIndex === correctIndex;
      const exerciseTypeProperty: string = (() => {
        if (currentExercise.exercise_type === 'select_picture_from_description')
          return 'select_picture';
        if (currentExercise.exercise_type === 'select_description_from_picture')
          return 'select_description';
        return currentExercise.exercise_type ?? 'unknown';
      })();
      track('exercise_answered', {
        exercise_id: currentExercise.exercise_id,
        exercise_type: exerciseTypeProperty,
        modality: currentExercise.modality ?? 'all',
        is_correct: isCorrect,
        response_time_ms: responseTimeMs,
      });
      submitAnswer(currentExercise.exercise_id, selectedIndex, correctIndex);
    },
    [currentExercise, feedbackState, exerciseStartTime, submitAnswer]
  );

  // Audio play handler
  const handleAudioPlay = useCallback(
    (duration: number) => {
      if (!currentExercise) return;
      track('exercise_audio_played', {
        exercise_id: currentExercise.exercise_id,
        modality: currentExercise.modality ?? 'listening',
        audio_level: currentExercise.audio_level ?? null,
        duration_seconds: Math.round(duration),
      });
    },
    [currentExercise]
  );

  // On complete: navigate to overview with fromFinish route-state (D6 + F3).
  // Called by usePracticeSession AFTER posthog.capture fires — guarantees analytics-before-navigate.
  const handleCompleteTracked = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    navigate('/practice/exercises', { state: { fromFinish: true } });
  }, [navigate]);

  // usePracticeSession for start/complete/abandon analytics
  usePracticeSession({
    startEvent: 'exercise_session_started',
    completeEvent: 'exercise_session_completed',
    abandonEvent: 'exercise_session_abandoned',
    isSessionActive: queue.length > 0 && !sessionComplete,
    isSessionComplete: sessionComplete,
    getStartProps: useCallback(() => {
      if (queue.length === 0) return null;
      return { modality: modality ?? 'all', exercise_count: queue.length };
    }, [queue, modality]),
    getCompleteProps: useCallback(
      (_durationSec: number) => {
        if (!sessionSummary) return null;
        return {
          modality: modality ?? 'all',
          exercises_completed: sessionSummary.total,
          exercises_correct: sessionSummary.correct,
          accuracy_pct: sessionSummary.accuracy_pct,
          total_time_seconds: sessionSummary.duration_seconds,
        };
      },
      [sessionSummary, modality]
    ),
    getAbandonProps: useCallback(
      (durationSec: number) => {
        if (queue.length === 0 || sessionComplete) return null;
        return {
          modality: modality ?? 'all',
          exercises_answered: Object.keys(answers).length,
          exercises_total: queue.length,
          duration_sec: durationSec,
        };
      },
      [queue, sessionComplete, answers, modality]
    ),
    onCompleteTracked: handleCompleteTracked,
  });

  // Keyboard: 1–4 select in question phase; Enter/Space → Continue in result phase
  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      if (!currentExercise || feedbackState !== null) return;
      const payload = currentExercise.items[0]?.payload as {
        correct_answer_index?: number;
        correct_index?: number;
        options?: unknown[];
      };
      const correctAnswerIndex =
        (payload?.correct_answer_index as number | undefined) ??
        (payload?.correct_index as number | undefined) ??
        -1;
      if (correctAnswerIndex < 0) return;
      const options = payload?.options;
      if (!options || optionIndex >= options.length) return;
      handleAnswer(optionIndex, correctAnswerIndex);
    },
    [currentExercise, feedbackState, handleAnswer]
  );

  // Continue guard: phase === 'result' (replaces feedbackState !== null)
  const handleAdvance = useCallback(() => {
    if (phase === 'result') advance();
  }, [phase, advance]);

  usePracticeKeyboard({
    keymap: {
      '1': () => handleOptionSelect(0),
      '2': () => handleOptionSelect(1),
      '3': () => handleOptionSelect(2),
      '4': () => handleOptionSelect(3),
      Enter: () => handleAdvance(),
      Space: () => handleAdvance(),
    },
    deps: [handleOptionSelect, handleAdvance],
  });

  // Renderer feedbackState (strip exerciseId)
  const rendererFeedbackState = feedbackState
    ? { selectedIndex: feedbackState.selectedIndex, correctIndex: feedbackState.correctIndex }
    : null;

  // Determine verdict for XdResult
  const currentVerdict =
    feedbackState !== null
      ? feedbackState.selectedIndex === feedbackState.correctIndex
        ? 'correct'
        : 'incorrect'
      : 'correct'; // fallback (phase guard ensures this is only read in result phase)

  // ============================================
  // Render: Loading
  // ============================================
  if (isLoading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center"
        style={{ backgroundColor: 'hsl(var(--practice-bg))' }}
      >
        <Skeleton className="min-h-[280px] w-full max-w-lg rounded-xl" />
      </div>
    );
  }

  // ============================================
  // Render: Error
  // ============================================
  if (error) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: 'hsl(var(--practice-bg))' }}
      >
        <PracticeHeader onExit={backToExercises} exitTestId="exercise-practice-close-button" />
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={backToExercises}>
              {t('exercises.session.backToExercises')}
            </Button>
            <Button
              onClick={() => {
                clearError();
                startSession(modality).catch(() => {});
              }}
            >
              {t('exercises.session.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Empty (no exercises)
  // ============================================
  if (!isLoading && !error && queue.length === 0 && !sessionComplete) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: 'hsl(var(--practice-bg))' }}
      >
        <PracticeHeader onExit={backToExercises} exitTestId="exercise-practice-close-button" />
        <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
          <CheckCircle2 className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{t('exercises.session.allCaughtUp')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t('exercises.session.allCaughtUpDescription')}
          </p>
          <Button className="mt-6" variant="outline" onClick={backToExercises}>
            {t('exercises.session.backToExercises')}
          </Button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Active session — 2-col layout
  // ============================================
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: 'hsl(var(--practice-bg))' }}
    >
      {/* Session bar */}
      <XdSessBar
        currentIndex={currentIndex}
        total={queue.length}
        onExit={handleExit}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang as 'el' | 'en' | 'ru', 'exercise')}
      />

      {/* 2-col layout: 1fr / 320px, collapses below 1080px */}
      <div
        className="mx-auto w-full flex-1 gap-6 px-4 py-6"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(1, 1fr)',
          maxWidth: '1400px',
        }}
      >
        {/* Inline style for the 2-col breakpoint — avoids arbitrary Tailwind values */}
        <style>{`
          @media (min-width: 1080px) {
            .xd-session-grid {
              grid-template-columns: 1fr 320px !important;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .xd-sessbar-track span {
              transition: none !important;
            }
          }
        `}</style>

        {/* Apply responsive grid via class */}
        <div
          className="xd-session-grid w-full flex-1 gap-6"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            maxWidth: '1400px',
          }}
        >
          {/* Left: question / result panel */}
          <div className="flex flex-col gap-4">
            {/* Progress (kept from original for session feedback at a glance) */}
            <ProgressIndicator
              current={Math.min(currentIndex + 1, queue.length)}
              total={queue.length}
              label={t('exercises.session.exerciseLabel')}
            />

            {currentExercise && (
              <div>
                <ExerciseContentStep
                  modality={currentExercise.modality}
                  audioLevel={currentExercise.audio_level}
                  descriptionTextEl={currentExercise.description_text_el}
                  descriptionAudioUrl={currentExercise.description_audio_url}
                  descriptionAudioDuration={currentExercise.description_audio_duration}
                  onAudioPlay={handleAudioPlay}
                />

                {/* Question phase: renderer */}
                {phase === 'question' && (
                  <>
                    {currentExercise.exercise_type === 'select_picture_from_description' ? (
                      <SelectPictureFromDescriptionCard
                        items={currentExercise.items}
                        onAnswer={handleAnswer}
                        feedbackState={rendererFeedbackState}
                        disabled={isLoading}
                        exerciseId={currentExercise.exercise_id}
                      />
                    ) : currentExercise.exercise_type === 'select_description_from_picture' ? (
                      <SelectDescriptionFromPictureCard
                        items={currentExercise.items}
                        onAnswer={handleAnswer}
                        feedbackState={rendererFeedbackState}
                        disabled={isLoading}
                        exerciseId={currentExercise.exercise_id}
                      />
                    ) : (
                      <SelectCorrectAnswerRenderer
                        items={currentExercise.items}
                        onAnswer={handleAnswer}
                        feedbackState={rendererFeedbackState}
                        disabled={isLoading}
                        language={language}
                      />
                    )}
                  </>
                )}

                {/* Result phase: XdResult */}
                {phase === 'result' && (
                  <XdResult
                    item={currentExercise}
                    verdict={currentVerdict}
                    selectedIndex={feedbackState?.selectedIndex ?? 0}
                    language={language}
                    onContinue={advance}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right rail (sticky) */}
          <aside
            className="flex flex-col gap-4"
            style={{ position: 'sticky', top: '1rem', alignSelf: 'start' }}
          >
            <XdLiveStats
              correct={liveStats.correct}
              missed={liveStats.missed}
              accuracyPct={liveStats.accuracyPct}
              elapsedSeconds={elapsedSeconds}
              currentStreak={streak?.currentStreak}
            />
            <XdStepper
              statuses={stepperStatuses}
              currentIndex={currentIndex}
              total={queue.length}
              queue={queue}
            />
          </aside>
        </div>
      </div>

      <AlertDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        variant="warning"
        title={t('exercises.session.exitDialog.title')}
        description={t('exercises.session.exitDialog.description')}
        actions={[
          {
            label: t('exercises.session.exitDialog.leave'),
            onClick: handleConfirmedExit,
            variant: 'destructive',
          },
          {
            label: t('exercises.session.exitDialog.stay'),
            onClick: () => setShowExitDialog(false),
            variant: 'outline',
          },
        ]}
      />
    </div>
  );
};
