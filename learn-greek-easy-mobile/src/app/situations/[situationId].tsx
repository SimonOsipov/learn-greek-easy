/**
 * SituationFlowScreen — /situations/[situationId] (MOB-08).
 *
 * A pushed root-stack route (no tab bar — registered in src/app/_layout.tsx
 * inside the signed-in Stack.Protected block).
 *
 * Step sequence (local index):
 *   0         = SituationCover
 *   1..k      = RetellingStep(s) — A2 first (if present), then B1
 *   k+1..k+m  = ExerciseStep(s) — only supported types
 *   last      = CompletionStep
 *
 * Resume: if exercise_completed > 0 and < exercise_total, flow opens at step
 * (cover + retelling count + exercisesDone), skipping already-completed exercises.
 *
 * Flow state is in-memory only. Score is submitted per exercise via POST
 * /api/v1/exercises/{id}/review after each answer (best-effort; no retry UI).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSituationDetail } from '@/hooks/use-situation-detail';
import { useSituationExercises, useReviewExercise } from '@/hooks/use-situation-exercises';
import { track } from '@/lib/analytics';
import { SituationCover } from '@/components/situations/situation-cover';
import { StepHeader } from '@/components/situations/step-header';
import { RetellingStep } from '@/components/situations/retelling-step';
import { ExerciseStep } from '@/components/situations/exercise-step';
import { CompletionStep } from '@/components/situations/completion-step';
import type { ExerciseQueueItem } from '@/types/situation';

/** Exercise types supported in the flow; others are skipped with a console note. */
const SUPPORTED_EXERCISE_TYPES = new Set([
  'select_correct_answer',
  'true_false',
  'fill_gaps',
]);

function filterSupportedExercises(exercises: ExerciseQueueItem[]): ExerciseQueueItem[] {
  return exercises.filter((ex) => {
    const supported = SUPPORTED_EXERCISE_TYPES.has(ex.exercise_type);
    if (!supported) {
      // Dev note — intentional deviation logged but not shown to user
      console.info('[SituationFlow] skipping unsupported exercise type:', ex.exercise_type);
    }
    return supported;
  });
}

