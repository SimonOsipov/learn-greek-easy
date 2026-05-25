import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import type { AdminExerciseListItem, AdminExerciseStatsResponse } from '@/types/situation';

import { AdminExerciseBody } from './AdminExerciseBody';
import { AdminExerciseRow } from './AdminExerciseRow';
import { AdminExercisesEmptyState } from './AdminExercisesEmptyState';
import { AdminExercisesPager } from './AdminExercisesPager';
import { AdminExercisesStats } from './AdminExercisesStats';
import { AdminExercisesToolbar } from './AdminExercisesToolbar';

interface AdminExercisesSectionProps {
  /** Increment to trigger a refetch. */
  refreshKey?: number;
}

export function AdminExercisesSection({ refreshKey = 0 }: AdminExercisesSectionProps) {
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
  const modality = useAdminExercisesStore((s) => s.modality);
  const qDebounced = useAdminExercisesStore((s) => s.qDebounced);
  const page = useAdminExercisesStore((s) => s.page);
  const setPage = useAdminExercisesStore((s) => s.setPage);

  // Sync store → URL (replace so back button doesn't step through every filter change).
  // CRITICAL: use the functional setSearchParams form so existing params (e.g. `?tab=exercises`
  // owned by the admin shell) survive — wiping them unmounts this section entirely.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (source !== 'all') next.set('source', source);
        else next.delete('source');
        if (type !== 'all') next.set('type', type);
        else next.delete('type');
        if (level !== 'all') next.set('level', level);
        else next.delete('level');
        if (status !== 'all') next.set('status', status);
        else next.delete('status');
        if (modality !== 'listening') next.set('modality', modality);
        else next.delete('modality');
        if (qDebounced) next.set('q', qDebounced);
        else next.delete('q');
        if (page !== 1) next.set('page', String(page));
        else next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [source, type, level, status, modality, qDebounced, page, setSearchParams]);

  const [exercises, setExercises] = useState<AdminExerciseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // EXR-34: bump to refetch after a successful single-exercise regenerate
  const [innerRefreshKey, setInnerRefreshKey] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // EXR2-24: catalog-wide stats (not affected by page changes — AC #2)
  const [stats, setStats] = useState<AdminExerciseStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // EXR-39: auto-open first row on first non-empty fetch (once per mount)
  // Local state — no Zustand store needed; open state is section-scoped.
  const hasAutoOpened = useRef(false);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // EXR-73: track row open (closed → open transition only)
        const exercise = exercises.find((e) => e.id === id);
        if (exercise) {
          track('admin_exercise_opened', {
            exercise_id: exercise.id,
            exercise_type: exercise.exercise_type,
            status: exercise.status,
            source: exercise.source_type,
            level: exercise.audio_level,
          });
        }
        next.add(id);
      }
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

  // EXR2-24: fetch catalog-wide stats — deps exclude `page` and `pageSize` so stats
  // remain stable while the user paginates (AC #2).
  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const result = await adminAPI.getExerciseStats({
          modality,
          exercise_type: type !== 'all' ? type : undefined,
          status: status !== 'all' ? status : undefined,
          source: source !== 'all' ? source : undefined,
          level: level !== 'all' ? level : undefined,
          search: qDebounced || undefined,
        });
        if (!cancelled) {
          setStats(result);
        }
      } catch {
        // Stats fetch failure is non-critical; clear stale data so cards don't
        // show counts from a previous filter/modality combination.
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [modality, type, status, source, level, qDebounced, retryCount, refreshKey, innerRefreshKey]);

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

  // EXR-79: hasActiveFilters — drives first-run vs filter-excluded empty state
  const hasActiveFilters =
    source !== 'all' || type !== 'all' || level !== 'all' || status !== 'all' || qDebounced !== '';

  return (
    <div className="space-y-4" data-testid="admin-exercises-list">
      {/* EXR2-24: pass catalog-wide stats; stats don't change when paginating (AC #2) */}
      <AdminExercisesStats stats={stats} loading={statsLoading} />

      {/* Filter bar */}
      <AdminExercisesToolbar />

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

      {/* Empty state — EXR-79: distinguish first-run from filter-excluded */}
      {!loading && !error && exercises.length === 0 && (
        <AdminExercisesEmptyState modality={modality} hasActiveFilters={hasActiveFilters} />
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
