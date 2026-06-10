/**
 * ExerciseStep — multiple-choice exercise with feedback (MOB-08).
 *
 * Supports: select_correct_answer, true_false, fill_gaps.
 * Other exercise types are filtered out before reaching this component.
 *
 * Flow:
 * 1. User selects an option → radio fills.
 * 2. User taps "Check" → options lock, feedback banner appears.
 *    - Correct: green option bg + border + check icon, "Got it!" banner.
 *    - Wrong: picked option = red border, correct option = green bg + check, "Almost" banner.
 * 3. "Next" (or "Finish" on last exercise) advances the flow.
 *
 * Semantic accent colours (fixed in both themes, MOB-13 rgba):
 *   correct:   rgb(37,177,130)    hsl(160 65% 42%)
 *   incorrect: rgb(239,68,68)     hsl(0 78% 58%)  (= danger)
 *   modality:  rgb(177,82,224)    hsl(280 70% 55%) (= entry-violet)
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Check, ArrowRight } from 'lucide-react-native';

import type {
  ExerciseQueueItem,
  SelectCorrectAnswerPayload,
  TrueFalsePayload,
} from '@/types/situation';

// MOB-13: explicit rgba — no /NN modifier on var-backed tokens
const CORRECT_COLOR  = 'rgb(37,177,130)';        // hsl(160 65% 42%)
const CORRECT_14     = 'rgba(37,177,130,0.14)';
const CORRECT_10     = 'rgba(37,177,130,0.10)';
const CORRECT_30     = 'rgba(37,177,130,0.30)';
const DANGER_COLOR   = 'rgb(239,68,68)';          // hsl(0 78% 58%)
const DANGER_14      = 'rgba(239,68,68,0.14)';
const DANGER_30      = 'rgba(239,68,68,0.30)';
const VIOLET_COLOR   = 'rgb(177,82,224)';          // hsl(280 70% 55%)
const VIOLET_14      = 'rgba(177,82,224,0.14)';
const WHITE          = 'rgba(255,255,255,0.96)';

// ---------------------------------------------------------------------------
// Option model helpers
// ---------------------------------------------------------------------------

interface OptionModel {
  label: string;
  isCorrect: boolean;
}

function extractOptions(exercise: ExerciseQueueItem): OptionModel[] {
  const item = exercise.items[0];
  if (!item) return [];

  const payload = item.payload as Record<string, unknown>;

  if (exercise.exercise_type === 'select_correct_answer') {
    const p = payload as unknown as SelectCorrectAnswerPayload;
    return (p.options ?? []).map((o) => ({
      label: o.text_el,
      isCorrect: o.is_correct,
    }));
  }

  if (exercise.exercise_type === 'true_false') {
    const p = payload as unknown as TrueFalsePayload;
    return [
      { label: 'Σωστό', isCorrect: p.is_true === true },
      { label: 'Λάθος', isCorrect: p.is_true === false },
    ];
  }

  // fill_gaps: show answer options if present, else just the blank answer
  if (exercise.exercise_type === 'fill_gaps') {
    const blanks = (payload.blanks ?? []) as { answer: string; options?: string[] }[];
    const blank = blanks[0];
    if (!blank) return [];
    if (blank.options && blank.options.length > 0) {
      return blank.options.map((o) => ({
        label: o,
        isCorrect: o === blank.answer,
      }));
    }
    return [{ label: blank.answer, isCorrect: true }];
  }

  return [];
}

function extractQuestion(exercise: ExerciseQueueItem): { el: string; en: string | null } {
  const item = exercise.items[0];
  if (!item) return { el: '', en: null };
  const payload = item.payload as Record<string, unknown>;

  if (exercise.exercise_type === 'select_correct_answer') {
    const p = payload as unknown as SelectCorrectAnswerPayload;
    return { el: p.question_el ?? '', en: p.question_en ?? null };
  }
  if (exercise.exercise_type === 'true_false') {
    const p = payload as unknown as TrueFalsePayload;
    return { el: p.statement_el ?? '', en: p.statement_en ?? null };
  }
  if (exercise.exercise_type === 'fill_gaps') {
    return {
      el: (payload.sentence_el as string) ?? '',
      en: (payload.sentence_en as string) ?? null,
    };
  }
  return { el: '', en: null };
}

// ---------------------------------------------------------------------------
// Exercise type display label
// ---------------------------------------------------------------------------

function exerciseTypeLabel(type: string): string {
  switch (type) {
    case 'select_correct_answer': return 'Multiple choice';
    case 'true_false':            return 'True / false';
    case 'fill_gaps':             return 'Fill the blank';
    default:                      return type;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ExerciseStepProps {
  exercise: ExerciseQueueItem;
  isLast: boolean;
  /** Called with (score, maxScore) after the user taps Next/Finish. */
  onComplete: (score: number, maxScore: number) => void;
}

