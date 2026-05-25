import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { SegControl } from '@/components/ui/seg-control';
import {
  useAdminExercisesStore,
  type ExerciseTypeFilter,
  type LevelFilter,
  type SourceFilter,
  type StatusFilter,
} from '@/stores/adminExercisesStore';

// Types surfaced in the Type strip (picture variants surface via Source=Picture;
// word_order not yet in the ExerciseType union — add when backend ships it)
const TYPE_OPTIONS: ExerciseTypeFilter[] = [
  'all',
  'select_correct_answer',
  'fill_gaps',
  'true_false',
  'select_heard',
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
          label={t('exercises.filters.source.label')}
          options={SOURCE_OPTIONS.map((v) => ({
            value: v,
            label:
              v === 'all' ? t('exercises.filters.source.all') : t(`exercises.filters.source.${v}`),
          }))}
          value={source}
          onChange={setSource}
          ariaLabel={t('exercises.filters.source.label')}
        />

        <SegControl
          label={t('exercises.filters.type.label')}
          options={TYPE_OPTIONS.map((v) => ({
            value: v,
            label: v === 'all' ? t('exercises.filters.type.all') : t(`exercises.types.${v}`),
          }))}
          value={type}
          onChange={setType}
          ariaLabel={t('exercises.filters.type.label')}
        />

        <SegControl
          label={t('exercises.filters.level.label')}
          options={LEVEL_OPTIONS.map((v) => ({
            value: v,
            label:
              v === 'all'
                ? t('exercises.filters.level.all')
                : t(`exercises.filters.level.${v.toLowerCase()}`),
          }))}
          value={level}
          onChange={setLevel}
          ariaLabel={t('exercises.filters.level.label')}
        />

        <SegControl
          label={t('exercises.filters.status.label')}
          options={STATUS_OPTIONS.map((v) => ({
            value: v,
            label: v === 'all' ? t('exercises.filters.status.all') : t(`exercises.statuses.${v}`),
          }))}
          value={status}
          onChange={setStatus}
          ariaLabel={t('exercises.filters.status.label')}
        />
      </div>
    </div>
  );
}
