// src/components/exercises/XdResult.tsx
// Result-phase view for PRACT2-12-05.
//
// DOM CONTRACT (tests assert these testids/roles):
//   data-testid="xd-result"          — root wrapper
//   data-testid="xd-result-verdict"  — verdict mark (success/danger indicator)
//   data-testid="xd-result-answer"   — "The answer" callout (correct option text)
//   data-testid="xd-result-why"      — "Why" slot wrapper
//   data-testid="unwired-dot"        — UnwiredDot inside the Why slot
//   <button name /continue/i>        — Continue button
//
// "The answer" resolves per exercise_type:
//   select_correct_answer           → options[correct_answer_index][language]
//   select_description_from_picture → options[correct_index].description_text
//   select_picture_from_description → shows correct picture (options[correct_index].image_url)
//
// "Why" is always an UnwiredDot — explanation is unbacked for all 3 rendered types (D4).

import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx/atoms/UnwiredDot';
import type { ExerciseQueueItem } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

export interface XdResultProps {
  /** The exercise item being shown in result phase */
  item: ExerciseQueueItem;
  /** Whether the user's answer was correct */
  verdict: 'correct' | 'incorrect';
  /** The index the user selected */
  selectedIndex: number;
  /** The display language for option text (SCA) */
  language: CultureLanguage;
  /** Called when the user clicks Continue */
  onContinue: () => void;
}

/**
 * Derive the correct-answer display content from the exercise payload.
 * Returns either a text string or an image URL (for SPFD).
 */
function resolveAnswer(
  item: ExerciseQueueItem,
  language: CultureLanguage
): { type: 'text'; value: string } | { type: 'image'; url: string } | null {
  const payload = item.items[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;

  if (item.exercise_type === 'select_correct_answer') {
    // SCA: options[correct_answer_index][language]
    const correctIdx = payload.correct_answer_index as number | undefined;
    const options = payload.options as Array<Record<string, string>> | undefined;
    if (correctIdx == null || !options) return null;
    const option = options[correctIdx];
    if (!option) return null;
    const text = option[language] ?? option['el'] ?? '';
    return { type: 'text', value: text };
  }

  if (item.exercise_type === 'select_description_from_picture') {
    // SDFP: anchor image + text options — answer is description_text
    const correctIdx = payload.correct_index as number | undefined;
    const options = payload.options as Array<{ description_text?: string | null }> | undefined;
    if (correctIdx == null || !options) return null;
    const text = options[correctIdx]?.description_text ?? '';
    return { type: 'text', value: text };
  }

  if (item.exercise_type === 'select_picture_from_description') {
    // SPFD: text prompt + picture options — answer is the correct picture
    const correctIdx = payload.correct_index as number | undefined;
    const options = payload.options as Array<{ image_url?: string | null }> | undefined;
    if (correctIdx == null || !options) return null;
    const url = options[correctIdx]?.image_url ?? '';
    return { type: 'image', url };
  }

  return null;
}

/**
 * XdResult — result-phase panel shown after submitAnswer.
 * Displays verdict, correct answer (real), and a "Why" UnwiredDot (D4).
 * Continue button advances to the next question.
 */
export function XdResult({
  item,
  verdict,
  selectedIndex: _selectedIndex,
  language,
  onContinue,
}: XdResultProps) {
  const { t } = useTranslation('common');
  const answer = resolveAnswer(item, language);

  const isCorrect = verdict === 'correct';

  return (
    <div
      data-testid="xd-result"
      className="flex flex-col gap-4 rounded-xl p-6"
      style={{ backgroundColor: 'hsl(var(--card))' }}
    >
      {/* Verdict mark */}
      <div
        data-testid="xd-result-verdict"
        className="flex items-center gap-2 text-base font-semibold"
        style={{ color: isCorrect ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}
        aria-live="polite"
      >
        {isCorrect ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <span>
          {isCorrect
            ? t('exercises.session.result.verdictCorrect')
            : t('exercises.session.result.verdictIncorrect')}
        </span>
      </div>

      {/* "The answer" callout */}
      <div
        data-testid="xd-result-answer"
        className="rounded-lg px-4 py-3 text-sm"
        style={{
          backgroundColor: 'hsl(var(--bg))',
          border: '1px solid hsl(var(--card-border, var(--border, 220 13% 91%)))',
        }}
      >
        <div
          className="mb-1 text-xs font-medium uppercase tracking-wide"
          style={{ color: 'hsl(var(--fg-2))' }}
        >
          {t('exercises.session.result.theAnswer')}
        </div>
        {answer?.type === 'text' && (
          <div className="text-base font-medium" style={{ color: 'hsl(var(--fg))' }} lang="el">
            {answer.value}
          </div>
        )}
        {answer?.type === 'image' && answer.url && (
          <img
            src={answer.url}
            alt={t('exercises.session.result.theAnswer')}
            className="mt-1 max-h-32 rounded object-contain"
          />
        )}
        {!answer && (
          <div className="text-base" style={{ color: 'hsl(var(--fg-2))' }}>
            —
          </div>
        )}
      </div>

      {/* "Why" slot — always UnwiredDot (D4: explanation unbacked for all 3 rendered types) */}
      <div
        data-testid="xd-result-why"
        className="rounded-lg px-4 py-3 text-sm"
        style={{
          backgroundColor: 'hsl(var(--bg))',
          border: '1px solid hsl(var(--card-border, var(--border, 220 13% 91%)))',
        }}
      >
        <div
          className="mb-1 text-xs font-medium uppercase tracking-wide"
          style={{ color: 'hsl(var(--fg-2))' }}
        >
          {t('exercises.session.result.why')}
        </div>
        <UnwiredDot aria-label={t('exercises.session.result.whyAriaLabel')} />
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg px-6 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
          }}
        >
          {t('exercises.session.result.continue')}
        </button>
      </div>
    </div>
  );
}
