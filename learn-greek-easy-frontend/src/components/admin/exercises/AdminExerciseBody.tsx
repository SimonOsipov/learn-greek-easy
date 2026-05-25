/**
 * AdminExerciseBody — EXR-23..33 + EXR-40..44
 *
 * Renders the expandable body of an exercise row in the admin exercise list.
 * Delegates to per-type sub-components based on exercise_type.
 *
 * Sub-components (all internal to this file):
 *   BodyHeader       — kicker line with type label + level (EXR-23)
 *   QuestionText     — Greek question + English gloss (EXR-24 + EXR-25)
 *   McqVariant       — select_correct_answer / select_heard (EXR-26..29)
 *   TrueFalseVariant — true_false (EXR-30)
 *   FillGapsVariant  — fill_gaps (EXR-31)
 *   WordOrderVariant — word_order (EXR-32 + EXR-42)
 *   PictureVariantA  — select_picture_from_description (EXR-33 + EXR-40 + EXR-41)
 *   PictureVariantB  — select_description_from_picture (EXR-33 + EXR-40 + EXR-41)
 *   PictureImage     — lazy img with skeleton + broken fallback (EXR-40)
 *   PayloadErrorBanner — defensive banner for invalid payloads (EXR-43)
 */

import { useEffect, useState } from 'react';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Loader2,
  Minus,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { SidePanel } from '@/components/ui/side-panel';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type { AdminExerciseListItem, SituationExerciseItemResponse } from '@/types/situation';

import { AdminExerciseAudioBar } from './AdminExerciseAudioBar';
import { elText } from './ExerciseItemPayload';

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface AdminExerciseBodyProps {
  exercise: AdminExerciseListItem;
  onRegenerated?: () => void;
}

