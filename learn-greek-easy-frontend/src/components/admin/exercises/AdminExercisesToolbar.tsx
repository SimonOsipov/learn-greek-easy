import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExerciseType } from '@/types/situation';

const EXERCISE_TYPES: ExerciseType[] = [
  'select_correct_answer',
  'fill_gaps',
  'select_heard',
  'true_false',
  'select_picture_from_description',
  'select_description_from_picture',
];

interface AdminExercisesToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  type: string | undefined;
  setType: (value: string | undefined) => void;
  status: string | undefined;
  setStatus: (value: string | undefined) => void;
  clearSearch: () => void;
}

export function AdminExercisesToolbar({
  search,
  setSearch,
  type,
  setType,
  status,
  setStatus,
  clearSearch,
}: AdminExercisesToolbarProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 pr-8"
          placeholder={t('exercises.search.placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="admin-exercises-search"
          aria-label={t('exercises.search.placeholder')}
        />
        {search && (
          <button
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={clearSearch}
            aria-label={t('exercises.search.clearAriaLabel')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={type ?? 'all'} onValueChange={(v) => setType(v === 'all' ? undefined : v)}>
        <SelectTrigger
          className="w-[200px]"
          data-testid="admin-exercises-type-filter"
          aria-label={t('exercises.filters.type.label')}
        >
          <SelectValue placeholder={t('exercises.filters.type.label')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('exercises.filters.type.label')}</SelectItem>
          {EXERCISE_TYPES.map((exerciseType) => (
            <SelectItem key={exerciseType} value={exerciseType}>
              {t(`exercises.types.${exerciseType}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status ?? 'all'} onValueChange={(v) => setStatus(v === 'all' ? undefined : v)}>
        <SelectTrigger
          className="w-[140px]"
          data-testid="admin-exercises-status-filter"
          aria-label={t('exercises.filters.status.label')}
        >
          <SelectValue placeholder={t('exercises.filters.status.label')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('exercises.filters.status.label')}</SelectItem>
          <SelectItem value="draft">{t('exercises.statuses.draft')}</SelectItem>
          <SelectItem value="approved">{t('exercises.statuses.approved')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