export function ExerciseStep({ exercise, isLast, onComplete }: ExerciseStepProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const options = extractOptions(exercise);
  const question = extractQuestion(exercise);
  const maxScore = 1;

  const correctIdx = options.findIndex((o) => o.isCorrect);
  const selectedIsCorrect = selectedIdx !== null && options[selectedIdx]?.isCorrect === true;

  const handleCheck = () => {
    if (selectedIdx === null) return;
    setChecked(true);
  };

  const handleNext = () => {
    const score = selectedIsCorrect ? 1 : 0;
    onComplete(score, maxScore);
  };

  const modalityLabel = exercise.modality === 'listening' ? 'Listening' : 'Reading';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Modality + type row */}
        <View className="flex-row items-center gap-2 mb-3.5 px-1">
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 9999,
              backgroundColor: VIOLET_14,
            }}
          >
            <Text
              className="text-[11px] font-bold tracking-[0.06em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular', color: VIOLET_COLOR }}
            >
              {modalityLabel}
            </Text>
          </View>
          <Text className="text-fg3 text-[12px]">
            · {exerciseTypeLabel(exercise.exercise_type)}
          </Text>
        </View>

        {/* Greek question */}
        {question.el ? (
          <Text
            testID="exercise-question-el"
            className="text-fg text-[19px] leading-[28px] mb-1.5"
            style={{ fontFamily: 'NotoSerif_400Regular', fontWeight: '500' }}
          >
            {question.el}
          </Text>
        ) : null}

        {/* English gloss */}
        {question.en ? (
          <Text testID="exercise-question-en" className="text-fg2 text-[13px] mb-[18px]">
            {question.en}
          </Text>
        ) : (
          <View className="mb-[18px]" />
        )}

        {/* Option rows */}
        <View style={{ gap: 8 }}>
          {options.map((opt, i) => {
            const isSelected = selectedIdx === i;
            const isCorrectOpt = opt.isCorrect;

            let bgColor = 'transparent';
            let borderColor = 'hsl(var(--line))';

            if (checked) {
              if (isCorrectOpt) {
                bgColor = CORRECT_14;
                borderColor = CORRECT_COLOR;
              } else if (isSelected && !isCorrectOpt) {
                bgColor = DANGER_14;
                borderColor = DANGER_COLOR;
              }
            } else if (isSelected) {
              borderColor = 'hsl(var(--primary))';
            }

            return (
              <Pressable
                key={i}
                testID={`exercise-option-${i}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: checked ? isCorrectOpt : undefined }}
                onPress={() => !checked && setSelectedIdx(i)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: bgColor as string,
                  borderWidth: 1.5,
                  borderColor: borderColor as string,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
                className="active:opacity-70"
              >
                {/* Radio circle */}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 9999,
                    borderWidth: 1.5,
                    borderColor: (checked && isCorrectOpt) ? CORRECT_COLOR
                      : (checked && isSelected) ? DANGER_COLOR
                      : isSelected ? 'hsl(var(--primary))'
                      : 'hsl(var(--line))',
                    backgroundColor: (checked && isCorrectOpt)
                      ? CORRECT_COLOR
                      : isSelected && !checked
                      ? 'hsl(var(--primary))'
                      : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {checked && isCorrectOpt && (
                    <Check size={13} color="#fff" strokeWidth={2.5} />
                  )}
                </View>

                {/* Option text */}
                <Text
                  className="flex-1 text-fg text-[15px]"
                  style={{ fontFamily: 'NotoSerif_400Regular', fontWeight: '500' }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="px-[18px] pb-5 pt-3 bg-bg">
        {checked ? (
          /* Feedback banner */
          <View
            testID={`exercise-feedback-${selectedIsCorrect ? 'correct' : 'wrong'}`}
            style={{
              padding: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: selectedIsCorrect ? CORRECT_10 : DANGER_14,
              borderWidth: 1,
              borderColor: selectedIsCorrect ? CORRECT_30 : DANGER_30,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Icon disc */}
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                backgroundColor: selectedIsCorrect ? CORRECT_COLOR : DANGER_COLOR,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Check size={18} color="#fff" strokeWidth={2.5} />
            </View>

            {/* Feedback text */}
            <View className="flex-1">
              <Text
                className="text-fg text-[16px] font-bold"
                style={{ fontFamily: 'InterTight_700Bold' }}
              >
                {selectedIsCorrect ? 'Got it!' : 'Almost'}
              </Text>
              <Text className="text-fg2 text-[12px] mt-0.5">
                Correct:{' '}
                <Text
                  className="font-bold"
                  style={{ fontFamily: 'NotoSerif_400Regular' }}
                >
                  {options[correctIdx]?.label ?? ''}
                </Text>
              </Text>
            </View>

            {/* Next / Finish button */}
            <Pressable
              testID="exercise-next"
              accessibilityRole="button"
              onPress={handleNext}
              style={{
                height: 40,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: selectedIsCorrect ? CORRECT_COLOR : DANGER_COLOR,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              className="active:opacity-80"
            >
              <Text className="text-[13.5px] font-bold" style={{ color: WHITE }}>
                {isLast ? 'Finish' : 'Next'}
              </Text>
              <ArrowRight size={14} color={WHITE as string} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : (
          /* Check button (disabled until option selected) */
          <Pressable
            testID="exercise-check"
            accessibilityRole="button"
            onPress={handleCheck}
            disabled={selectedIdx === null}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: selectedIdx !== null ? 'hsl(var(--primary))' : 'hsl(var(--bg-2))',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="active:opacity-80"
          >
            <Text
              className="text-[15px] font-bold"
              style={{
                color: selectedIdx !== null ? WHITE : 'hsl(var(--fg-3))',
                fontFamily: 'InterTight_700Bold',
              }}
            >
              Check
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
