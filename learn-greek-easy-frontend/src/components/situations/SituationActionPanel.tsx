// src/components/situations/SituationActionPanel.tsx
//
// SIT-27-07: the situation-detail action panel — overall progress bar +
// To-practice/Learning/Mastered legend + topic-filter chips (All / Listening /
// Reading / Dialogue / Visual, fed by SIT-27-03 topic_counts) + a Practice CTA
// that launches the EXISTING SM-2 exercise flow (`/practice/exercises`),
// unchanged. Reuses the dx-action* panel classes from the culture template.

import React from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Kicker } from '@/features/decks/dx';
import type { ExerciseTopic, TopicCounts } from '@/services/exerciseAPI';

import type { ExerciseTopicFilter } from './exerciseGridHelpers';

export interface SituationActionPanelProps {
  /** Mastered exercise count (for the progress bar + legend). */
  mastered: number;
  /** In-review (learning + review) exercise count. */
  inReview: number;
  /** To-practice (new) exercise count. */
  toPractice: number;
  /** Total exercises in the situation. */
  total: number;
  /** Per-topic counts for the topic chips (SIT-27-03). */
  topicCounts: TopicCounts | undefined;
  /** Active topic filter. */
  activeTopic: ExerciseTopicFilter;
  onTopicChange: (topic: ExerciseTopicFilter) => void;
}

const TOPIC_ORDER: ExerciseTopic[] = ['Listening', 'Reading', 'Dialogue', 'Visual'];

export const SituationActionPanel: React.FC<SituationActionPanelProps> = ({
  mastered,
  inReview,
  toPractice,
  total,
  topicCounts,
  activeTopic,
  onTopicChange,
}) => {
  const { t } = useTranslation('common');

  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const hasProgress = mastered > 0 || inReview > 0;

  const topicChips: { value: ExerciseTopicFilter; label: string; count: number }[] = [
    { value: 'all', label: t('situations.detail.exercises.topics.all'), count: total },
    ...TOPIC_ORDER.map((topic) => ({
      value: topic,
      label: t(`situations.detail.exercises.topics.${topic}`),
      count: topicCounts?.[topic] ?? 0,
    })),
  ];

  return (
    <div className="dx-action" data-testid="situation-action-panel">
      <Kicker tone="primary">{t('situations.detail.exercises.actionEyebrow')}</Kicker>

      {/* Progress head: title + pct */}
      <div className="dx-action-head">
        <h3 className="dx-action-h">
          {t('situations.detail.exercises.yourProgress')} &middot;{' '}
          <span className="dx-action-pct">{pct}%</span>
        </h3>
      </div>

      {/* Gradient progress bar */}
      <div
        className="dx-action-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('situations.detail.exercises.progressBarLabel')}
      >
        <span data-testid="situation-action-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Legend */}
      <div className="dx-action-legend">
        <span className="dx-action-legend-item" data-tone="todo">
          {t('situations.detail.exercises.legendToPractice', { count: toPractice })}
        </span>
        <span className="dx-action-legend-item" data-tone="learn">
          {t('situations.detail.exercises.legendLearning', { count: inReview })}
        </span>
        <span className="dx-action-legend-item" data-tone="master">
          {t('situations.detail.exercises.legendMastered', { count: mastered })}
        </span>
      </div>

      {/* Topic-filter chips */}
      <div
        className="dx-action-want-chips"
        role="group"
        aria-label={t('situations.detail.exercises.topicFilterGroup')}
        data-testid="situation-topic-chips"
      >
        {topicChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className="dx-action-want-chip"
            aria-pressed={activeTopic === chip.value}
            onClick={() => onTopicChange(chip.value)}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      {/* Full-width Practice CTA → existing SM-2 exercise flow (unchanged) */}
      <Link to="/practice/exercises" className="dx-action-cta" data-testid="situation-practice-cta">
        {hasProgress
          ? t('situations.detail.exercises.continuePractice')
          : t('situations.detail.exercises.startPractice')}
      </Link>
    </div>
  );
};

SituationActionPanel.displayName = 'SituationActionPanel';
