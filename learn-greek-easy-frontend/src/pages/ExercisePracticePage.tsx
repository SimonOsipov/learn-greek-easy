// src/pages/ExercisePracticePage.tsx

/**
 * Exercise Practice Session Page
 *
 * Full-screen practice experience using the exercisePracticeStore.
 * Supports modality filtering, inline session summary, and PostHog analytics.
 * Rendered outside AppLayout for an immersive full-screen experience.
 */

import { useEffect, useCallback, useState } from 'react';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { ExerciseContentStep } from '@/components/exercises/ExerciseContentStep';
import { SelectCorrectAnswerRenderer } from '@/components/exercises/SelectCorrectAnswerRenderer';
import { LanguageSwitcher } from '@/components/i18n';
import { PracticeHeader, ProgressIndicator, SessionSummary } from '@/components/practice';
import { ThemeSwitcher } from '@/components/theme';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePracticeKeyboard } from '@/hooks/usePracticeKeyboard';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { track } from '@/lib/analytics/track';
import { formatDuration } from '@/lib/timeFormatUtils';
import type { ExerciseModality } from '@/services/exerciseAPI';
import { useExercisePracticeStore } from '@/stores/exercisePracticeStore';

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
    sessionSummary,
    answers,
    exerciseStartTime,
    startSession,
    submitAnswer,
    advance,
    resetSession,
    clearError,
  } = useExercisePracticeStore();

  const currentExercise = queue[currentIndex] ?? null;
  const sessionComplete = sessionSummary !== null;
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Mount: start session
  useEffect(() => {
    startSession(modality).catch(() => {});
  }, [modality]); // eslint-disable-line react-hooks/exhaustive-deps

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
      track('exercise_answered', {
        exercise_id: currentExercise.exercise_id,
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

  // usePracticeSession for start/complete/abandon analytics
  const { resetTracking } = usePracticeSession({
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
  });

  // Keyboard shortcuts
  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      if (!currentExercise || feedbackState !== null) return;
      const correctAnswerIndex =
        (currentExercise.items[0]?.payload as { correct_answer_index?: number })
          ?.correct_answer_index ?? -1;
      if (correctAnswerIndex < 0) return;
      const options = (currentExercise.items[0]?.payload as { options?: unknown[] })?.options;
      if (!options || optionIndex >= options.length) return;
      handleAnswer(optionIndex, correctAnswerIndex);
    },
    [currentExercise, feedbackState, handleAnswer]
  );

  const handleAdvance = useCallback(() => {
    if (feedbackState !== null) advance();
  }, [feedbackState, advance]);

  usePracticeKeyboard({
    keymap: {
      '1': () => handleOptionSelect(0),
      '2': () => handleOptionSelect(1),
      '3': () => handleOptionSelect(2),
      '4': () => handleOptionSelect(3),
      Enter: () => handleAdvance(),
    },
    deps: [handleOptionSelect, handleAdvance],
  });

  // Renderer feedbackState (strip exerciseId)
  const rendererFeedbackState = feedbackState
    ? { selectedIndex: feedbackState.selectedIndex, correctIndex: feedbackState.correctIndex }
    : null;

  // ============================================
  // Render: Loading
  // ============================================
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--practice-bg)]">
        <Skeleton className="min-h-[280px] w-full max-w-lg rounded-xl" />
      </div>
    );
  }

  // ============================================
  // Render: Error
  // ============================================
  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--practice-bg)]">
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
      <div className="flex min-h-screen flex-col bg-[var(--practice-bg)]">
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
  // Render: Summary (session complete)
  // ============================================
  if (sessionComplete && sessionSummary) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--practice-bg)]">
        <PracticeHeader onExit={backToExercises} exitTestId="exercise-practice-close-button" />
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <SessionSummary
            title={t('exercises.session.sessionComplete')}
            stats={[
              {
                label: t('exercises.session.correct'),
                value: `${sessionSummary.correct}/${sessionSummary.total}`,
              },
              {
                label: t('exercises.session.accuracy'),
                value: `${sessionSummary.accuracy_pct}%`,
              },
              {
                label: t('exercises.session.totalTime'),
                value: formatDuration(sessionSummary.duration_seconds),
              },
            ]}
            actions={
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={backToExercises}>
                  {t('exercises.session.backToExercises')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    resetTracking();
                    resetSession();
                    startSession(modality).catch(() => {});
                  }}
                >
                  {t('exercises.session.practiceAgain')}
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Active session
  // ============================================
  return (
    <div className="flex min-h-screen flex-col bg-[var(--practice-bg)]">
      <PracticeHeader
        onExit={handleExit}
        exitTestId="exercise-practice-close-button"
        rightSlot={
          <>
            <LanguageSwitcher variant="icon" />
            <ThemeSwitcher />
          </>
        }
      />
      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        <ProgressIndicator
          current={Math.min(currentIndex + 1, queue.length)}
          total={queue.length}
          label={t('exercises.session.exerciseLabel')}
        />
        {currentExercise && (
          <div className="mt-4">
            <ExerciseContentStep
              modality={currentExercise.modality}
              audioLevel={currentExercise.audio_level}
              descriptionTextEl={currentExercise.description_text_el}
              descriptionAudioUrl={currentExercise.description_audio_url}
              descriptionAudioDuration={currentExercise.description_audio_duration}
              onAudioPlay={handleAudioPlay}
            />
            <SelectCorrectAnswerRenderer
              items={currentExercise.items}
              onAnswer={handleAnswer}
              feedbackState={rendererFeedbackState}
              disabled={isLoading}
            />
          </div>
        )}
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
