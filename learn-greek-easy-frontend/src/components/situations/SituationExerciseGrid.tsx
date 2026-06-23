// src/components/situations/SituationExerciseGrid.tsx
//
// SIT-27-07: the situation-detail exercise section below the action panel —
// the exercise toolbar (search + status filters + EL/EN/RU + "showing X of Y")
// above a responsive grid of q-cards. All topic / status / search filtering is
// client-side over the cached exercises list (the action panel owns the topic
// filter and passes it down). Opening a q-card opens the read-only preview
// modal (SIT-27-08) — never a graded SM-2 attempt.

import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import type { ExerciseQueueItem } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

import {
  calcStatusCounts,
  exercisePrompt,
  matchesStatusFilter,
  matchesTopicFilter,
  type ExerciseStatusFilter,
  type ExerciseTopicFilter,
} from './exerciseGridHelpers';
import { SituationExercisePreviewModal } from './SituationExercisePreviewModal';
import { SituationExerciseQCard } from './SituationExerciseQCard';
import { SituationExerciseToolbar } from './SituationExerciseToolbar';

export interface SituationExerciseGridProps {
  exercises: ExerciseQueueItem[];
  /** Topic filter, owned by the action panel (single source of truth). */
  activeTopic: ExerciseTopicFilter;
  language: CultureLanguage;
  onLanguageChange: (lang: CultureLanguage) => void;
}

export const SituationExerciseGrid: React.FC<SituationExerciseGridProps> = ({
  exercises,
  activeTopic,
  language,
  onLanguageChange,
}) => {
  const { t } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<ExerciseStatusFilter>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Status counts are computed over the topic-filtered list so the toolbar
  // counts always reflect what the topic chips have narrowed to.
  const topicFiltered = useMemo(
    () => exercises.filter((e) => matchesTopicFilter(e.topic, activeTopic)),
    [exercises, activeTopic]
  );

  const statusCounts = useMemo(() => calcStatusCounts(topicFiltered), [topicFiltered]);

  const filtered = useMemo(() => {
    let result = topicFiltered;

    if (activeStatus !== 'all') {
      result = result.filter((e) => matchesStatusFilter(e.status, activeStatus));
    }

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((e) => exercisePrompt(e, language).toLowerCase().includes(query));
    }

    return result;
  }, [topicFiltered, activeStatus, search, language]);

  const previewExercise = useMemo(
    () => exercises.find((e) => e.exercise_id === previewId) ?? null,
    [exercises, previewId]
  );

  const hasFilters = search.trim() !== '' || activeStatus !== 'all' || activeTopic !== 'all';

  return (
    <div className="space-y-4" data-testid="situation-exercise-grid-section">
      <SituationExerciseToolbar
        searchValue={search}
        onSearchChange={setSearch}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        counts={statusCounts}
        shown={filtered.length}
        total={topicFiltered.length}
        language={language}
        onLanguageChange={onLanguageChange}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={t('situations.detail.exercises.noMatches.title')}
          description={
            hasFilters ? t('situations.detail.exercises.noMatches.description') : undefined
          }
        />
      ) : (
        <div
          data-testid="situation-q-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          className="grid gap-3"
        >
          {filtered.map((exercise) => (
            <SituationExerciseQCard
              key={exercise.exercise_id}
              exercise={exercise}
              language={language}
              onPreview={setPreviewId}
            />
          ))}
        </div>
      )}

      <SituationExercisePreviewModal
        exercise={previewExercise}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
};

SituationExerciseGrid.displayName = 'SituationExerciseGrid';