export default function SituationFlowScreen() {
  const { situationId } = useLocalSearchParams<{ situationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const situationQuery = useSituationDetail(situationId);
  const exercisesQuery = useSituationExercises(situationId);
  const reviewMutation = useReviewExercise();

  const situation = situationQuery.data;
  const exercises = useMemo(
    () =>
      exercisesQuery.data ? filterSupportedExercises(exercisesQuery.data.exercises) : [],
    [exercisesQuery.data],
  );

  // ── Build retelling sequence (A2 first if present, then B1) ──
  const retellings = (() => {
    if (!situation?.description) return [];
    const result: {
      level: 'A2' | 'B1';
      textEl: string;
      textEn: string | null;
      audioUrl: string | null;
      audioDurationSeconds: number | null;
    }[] = [];
    if (situation.description.text_el_a2) {
      result.push({
        level: 'A2',
        textEl: situation.description.text_el_a2,
        textEn: situation.description.text_en ?? null,
        audioUrl: situation.description.audio_a2_url ?? null,
        audioDurationSeconds: situation.description.audio_a2_duration_seconds ?? null,
      });
    }
    if (situation.description.text_el) {
      result.push({
        level: 'B1',
        textEl: situation.description.text_el,
        textEn: situation.description.text_en ?? null,
        audioUrl: situation.description.audio_url ?? null,
        audioDurationSeconds: situation.description.audio_duration_seconds ?? null,
      });
    }
    return result;
  })();

  // Steps for StepHeader (cover not counted; completion not counted either):
  const headerStepCount = retellings.length + exercises.length;

  // ── Resume: if in progress, start at the appropriate step ──
  const initialStep = (() => {
    if (!situation) return 0;
    const done = situation.exercise_completed;
    if (done > 0 && done < situation.exercise_total) {
      // skip cover + retellings + already-done exercises
      return 1 + retellings.length + Math.min(done, exercises.length);
    }
    return 0;
  })();

  const [stepIndex, setStepIndex] = useState(initialStep);
  // scores[i] = score for exercise index i (0 or 1)
  const [scores, setScores] = useState<number[]>([]);
  // Captured once when flow starts (not in render). useMemo ensures stable value.
  const [startTime] = useState(() => Date.now());
  const audioSeconds = useMemo(
    () =>
      (situation?.description?.audio_duration_seconds ?? 0) +
      (situation?.description?.audio_a2_duration_seconds ?? 0),
    [situation],
  );
  const [completionData, setCompletionData] = useState<{
    correctCount: number;
    elapsedSeconds: number;
  } | null>(null);

  // ── Analytics: situation_flow_started ──
  const flowStartedFired = useRef(false);
  useEffect(() => {
    if (situation && !flowStartedFired.current) {
      flowStartedFired.current = true;
      track('situation_flow_started', {
        situation_id: situation.id,
        resume: stepIndex > 0,
      });
    }
  }, [situation, stepIndex]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleBegin = useCallback(() => {
    setStepIndex(1);
  }, []);

  const handleRetellingContinue = useCallback(() => {
    setStepIndex((i) => i + 1);
  }, []);

  const handleExerciseComplete = useCallback(
    (exerciseIdx: number, score: number, maxScore: number) => {
      // Persist score
      setScores((prev) => {
        const next = [...prev];
        next[exerciseIdx] = score;
        return next;
      });

      // Submit review (best-effort: no blocking on result)
      const exercise = exercises[exerciseIdx];
      if (exercise) {
        track('exercise_answered', {
          situation_id: situationId,
          exercise_id: exercise.exercise_id,
          exercise_type: exercise.exercise_type,
          score,
          max_score: maxScore,
        });
        reviewMutation.mutate({
          exercise_id: exercise.exercise_id,
          score,
          max_score: maxScore,
        });
      }

      // Advance to next step
      setStepIndex((i) => i + 1);
    },
    [exercises, situationId, reviewMutation],
  );

  // Fire completion analytics + capture completion data when flow reaches the end.
  // Use an effect so we don't call impure functions or access refs in render.
  const completionStepIndex = 1 + retellings.length + exercises.length;
  const completedFired = useRef(false);
  useEffect(() => {
    if (stepIndex >= completionStepIndex && !completedFired.current) {
      completedFired.current = true;
      const correctCount = scores.filter((s) => s > 0).length;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      track('situation_completed', {
        situation_id: situationId,
        correct_count: correctCount,
        total_count: exercises.length,
      });
      setCompletionData({ correctCount, elapsedSeconds });
    }
  }, [stepIndex, completionStepIndex, scores, situationId, exercises.length, startTime]);

  const handleBackToPractice = useCallback(() => {
    router.back();
  }, [router]);

  // ── Loading state ──
  if (situationQuery.isLoading || exercisesQuery.isLoading) {
    return (
      <View testID="situation-flow-loading" className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // ── Error state ──
  if (situationQuery.isError || !situation) {
    return (
      <View
        testID="situation-flow-error"
        className="flex-1 bg-bg items-center justify-center px-8"
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load this situation.
        </Text>
        <Pressable
          testID="situation-flow-retry"
          onPress={() => situationQuery.refetch()}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70 mb-3"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
        <Pressable
          testID="situation-flow-back"
          onPress={handleBack}
          className="px-6 py-3 active:opacity-70"
        >
          <Text className="text-fg3 text-[14px]">Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Cover step (index 0) ──
  if (stepIndex === 0) {
    return (
      <SituationCover
        situation={situation}
        onBack={handleBack}
        onBegin={handleBegin}
        topOffset={insets.top}
      />
    );
  }

  // ── Completion step ──
  if (stepIndex >= completionStepIndex) {
    return (
      <CompletionStep
        correctCount={completionData?.correctCount ?? 0}
        totalCount={exercises.length}
        audioSeconds={audioSeconds}
        elapsedSeconds={completionData?.elapsedSeconds ?? 0}
        onBack={handleBackToPractice}
      />
    );
  }

  // ── Inner step (retelling or exercise) ──
  // stepIndex 1..retellings.length = retelling steps
  // stepIndex retellings.length+1..retellings.length+exercises.length = exercise steps
  const innerIdx = stepIndex - 1; // 0-based inner index
  const headerCurrentIdx = innerIdx; // 0-based for StepHeader

  // Retelling step?
  if (innerIdx < retellings.length) {
    const retelling = retellings[innerIdx];
    const isLastRetelling = innerIdx === retellings.length - 1;
    return (
      <View testID="situation-flow-retelling" className="flex-1 bg-bg">
        <StepHeader
          currentIndex={headerCurrentIdx}
          total={headerStepCount}
          onClose={handleBack}
          topOffset={insets.top}
        />
        <RetellingStep
          level={retelling.level}
          textEl={retelling.textEl}
          textEn={retelling.textEn}
          audioUrl={retelling.audioUrl}
          audioDurationSeconds={retelling.audioDurationSeconds}
          isLast={isLastRetelling && exercises.length === 0}
          onContinue={handleRetellingContinue}
        />
      </View>
    );
  }

  // Exercise step
  const exerciseIdx = innerIdx - retellings.length;
  const exercise = exercises[exerciseIdx];
  if (exercise) {
    const isLastExercise = exerciseIdx === exercises.length - 1;
    return (
      <View testID="situation-flow-exercise" className="flex-1 bg-bg">
        <StepHeader
          currentIndex={headerCurrentIdx}
          total={headerStepCount}
          onClose={handleBack}
          topOffset={insets.top}
        />
        <ExerciseStep
          exercise={exercise}
          isLast={isLastExercise}
          onComplete={(score, maxScore) =>
            handleExerciseComplete(exerciseIdx, score, maxScore)
          }
        />
      </View>
    );
  }

  // Fallback (shouldn't happen)
  return null;
}
