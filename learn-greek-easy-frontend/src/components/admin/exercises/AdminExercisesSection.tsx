import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import type { AdminExerciseListItem } from '@/types/situation';

import { AdminExerciseBody } from './AdminExerciseBody';
import { AdminExerciseRow } from './AdminExerciseRow';
import { AdminExercisesEmptyState } from './AdminExercisesEmptyState';
import { AdminExercisesPager } from './AdminExercisesPager';
import { AdminExercisesStats } from './AdminExercisesStats';
import { AdminExercisesToolbar } from './AdminExercisesToolbar';

interface AdminExercisesSectionProps {
  modality: 'listening' | 'reading';
  /** Increment to trigger a refetch (e.g., after generate-batch). */
  refreshKey?: number;
}

export function AdminExercisesSection({ modality, refreshKey = 0 }: AdminExercisesSectionProps) {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  // Hydrate store from URL on mount (once only)
  useEffect(() => {
    useAdminExercisesStore.getState().hydrateFromURL(searchParams);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Read filter state from store
  const source = useAdminExercisesStore((s) => s.source);
  const type = useAdminExercisesStore((s) => s.type);
  const level = useAdminExercisesStore((s) => s.level);
  const status = useAdminExercisesStore((s) => s.status);
  const qDebounced = useAdminExercisesStore((s) => s.qDebounced);
  const page = useAdminExercisesStore((s) => s.page);
  const setPage = useAdminExercisesStore((s) => s.setPage);

  // Sync store → URL (replace so back button doesn't step through every filter change)
  useEffect(() => {
    const next = new URLSearchParams();
    if (source !== 'all') next.set('source', source);
    if (type !== 'all') next.set('type', type);
    if (level !== 'all') next.set('level', level);
    if (status !== 'all') next.set('status', status);
    if (qDebounced) next.set('q', qDebounced);
    if (page !== 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [source, type, level, status, qDebounced, page, setSearchParams]);

  const [exercises, setExercises] = useState<AdminExerciseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // EXR-34: bump to refetch after a successful single-exercise regenerate
  const [innerRefreshKey, setInnerRefreshKey] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // EXR-39: auto-open first row on first non-empty fetch (once per mount)
  // Local state — no Zustand store needed; open state is section-scoped.
  const hasAutoOpened = useRef(false);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Fetch exercises whenever filters or page changes
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
          exercise_type: type !== 'all' ? type : undefined,
          status: status !== 'all' ? status : undefined,
          source: source !== 'all' ? source : undefined,
          level: level !== 'all' ? level : undefined,
          search: qDebounced || undefined,
        });
        if (!cancelled) {
          setExercises(result.items);
          setTotal(result.total);
        }
      } catch {
        if (!cancelled) setError(t('exercises.errorBanner.title'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchExercises();
    return () => {
      cancelled = true;
    };
  }, [
    modality,
    page,
    pageSize,
    type,
    status,
    source,
    level,
    qDebounced,
    retryCount,
    refreshKey,
    innerRefreshKey,
  ]);

  // EXR-39: auto-open first row on first non-empty fetch
  useEffect(() => {
    if (hasAutoOpened.current) return;
    if (!exercises || exercises.length === 0) return;
    setOpenIds((prev) => {
      if (prev.size > 0) return prev; // user already opened something manually
      return new Set([exercises[0].id]);
    });
    hasAutoOpened.current = true;
  }, [exercises]);

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4" data-testid="admin-exercises-list">
      <AdminExercisesStats items={exercises} total={total} />

      {/* Filter bar */}
      <AdminExercisesToolbar modality={modality} />

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
              {t('exercises.errorBanner.retry')}
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && exercises.length === 0 && (
        <AdminExercisesEmptyState modality={modality} />
      )}

      {/* Exercise list */}
      {!loading && !error && exercises.length > 0 && (
        <div className="w-full space-y-1">
          {exercises.map((exercise) => {
            const isOpen = openIds.has(exercise.id);
            const rowBodyId = `exercise-row-body-${exercise.id}`;
            return (
              <div
                key={exercise.id}
                className={cn(
                  'rounded-lg border transition-colors',
                  isOpen ? 'border-primary/50' : 'border-border hover:border-primary/35'
                )}
              >
                <AdminExerciseRow
                  exercise={exercise}
                  isOpen={isOpen}
                  onToggle={() => toggle(exercise.id)}
                  rowBodyId={rowBodyId}
                />
                {/* EXR-38: grid-template-rows animation for smooth expand/collapse */}
                <div
                  id={rowBodyId}
                  className={cn(
                    'duration-[180ms] grid transition-[grid-template-rows] ease-out motion-reduce:transition-none',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    {isOpen && (
                      <AdminExerciseBody
                        exercise={exercise}
                        onRegenerated={() => setInnerRefreshKey((k) => k + 1)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && !loading && (
        <AdminExercisesPager
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          showingFrom={from}
          showingTo={to}
          total={total}
        />
      )}
    </div>
  );
}
