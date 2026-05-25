import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { SegControl } from '@/components/ui/seg-control';
import { track } from '@/lib/analytics/track';
import {
  useAdminExercisesStore,
  type ExerciseTypeFilter,
  type LevelFilter,
  type SourceFilter,
  type StatusFilter,
} from '@/stores/adminExercisesStore';

const TYPE_OPTIONS: ExerciseTypeFilter[] = [
  'all',
  'select_correct_answer',
  'fill_gaps',
  'true_false',
  'select_heard',
  'word_order',
];

const SOURCE_OPTIONS: SourceFilter[] = ['all', 'description', 'dialog', 'picture'];

const LEVEL_OPTIONS: LevelFilter[] = ['all', 'A2', 'B1'];

const STATUS_OPTIONS: StatusFilter[] = ['all', 'draft', 'pending', 'approved'];

interface AdminExercisesToolbarProps {
  /** modality stays a prop — driven by page-level toggle */
  modality: 'listening' | 'reading';
}

export function AdminExercisesToolbar({ modality: _modality }: AdminExercisesToolbarProps) {
  const { t } = useTranslation('admin');

  const source = useAdminExercisesStore((s) => s.source);
  const type = useAdminExercisesStore((s) => s.type);
  const level = useAdminExercisesStore((s) => s.level);
  const status = useAdminExercisesStore((s) => s.status);
  const q = useAdminExercisesStore((s) => s.q);
  const setSource = useAdminExercisesStore((s) => s.setSource);
  const setType = useAdminExercisesStore((s) => s.setType);
  const setLevel = useAdminExercisesStore((s) => s.setLevel);
  const setStatus = useAdminExercisesStore((s) => s.setStatus);
  const setQ = useAdminExercisesStore((s) => s.setQ);

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 pr-8"
          placeholder={t('exercises.search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQ('');
          }}
          data-testid="admin-exercises-search"
          aria-label={t('exercises.search.placeholder')}
        />
        {q && (
          <button
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => setQ('')}
            aria-label={t('exercises.search.clearAriaLabel')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Source · Type · Level · Status */}
      <div className="flex flex-wrap gap-3">
        <SegControl
          options={SOURCE_OPTIONS.map((v) => ({
            value: v,
            label:
              v === 'all' ? t('exercises.filters.source.all') : t(`exercises.filters.source.${v}`),
          }))}
          value={source}
          onChange={(v) => {
            setSource(v);
            // EXR-73: track filter change
            track('admin_exercise_filter_changed', { axis: 'source', value: v });
          }}
          ariaLabel={t('exercises.filters.source.label')}
          className="flex-col items-start sm:flex-row sm:items-center"
        />

        <SegControl
          options={TYPE_OPTIONS.map((v) => ({
            value: v,
            label: v === 'all' ? t('exercises.filters.type.all') : t(`exercises.types.${v}`),
          }))}
          value={type}
          onChange={(v) => {
            setType(v);
            track('admin_exercise_filter_changed', { axis: 'type', value: v });
          }}
          ariaLabel={t('exercises.filters.type.label')}
          className="flex-col items-start sm:flex-row sm:items-center"
        />

        <SegControl
          options={LEVEL_OPTIONS.map((v) => ({
            value: v,
            label:
              v === 'all'
                ? t('exercises.filters.level.all')
                : t(`exercises.filters.level.${v.toLowerCase()}`),
          }))}
          value={level}
          onChange={(v) => {
            setLevel(v);
            track('admin_exercise_filter_changed', { axis: 'level', value: v });
          }}
          ariaLabel={t('exercises.filters.level.label')}
          className="flex-col items-start sm:flex-row sm:items-center"
        />

        <SegControl
          options={STATUS_OPTIONS.map((v) => ({
            value: v,
            label: v === 'all' ? t('exercises.filters.status.all') : t(`exercises.statuses.${v}`),
          }))}
          value={status}
          onChange={(v) => {
            setStatus(v);
            track('admin_exercise_filter_changed', { axis: 'status', value: v });
          }}
          ariaLabel={t('exercises.filters.status.label')}
          className="flex-col items-start sm:flex-row sm:items-center"
        />
      </div>
    </div>
  );
}
