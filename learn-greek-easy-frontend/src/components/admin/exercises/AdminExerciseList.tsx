import { useEffect, useState } from 'react';

import { BookOpen, Headphones, Image, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { adminAPI } from '@/services/adminAPI';
import type { AdminExerciseListItem, ExerciseType, ExerciseSourceType } from '@/types/situation';

import { ExerciseItemPayload } from './ExerciseItemPayload';

interface AdminExerciseListProps {
  modality: 'listening' | 'reading';
}

const SOURCE_TYPE_ICONS: Record<ExerciseSourceType, React.ElementType> = {
  description: BookOpen,
  dialog: Headphones,
  picture: Image,
};

const EXERCISE_TYPES: ExerciseType[] = [
  'select_correct_answer',
  'fill_gaps',
  'select_heard',
  'true_false',
];

export function AdminExerciseList({ modality }: AdminExerciseListProps) {
  const { t } = useTranslation('admin');

  const [exercises, setExercises] = useState<AdminExerciseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [exerciseTypeFilter, statusFilter, debouncedSearch]);

  // Fetch exercises
  useEffect(() => {
    let cancelled = false;
    const fetchExercises = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminAPI.getExercises({
          modality,
          page,
          page_size: pageSize,
          exercise_type: exerciseTypeFilter,
          status: statusFilter,
          search: debouncedSearch || undefined,
        });
        if (!cancelled) {
          setExercises(result.items);
          setTotal(result.total);
        }
      } catch {
        if (!cancelled) setError(t('adminExercises.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchExercises();
    return () => {
      cancelled = true;
    };
  }, [modality, page, pageSize, exerciseTypeFilter, statusFilter, debouncedSearch, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4" data-testid="admin-exercises-list">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder={t('adminExercises.filters.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="admin-exercises-search"
            aria-label={t('adminExercises.filters.searchPlaceholder')}
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
              aria-label={t('adminExercises.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={exerciseTypeFilter ?? 'all'}
          onValueChange={(v) => setExerciseTypeFilter(v === 'all' ? undefined : v)}
        >
          <SelectTrigger
            className="w-[200px]"
            data-testid="admin-exercises-type-filter"
            aria-label={t('adminExercises.filters.exerciseType')}
          >
            <SelectValue placeholder={t('adminExercises.filters.exerciseType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminExercises.filters.exerciseType')}</SelectItem>
            {EXERCISE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`adminExercises.exerciseTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter ?? 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}
        >
          <SelectTrigger
            className="w-[140px]"
            data-testid="admin-exercises-status-filter"
            aria-label={t('adminExercises.filters.status')}
          >
            <SelectValue placeholder={t('adminExercises.filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminExercises.filters.status')}</SelectItem>
            <SelectItem value="draft">{t('adminExercises.statuses.draft')}</SelectItem>
            <SelectItem value="approved">{t('adminExercises.statuses.approved')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Alert variant="destructive" data-testid="admin-exercises-error">
          <AlertDescription>
            {error}{' '}
            <button
              className="underline"
              onClick={() => {
                setError(null);
                setRetryCount((c) => c + 1);
              }}
            >
              {t('adminExercises.retry')}
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && exercises.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
          data-testid="admin-exercises-empty"
        >
          {modality === 'listening' ? (
            <Headphones className="h-10 w-10 opacity-40" />
          ) : (
            <BookOpen className="h-10 w-10 opacity-40" />
          )}
          <p className="text-sm">{t(`adminExercises.empty.${modality}`)}</p>
        </div>
      )}

      {/* Exercise list */}
      {!loading && !error && exercises.length > 0 && (
        <Accordion type="single" collapsible className="w-full space-y-1">
          {exercises.map((exercise) => {
            const Icon = SOURCE_TYPE_ICONS[exercise.source_type] ?? BookOpen;
            return (
              <AccordionItem
                key={exercise.id}
                value={exercise.id}
                className="rounded-lg border px-4"
                data-testid={`admin-exercise-item-${exercise.id}`}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2 text-left">
                    {/* Situation name */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{exercise.situation_title_el}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {exercise.situation_title_en}
                      </p>
                    </div>
                    {/* Badges */}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {t(`adminExercises.sourceTypes.${exercise.source_type}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`adminExercises.exerciseTypes.${exercise.exercise_type}`)}
                      </Badge>
                      <Badge
                        variant={exercise.status === 'approved' ? 'default' : 'secondary'}
                        className={
                          exercise.status === 'approved'
                            ? 'bg-success text-success-foreground hover:bg-success/90'
                            : undefined
                        }
                      >
                        {t(`adminExercises.statuses.${exercise.status}`)}
                      </Badge>
                      {exercise.source_type === 'description' && exercise.audio_level && (
                        <Badge variant="outline">{exercise.audio_level}</Badge>
                      )}
                      <Badge variant="secondary">
                        {t('adminExercises.itemCount', { count: exercise.item_count })}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {exercise.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('situations.detail.exercises.empty.noExercisesInGroup')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...exercise.items]
                        .sort((a, b) => a.item_index - b.item_index)
                        .map((item) => (
                          <ExerciseItemPayload
                            key={item.item_index}
                            payload={item.payload as Record<string, unknown>}
                            audioUrl={exercise.audio_url ?? undefined}
                            readingText={exercise.reading_text ?? undefined}
                          />
                        ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Pagination */}
      {total > 0 && !loading && (
        <div className="flex items-center justify-between" data-testid="admin-exercises-pagination">
          <p className="text-sm text-muted-foreground">
            {t('adminExercises.showing', { from, to, total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              {t('pagination.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('pagination.pageOf', { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
