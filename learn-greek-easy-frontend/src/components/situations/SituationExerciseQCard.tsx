// src/components/situations/SituationExerciseQCard.tsx
//
// SIT-27-07: a single exercise card (.cx-q-card) in the situation-detail
// exercise grid. Shows #id, a status dot, an optional image-mcq scene
// thumbnail, the prompt in the selected language, the "topic · N options"
// meta, and a 0–4 mastery-pip row derived from the per-exercise SM-2 status.
//
// SIT-27-08: the whole card is a button that opens the read-only preview modal.

import React from 'react';

import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { tDynamic } from '@/i18n/tDynamic';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import type { ExerciseQueueItem, PictureMatchOption } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

import {
  exerciseOptionCount,
  exercisePrompt,
  statusDotClass,
  statusToPips,
} from './exerciseGridHelpers';

export interface SituationExerciseQCardProps {
  exercise: ExerciseQueueItem;
  language: CultureLanguage;
  /** Open the read-only preview modal for this exercise. */
  onPreview: (exerciseId: string) => void;
}

/** Short, stable display id from the exercise UUID (e.g. "#A1B2"). */
function shortId(exerciseId: string): string {
  return `#${exerciseId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

/** First image-mcq scene thumbnail URL + variants, when the payload has one. */
function sceneImage(
  exercise: ExerciseQueueItem
): { url: string; variants: Record<number, string> | null } | null {
  const payload = exercise.items[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;

  // select_description_from_picture: a single anchor image.
  if (typeof payload.anchor_image_url === 'string' && payload.anchor_image_url) {
    return { url: payload.anchor_image_url, variants: null };
  }

  // select_picture_from_description: the first option image acts as the thumbnail.
  const options = payload.options as PictureMatchOption[] | undefined;
  if (Array.isArray(options)) {
    const withImg = options.find((o) => o.image_url);
    if (withImg?.image_url) {
      return { url: withImg.image_url, variants: withImg.image_variants };
    }
  }

  return null;
}

export const SituationExerciseQCard: React.FC<SituationExerciseQCardProps> = ({
  exercise,
  language,
  onPreview,
}) => {
  const { t } = useTranslation('common');

  const pips = statusToPips(exercise.status);
  const optionCount = exerciseOptionCount(exercise);
  const prompt = exercisePrompt(exercise, language);
  const scene = sceneImage(exercise);
  const topicLabel = exercise.topic
    ? tDynamic(t, `situations.detail.exercises.topics.${exercise.topic}`)
    : tDynamic(t, 'situations.detail.exercises.topics.unknown');

  return (
    <button
      type="button"
      className="cx-q-card text-left"
      data-testid="situation-q-card"
      data-exercise-id={exercise.exercise_id}
      onClick={() => onPreview(exercise.exercise_id)}
      aria-label={t('situations.detail.exercises.previewAria', {
        id: shortId(exercise.exercise_id),
      })}
    >
      {/* Head: #id + status dot */}
      <div className="cx-q-card-head">
        <span className="cx-q-card-id">{shortId(exercise.exercise_id)}</span>
        <span
          className={`h-2 w-2 rounded-full ${statusDotClass(exercise.status)}`}
          aria-label={t(`exercise.status.${exercise.status}`)}
          data-testid="situation-q-card-status-dot"
        />
      </div>

      {/* Scene thumbnail for image-mcq exercises */}
      {scene ? (
        <div className="cx-q-card-scene">
          <img
            src={scene.url}
            srcSet={scene.variants ? buildSrcSet(scene.variants) : undefined}
            sizes="(max-width: 768px) 100vw, 33vw"
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={recoverDerivativeError}
          />
        </div>
      ) : (
        exercise.topic === 'Visual' && (
          <div className="cx-q-card-scene">
            <ImageIcon className="h-8 w-8 text-fg3/40" aria-hidden="true" />
          </div>
        )
      )}

      {/* Prompt in the selected language */}
      <p className="cx-q-card-prompt" lang={language}>
        {prompt}
      </p>

      {/* Foot: meta (topic · options) + mastery pips */}
      <div className="cx-q-card-foot">
        <span className="cx-q-card-meta">
          <span>{topicLabel}</span>
          <span className="cx-q-card-meta-sep" aria-hidden="true">
            &middot;
          </span>
          <span>{t('situations.detail.exercises.optionsCount', { count: optionCount })}</span>
        </span>
        <span
          className="cx-pips"
          role="img"
          aria-label={t('situations.detail.exercises.masteryAria', {
            filled: pips.filled,
            total: 4,
          })}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="cx-pip"
              data-tone={pips.tone}
              data-filled={i < pips.filled ? 'true' : 'false'}
            />
          ))}
        </span>
      </div>
    </button>
  );
};

SituationExerciseQCard.displayName = 'SituationExerciseQCard';
