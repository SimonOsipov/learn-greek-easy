// src/components/situations/SituationExercisePreviewModal.tsx
//
// SIT-27-08: read-only preview modal for a situation exercise, opened from a
// q-card. Built on the shared shadcn Dialog primitive (no reinvention).
//
// READ-ONLY by contract: this component records NO ExerciseReview and starts NO
// graded SM-2 attempt — the graded attempt stays on the action-panel Practice
// CTA → existing ExercisePracticePage flow. It only renders the cached exercise.
//
// Language is selectable via EL/EN/RU tabs (the genuine per-exercise multilingual
// fields). The exercise's CEFR level renders as a static badge — an exercise is
// bound to a single `audio_level` with no second-level variant, so A2/B1 are NOT
// interactive tabs (see PR "Deviations").

import React, { useState } from 'react';

import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { tDynamic } from '@/i18n/tDynamic';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import { cn } from '@/lib/utils';
import type { ExerciseQueueItem, PictureMatchOption } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

import { exercisePrompt } from './exerciseGridHelpers';

interface MultilingualField {
  el: string;
  en: string;
  ru: string;
}

interface SelectCorrectAnswerPayload {
  prompt: MultilingualField;
  options: MultilingualField[];
  correct_answer_index: number;
}

interface PictureMatchLike {
  prompt_description?: string;
  anchor_image_url?: string;
  options: PictureMatchOption[];
  correct_index: number;
}

function isSelectCorrectAnswer(payload: unknown): payload is SelectCorrectAnswerPayload {
  if (!payload || typeof payload !== 'object') return false;
  const v = payload as Partial<SelectCorrectAnswerPayload>;
  return !!v.prompt && Array.isArray(v.options) && typeof v.correct_answer_index === 'number';
}

function isPictureMatch(payload: unknown): payload is PictureMatchLike {
  if (!payload || typeof payload !== 'object') return false;
  const v = payload as Partial<PictureMatchLike>;
  return Array.isArray(v.options) && typeof v.correct_index === 'number';
}

export interface SituationExercisePreviewModalProps {
  /** The exercise to preview, or null when the modal is closed. */
  exercise: ExerciseQueueItem | null;
  onClose: () => void;
}

const LANGUAGES: CultureLanguage[] = ['el', 'en', 'ru'];

export const SituationExercisePreviewModal: React.FC<SituationExercisePreviewModalProps> = ({
  exercise,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [language, setLanguage] = useState<CultureLanguage>('el');

  const open = exercise !== null;
  const payload = exercise?.items[0]?.payload as Record<string, unknown> | undefined;
  const prompt = exercise ? exercisePrompt(exercise, language) : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="situation-exercise-preview">
        <DialogHeader>
          <DialogTitle>{t('situations.detail.exercises.previewTitle')}</DialogTitle>
          <DialogDescription>{t('situations.detail.exercises.previewSubtitle')}</DialogDescription>
        </DialogHeader>

        {exercise && (
          <div className="space-y-4">
            {/* Level badge (static — exercise is bound to one CEFR level) + EL/EN/RU tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {exercise.audio_level && (
                <Badge variant="outline" data-testid="situation-preview-level">
                  {exercise.audio_level}
                </Badge>
              )}
              <Tabs value={language} onValueChange={(v) => setLanguage(v as CultureLanguage)}>
                <TabsList data-testid="situation-preview-lang-tabs">
                  {LANGUAGES.map((lang) => (
                    <TabsTrigger key={lang} value={lang} className="uppercase">
                      {lang}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Media: audio player (listening) or scene image (image-mcq) */}
            {exercise.description_audio_url ? (
              <WaveformPlayer
                audioUrl={exercise.description_audio_url}
                duration={exercise.description_audio_duration ?? undefined}
                variant="culture"
              />
            ) : null}

            {isPictureMatch(payload) && payload.anchor_image_url ? (
              <div className="cx-q-card-scene">
                <img
                  src={payload.anchor_image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={recoverDerivativeError}
                />
              </div>
            ) : null}

            {/* Prompt */}
            {prompt && (
              <p className="text-base font-medium text-foreground" lang={language}>
                {prompt}
              </p>
            )}

            {/* Options with the correct one marked */}
            <PreviewOptions exercise={exercise} payload={payload} language={language} />

            {/* "Appears in" topic chip */}
            {exercise.topic && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">
                  {t('situations.detail.exercises.appearsIn')}
                </span>
                <Badge variant="secondary" data-testid="situation-preview-topic">
                  {tDynamic(t, `situations.detail.exercises.topics.${exercise.topic}`)}
                </Badge>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

SituationExercisePreviewModal.displayName = 'SituationExercisePreviewModal';

// ────────────────────────────────────────────────────────────────────────────
// Options renderer — read-only, correct answer marked
// ────────────────────────────────────────────────────────────────────────────

interface PreviewOptionsProps {
  exercise: ExerciseQueueItem;
  payload: Record<string, unknown> | undefined;
  language: CultureLanguage;
}

const PreviewOptions: React.FC<PreviewOptionsProps> = ({ payload, language }) => {
  const { t } = useTranslation('common');

  if (isSelectCorrectAnswer(payload)) {
    return (
      <div className="space-y-2" data-testid="situation-preview-options">
        {payload.options.map((option, index) => {
          const isCorrect = index === payload.correct_answer_index;
          return (
            <OptionRow
              key={index}
              text={option[language] || option.en || option.el}
              isCorrect={isCorrect}
              correctLabel={t('situations.detail.exercises.correct')}
              language={language}
            />
          );
        })}
      </div>
    );
  }

  if (isPictureMatch(payload)) {
    return (
      <div className="space-y-2" data-testid="situation-preview-options">
        {payload.options.map((option, index) => {
          const isCorrect = index === payload.correct_index;
          if (option.image_url) {
            return (
              <div
                key={index}
                className={cn(
                  'overflow-hidden rounded-md border',
                  isCorrect ? 'border-success ring-1 ring-success' : 'border-border'
                )}
              >
                <img
                  src={option.image_url}
                  srcSet={option.image_variants ? buildSrcSet(option.image_variants) : undefined}
                  alt=""
                  className="aspect-video w-full object-cover"
                  onError={recoverDerivativeError}
                />
              </div>
            );
          }
          return (
            <OptionRow
              key={index}
              text={option.description_text ?? ''}
              isCorrect={isCorrect}
              correctLabel={t('situations.detail.exercises.correct')}
              language={language}
            />
          );
        })}
      </div>
    );
  }

  return null;
};

interface OptionRowProps {
  text: string;
  isCorrect: boolean;
  correctLabel: string;
  language: CultureLanguage;
}

const OptionRow: React.FC<OptionRowProps> = ({ text, isCorrect, correctLabel, language }) => (
  <div
    className={cn(
      'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
      isCorrect ? 'border-success bg-success/10 text-foreground' : 'border-border text-foreground'
    )}
  >
    <span lang={language}>{text}</span>
    {isCorrect && (
      <span
        className="inline-flex items-center gap-1 text-success"
        data-testid="situation-preview-correct"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium">{correctLabel}</span>
      </span>
    )}
  </div>
);
