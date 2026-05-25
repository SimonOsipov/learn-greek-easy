// src/stores/adminExercisesStore.ts

import { create } from 'zustand';

import type { ExerciseType } from '@/types/situation';

// ── Filter type aliases ────────────────────────────────────────────────────────

export type SourceFilter = 'all' | 'description' | 'dialog' | 'picture';
export type ExerciseTypeFilter = 'all' | ExerciseType;
export type LevelFilter = 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type StatusFilter = 'all' | 'approved' | 'pending' | 'draft';

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  source: 'all' as SourceFilter,
  type: 'all' as ExerciseTypeFilter,
  level: 'all' as LevelFilter,
  status: 'all' as StatusFilter,
  q: '',
  qDebounced: '',
  page: 1,
};

// ── Debounce timer (module-level so it survives re-renders) ───────────────────

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

// ── State + Actions interface ─────────────────────────────────────────────────

interface AdminExercisesState {
  source: SourceFilter;
  type: ExerciseTypeFilter;
  level: LevelFilter;
  status: StatusFilter;
  q: string;
  qDebounced: string;
  page: number;

  setSource: (v: SourceFilter) => void;
  setType: (v: ExerciseTypeFilter) => void;
  setLevel: (v: LevelFilter) => void;
  setStatus: (v: StatusFilter) => void;
  setQ: (v: string) => void;
  setPage: (v: number) => void;
  resetFilters: () => void;
  hydrateFromURL: (params: URLSearchParams) => void;
}

// ── Allowed value sets for URL hydration ──────────────────────────────────────

const VALID_SOURCES: SourceFilter[] = ['all', 'description', 'dialog', 'picture'];
const VALID_LEVELS: LevelFilter[] = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VALID_STATUSES: StatusFilter[] = ['all', 'approved', 'pending', 'draft'];
const VALID_TYPES: ExerciseTypeFilter[] = [
  'all',
  'fill_gaps',
  'select_heard',
  'true_false',
  'select_correct_answer',
  'select_picture_from_description',
  'select_description_from_picture',
];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAdminExercisesStore = create<AdminExercisesState>()((set) => ({
  ...DEFAULTS,

  setSource: (v) => {
    set({ source: v, page: 1 });
  },

  setType: (v) => {
    set({ type: v, page: 1 });
  },

  setLevel: (v) => {
    set({ level: v, page: 1 });
  },

  setStatus: (v) => {
    set({ status: v, page: 1 });
  },

  setQ: (v) => {
    set({ q: v, page: 1 });
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      useAdminExercisesStore.setState({ qDebounced: v });
    }, 300);
  },

  setPage: (v) => {
    set({ page: v });
  },

  resetFilters: () => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    set({ ...DEFAULTS });
  },

  hydrateFromURL: (params) => {
    const rawSource = params.get('source') ?? 'all';
    const source: SourceFilter = VALID_SOURCES.includes(rawSource as SourceFilter)
      ? (rawSource as SourceFilter)
      : 'all';

    const rawType = params.get('type') ?? 'all';
    const type: ExerciseTypeFilter = VALID_TYPES.includes(rawType as ExerciseTypeFilter)
      ? (rawType as ExerciseTypeFilter)
      : 'all';

    const rawLevel = params.get('level') ?? 'all';
    const level: LevelFilter = VALID_LEVELS.includes(rawLevel as LevelFilter)
      ? (rawLevel as LevelFilter)
      : 'all';

    const rawStatus = params.get('status') ?? 'all';
    const status: StatusFilter = VALID_STATUSES.includes(rawStatus as StatusFilter)
      ? (rawStatus as StatusFilter)
      : 'all';

    const q = params.get('q') ?? '';

    const rawPage = Number(params.get('page'));
    const page = !isNaN(rawPage) && rawPage >= 1 ? rawPage : 1;

    set({ source, type, level, status, q, qDebounced: q, page });
  },
}));