export function AdminExerciseBody({ exercise, onRegenerated }: AdminExerciseBodyProps) {
  return (
    <div className="px-4 pb-4">
      <AdminExerciseAudioBar src={exercise.audio_url} />
      <BodyHeader exercise={exercise} />
      <BodyVariant exercise={exercise} />
      <BodyFooter exercise={exercise} onRegenerated={onRegenerated} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BodyHeader — EXR-23
// ---------------------------------------------------------------------------

function BodyHeader({ exercise }: { exercise: AdminExerciseListItem }) {
  const { t } = useTranslation('admin');
  const typeLabel = t(`exercises.types.${exercise.exercise_type}`);
  const level = exercise.audio_level;

  return (
    <div className="mt-3 space-y-2">
      <Kicker dot="primary">
        {typeLabel}
        {level && ` · ${level}`}
      </Kicker>
      <QuestionText exercise={exercise} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BodyFooter — EXR-34
// Edit drawer stub + Regenerate confirm dialog + #xN identifier
// ---------------------------------------------------------------------------

function BodyFooter({
  exercise,
  onRegenerated,
}: {
  exercise: AdminExerciseListItem;
  onRegenerated?: () => void;
}) {
  const { t } = useTranslation('admin');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      await adminAPI.regenerateExercise(exercise.id);
      setConfirmOpen(false);
      onRegenerated?.();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="me-1.5 size-3.5" aria-hidden />
          {t('exercises.row.editButton')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          <RefreshCw className="me-1.5 size-3.5" aria-hidden />
          {t('exercises.row.regenerateButton')}
        </Button>
      </div>
      {/* EXR-44: Latin #x identifier stays Latin in both locales (OQ #9 resolved) */}
      <span className="font-mono text-[11px] text-fg3">#x{exercise.id.slice(0, 8)}</span>

      {/* Edit drawer stub */}
      <SidePanel
        size="default"
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t('exercises.row.editButton')}
      >
        <SidePanel.CloseButton position="right" />
        <SidePanel.Body>
          <p className="text-sm text-fg3">Drawer body coming soon.</p>
        </SidePanel.Body>
      </SidePanel>

      {/* Regenerate confirm — we control close timing to keep dialog open on error */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Block closing while the request is in-flight
          if (!open && regenerating) return;
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exercises.row.regenerateConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('exercises.row.regenerateConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {regenError && <p className="text-sm text-destructive">{regenError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            {/*
             * Use a plain Button instead of AlertDialogAction so we can control
             * when the dialog closes (only on success, not automatically on click).
             */}
            <Button onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                t('exercises.row.regenerateButton')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionText — EXR-24 + EXR-25
// ---------------------------------------------------------------------------

function QuestionText({ exercise }: { exercise: AdminExerciseListItem }) {
  // Question text lives either on exercise.question_el (top-level field from backend)
  // or falls back to items[0].payload.prompt (which may be {el, en} or a plain string).
  const firstItemPrompt = exercise.items?.[0]?.payload?.prompt;
  const greek =
    exercise.question_el ||
    (typeof firstItemPrompt === 'string'
      ? firstItemPrompt
      : firstItemPrompt && typeof firstItemPrompt === 'object' && 'el' in firstItemPrompt
        ? String((firstItemPrompt as Record<string, unknown>).el)
        : '') ||
    '';
  const english = exercise.question_en;

  if (!greek) return null;

  return (
    <div>
      <p lang="el" className="font-serif text-[16px] leading-[1.45] text-fg">
        {greek}
      </p>
      {english && <p className="mt-1 text-[12.5px] italic text-fg3">{english}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BodyVariant — switch on exercise_type
// ---------------------------------------------------------------------------

function BodyVariant({ exercise }: { exercise: AdminExerciseListItem }) {
  const firstItem = exercise.items?.[0];
  if (!firstItem) return <PayloadErrorBanner exerciseId={exercise.id} />;

  switch (exercise.exercise_type) {
    case 'select_correct_answer':
    case 'select_heard':
      return <McqVariant exercise={exercise} item={firstItem} />;
    case 'true_false':
      return <TrueFalseVariant exercise={exercise} item={firstItem} />;
    case 'fill_gaps':
      return <FillGapsVariant exercise={exercise} item={firstItem} />;
    case 'word_order':
      return <WordOrderVariant exercise={exercise} item={firstItem} />;
    case 'select_picture_from_description':
      return <PictureVariantA exercise={exercise} item={firstItem} />;
    case 'select_description_from_picture':
      return <PictureVariantB exercise={exercise} item={firstItem} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// MCQ Variant — EXR-26 + EXR-27 + EXR-28 + EXR-29
// Used for: select_correct_answer, select_heard
// ---------------------------------------------------------------------------

function McqVariant({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const { t } = useTranslation('admin');
  const rawOptions: unknown[] = Array.isArray(item.payload?.options) ? item.payload.options : [];
  const options = rawOptions.map((opt) => elText(opt));
  // correct_idx is pre-computed by the backend from first item payload.
  // Also check payload directly as fallback (correct_idx or correct_answer_index).
  const correctIdx =
    exercise.correct_idx ??
    (typeof item.payload?.correct_idx === 'number' ? item.payload.correct_idx : null) ??
    (typeof item.payload?.correct_answer_index === 'number'
      ? item.payload.correct_answer_index
      : -1);
  const [picked, setPicked] = useState<number | null>(null);

  if (options.length < 2 || correctIdx < 0 || correctIdx >= options.length) {
    return (
      <PayloadErrorBanner exerciseId={exercise.id} options={options} correctIdx={correctIdx} />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={exercise.question_el ?? ''}
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {options.map((opt, i) => {
        const isPicked = picked === i;
        const isCorrect = i === correctIdx;
        // EXR-44: Latin A/B/C/D in both EN and RU (OQ #9 resolved 2026-05-24).
        // Letter is a glyph/identifier, not a translation. If Cyrillic ever needed,
        // swap for t('exercises.row.optionMarks').charAt(i) with 'ABCD'/'АБВГ' per locale.
        const letter = String.fromCharCode(65 + i);
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={isPicked}
            onClick={() => setPicked(i)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 text-start transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isPicked && !isCorrect && 'border-primary/50 bg-primary/5',
              isCorrect && 'border-success/50 bg-success/5',
              !isPicked && !isCorrect && 'border-border hover:border-primary/30'
            )}
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border font-mono text-xs">
              {letter}
            </span>
            <span lang="el" className="flex-1 font-serif text-[14.5px]">
              {opt}
            </span>
            {isCorrect && (
              <>
                <Check className="ms-auto size-4 text-success" aria-hidden />
                <span className="sr-only">{t('exercises.row.correctAnswer')}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// True/False Variant — EXR-30
// ---------------------------------------------------------------------------

function TrueFalseVariant({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const { t } = useTranslation('admin');
  // Payload: { statement: {el}, correct: boolean }
  const correctValue: boolean | null =
    typeof item.payload?.correct === 'boolean' ? item.payload.correct : null;
  const [picked, setPicked] = useState<boolean | null>(null);

  const tfOptions: { value: boolean; label: string }[] = [
    { value: true, label: 'Σωστό' },
    { value: false, label: 'Λάθος' },
  ];

  if (correctValue === null) {
    return <PayloadErrorBanner exerciseId={exercise.id} />;
  }

  return (
    <div
      role="radiogroup"
      aria-label={exercise.question_el ?? ''}
      className="mt-3 grid grid-cols-2 gap-2"
    >
      {tfOptions.map(({ value, label }) => {
        const isPicked = picked === value;
        const isCorrect = value === correctValue;
        return (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={isPicked}
            onClick={() => setPicked(value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border p-[14px_18px] text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isPicked && !isCorrect && 'border-primary/50 bg-primary/5',
              isCorrect && 'border-success/50 bg-success/5',
              !isPicked && !isCorrect && 'border-border hover:border-primary/30'
            )}
          >
            <span lang="el" className="font-serif text-[14.5px]">
              {label}
            </span>
            {isCorrect && (
              <>
                <Check className="size-4 text-success" aria-hidden />
                <span className="sr-only">{t('exercises.row.correctAnswer')}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fill-in (Fill Gaps) Variant — EXR-31
// Pill-shaped options in auto-fit grid. Question text contains ___ blanks.
// ---------------------------------------------------------------------------

function FillGapsVariant({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const { t } = useTranslation('admin');
  const rawOptions: unknown[] = Array.isArray(item.payload?.options) ? item.payload.options : [];
  const options = rawOptions.map((opt) => elText(opt));
  const correctIdx =
    exercise.correct_idx ??
    (typeof item.payload?.correct_idx === 'number' ? item.payload.correct_idx : null) ??
    (typeof item.payload?.correct_answer_index === 'number'
      ? item.payload.correct_answer_index
      : -1);
  const [picked, setPicked] = useState<number | null>(null);

  if (options.length < 2 || correctIdx < 0 || correctIdx >= options.length) {
    return (
      <PayloadErrorBanner exerciseId={exercise.id} options={options} correctIdx={correctIdx} />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={exercise.question_el ?? ''}
      className="mt-3"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {options.map((opt, i) => {
        const isPicked = picked === i;
        const isCorrect = i === correctIdx;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={isPicked}
            onClick={() => setPicked(i)}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full border px-[14px] py-2 text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isPicked && !isCorrect && 'border-primary/50 bg-primary/5',
              isCorrect && 'border-success/50 bg-success/5',
              !isPicked && !isCorrect && 'border-border hover:border-primary/30'
            )}
          >
            <span lang="el" className="font-serif text-[14.5px]">
              {opt}
            </span>
            {isCorrect && (
              <>
                <Check className="inline-block size-4 text-success" aria-hidden />
                <span className="sr-only">{t('exercises.row.correctAnswer')}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Word Order Variant — EXR-32 + EXR-42
// Static chips (admin doesn't grade) with up/down buttons for preview.
// ---------------------------------------------------------------------------

function WordOrderVariant({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const { t } = useTranslation('admin');
  // Payload: { words: string[], correct_order: number[], answer_el: string }
  const chips: string[] = Array.isArray(item.payload?.words)
    ? (item.payload.words as string[])
    : Array.isArray(item.payload?.chips)
      ? (item.payload.chips as string[])
      : [];
  const [order, setOrder] = useState<number[]>(() => chips.map((_, i) => i));
  const [liveMsg, setLiveMsg] = useState('');

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
    setLiveMsg(t('exercises.wordOrder.movedTo', { position: target + 1 }));
  };

  if (chips.length === 0) {
    return <PayloadErrorBanner exerciseId={exercise.id} />;
  }

  // answer_el may come from exercise top-level or from payload
  const answerEl =
    exercise.answer_el ||
    (typeof item.payload?.answer_el === 'string' ? item.payload.answer_el : null);

  return (
    <div className="mt-3 rounded-lg bg-muted/40 p-3">
      <div className="mb-2 font-mono text-xs uppercase text-fg3">
        {t('exercises.wordOrder.dragLabel')}
      </div>
      <div className="flex flex-wrap gap-2">
        {order.map((origIdx, i) => (
          <div
            key={origIdx}
            className="inline-flex items-center gap-1 rounded-full border bg-bg px-3 py-1"
          >
            <span lang="el" className="font-serif text-[14.5px]">
              {chips[origIdx]}
            </span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={t('exercises.wordOrder.moveUp')}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-30"
            >
              <ChevronUp className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              aria-label={t('exercises.wordOrder.moveDown')}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-30"
            >
              <ChevronDown className="size-3" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {answerEl && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-success">
          <Check className="size-3.5" aria-hidden />
          <span className="font-mono text-xs">{t('exercises.wordOrder.correctOrder')}</span>
          <span lang="el" className="font-serif text-[14.5px]">
            {answerEl}
          </span>
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picture Variant A — select_picture_from_description
// Description on top, 4 picture options below (EXR-33 + EXR-40 + EXR-41)
// ---------------------------------------------------------------------------

function PictureVariantA({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const desc = exercise.question_el || exercise.anchor_description_text || '';
  const rawOptions: unknown[] = Array.isArray(item.payload?.options) ? item.payload.options : [];
  const correctIdx = exercise.correct_idx ?? -1;

  return (
    <div className="mt-3">
      {desc && (
        <p lang="el" className="mb-3 font-serif text-[16px] text-fg">
          {desc}
        </p>
      )}
      <PictureOptionsGrid options={rawOptions} correctIdx={correctIdx} mode="picture" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picture Variant B — select_description_from_picture
// Picture on top, 4 description options below (EXR-33 + EXR-40 + EXR-41)
// ---------------------------------------------------------------------------

function PictureVariantB({
  exercise,
  item,
}: {
  exercise: AdminExerciseListItem;
  item: SituationExerciseItemResponse;
}) {
  const imageUrl = exercise.anchor_picture_url;
  const rawOptions: unknown[] = Array.isArray(item.payload?.options) ? item.payload.options : [];
  const correctIdx = exercise.correct_idx ?? -1;

  return (
    <div className="mt-3">
      {imageUrl && (
        <PictureImage
          src={imageUrl}
          alt={exercise.question_en || exercise.question_el || 'Exercise picture'}
          className="mb-3 w-full max-w-md rounded-md"
        />
      )}
      <PictureOptionsGrid options={rawOptions} correctIdx={correctIdx} mode="text" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PictureOptionsGrid — 2-column grid, pads to 4 with placeholder cards (EXR-41)
// ---------------------------------------------------------------------------

function PictureOptionsGrid({
  options,
  correctIdx,
  mode,
}: {
  options: unknown[];
  correctIdx: number;
  mode: 'picture' | 'text';
}) {
  const { t } = useTranslation('admin');

  // EXR-41: pad to 4 options; warn if fewer
  if (options.length < 4) {
    // eslint-disable-next-line no-console
    console.warn('[EXR-41] Picture variant has', options.length, 'options; expected 4');
  }
  const padded: (unknown | null)[] = [...options];
  while (padded.length < 4) padded.push(null);

  return (
    <div className="grid grid-cols-2 gap-3">
      {padded.map((opt, i) => {
        // EXR-44: Latin A/B/C/D in both EN and RU (OQ #9 resolved 2026-05-24).
        // Letter is a glyph/identifier, not a translation. If Cyrillic ever needed,
        // swap for t('exercises.row.optionMarks').charAt(i) with 'ABCD'/'АБВГ' per locale.
        const letter = String.fromCharCode(65 + i);
        const isCorrect = i === correctIdx;

        if (opt === null) {
          return (
            <div
              key={i}
              className="rounded-lg border border-dashed bg-muted/30 p-3 text-center text-fg3"
              aria-disabled="true"
            >
              <Minus className="mx-auto mb-1 size-4" aria-hidden />
              <p className="text-xs">{t('exercises.picture.noDistractor')}</p>
            </div>
          );
        }

        const optObj = opt as Record<string, unknown>;
        const imageUrl = typeof optObj.image_url === 'string' ? optObj.image_url : null;
        const textContent =
          typeof optObj.text === 'string'
            ? optObj.text
            : typeof optObj.label === 'string'
              ? optObj.label
              : elText(opt);

        return (
          <div
            key={i}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-2 text-center',
              isCorrect && 'border-success/50 bg-success/5',
              !isCorrect && 'border-border'
            )}
          >
            <span className="self-start px-1 font-mono text-xs">{letter}</span>
            {mode === 'picture' && imageUrl && (
              <PictureImage
                src={imageUrl}
                alt={t('exercises.picture.optionAlt', { position: letter })}
                className="w-full"
              />
            )}
            {mode === 'text' && (
              <span lang="el" className="flex-1 text-start font-serif text-[14.5px]">
                {textContent}
              </span>
            )}
            {isCorrect && <Check className="size-4 self-end text-success" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PictureImage — lazy load + skeleton + broken fallback (EXR-40)
// ---------------------------------------------------------------------------

function PictureImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={cn(
          'flex aspect-video items-center justify-center rounded-md bg-muted/40',
          className
        )}
      >
        <ImageOff className="size-6 text-fg3" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn('relative aspect-video overflow-hidden rounded-md bg-muted/40', className)}>
      {loading && <div className="absolute inset-0 animate-pulse bg-muted/60" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        className={cn('h-full w-full object-cover', loading && 'opacity-0')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PayloadErrorBanner — defensive fallback for malformed payloads (EXR-43)
// ---------------------------------------------------------------------------

function PayloadErrorBanner({
  exerciseId,
  options,
  correctIdx,
}: {
  exerciseId: string;
  options?: (string | unknown)[];
  correctIdx?: number;
}) {
  const { t } = useTranslation('admin');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[EXR-43] Malformed exercise payload', { exerciseId, options, correctIdx });
  }, [exerciseId, options, correctIdx]);

  return (
    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="size-4" aria-hidden />
        <span>{t('exercises.payloadError.malformed')}</span>
      </div>
      {options && options.length > 0 && (
        <div className="mt-3 space-y-1">
          {options.map((opt, i) => (
            <div key={i} className="rounded border p-2 text-xs text-fg3" aria-disabled="true">
              <span className="font-mono">{String.fromCharCode(65 + i)}</span>
              <span lang="el" className="ms-2">
                {typeof opt === 'string' ? opt : JSON.stringify(opt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
