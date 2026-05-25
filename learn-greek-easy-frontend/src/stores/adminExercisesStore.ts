// src/stores/adminExercisesStore.ts

import { create } from 'zustand';

import type { ExerciseType } from '@/types/situation';

// ── Filter type aliases ────────────────────────────────────────────────────────

export type SourceFilter = 'all' | 'description' | 'dialog' | 'picture';
export type ExerciseTypeFilter = 'all' | ExerciseType;
export type LevelFilter = 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type StatusFilter = 'all' | 'approved' | 'pending' | 'draft';
export type Modality = 'listening' | 'reading';

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  source: 'all' as SourceFilter,
  type: 'all' as ExerciseTypeFilter,
  level: 'all' as LevelFilter,
  status: 'all' as StatusFilter,
  modality: 'listening' as Modality,
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
  modality: Modality;
  q: string;
  qDebounced: string;
  page: number;

  // Drawer state (local UI only — NOT URL-synced)
  mode: 'compose' | 'edit' | null;
  openEntryId: string | null;

  setSource: (v: SourceFilter) => void;
  setType: (v: ExerciseTypeFilter) => void;
  setLevel: (v: LevelFilter) => void;
  setStatus: (v: StatusFilter) => void;
  setModality: (v: Modality) => void;
  setQ: (v: string) => void;
  setPage: (v: number) => void;
  resetFilters: () => void;
  hydrateFromURL: (params: URLSearchParams) => void;
  openCompose: () => void;
  openEdit: (id: string) => void;
  closeDrawer: () => void;
}

// ── Allowed value sets for URL hydration ──────────────────────────────────────

const VALID_SOURCES: SourceFilter[] = ['all', 'description', 'dialog', 'picture'];
const VALID_LEVELS: LevelFilter[] = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VALID_STATUSES: StatusFilter[] = ['all', 'approved', 'pending', 'draft'];
const VALID_MODALITIES: Modality[] = ['listening', 'reading'];
const VALID_TYPES: ExerciseTypeFilter[] = [
  'all',
  'fill_gaps',
  'select_heard',
  'true_false',
  'select_correct_answer',
  'select_picture_from_description',
  'select_description_from_picture',
  'word_order',
];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAdminExercisesStore = create<AdminExercisesState>()((set) => ({
  ...DEFAULTS,

  // Drawer state initial values
  mode: null,
  openEntryId: null,

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

  setModality: (v) => {
    set({ modality: v, page: 1 });
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

  openCompose: () => set({ mode: 'compose', openEntryId: null }),
  openEdit: (id) => set({ mode: 'edit', openEntryId: id }),
  closeDrawer: () => set({ mode: null, openEntryId: null }),

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

    const rawModality = params.get('modality') ?? 'listening';
    const modality: Modality = VALID_MODALITIES.includes(rawModality as Modality)
      ? (rawModality as Modality)
      : 'listening';

    const q = params.get('q') ?? '';

    const rawPage = Number(params.get('page'));
    const page = !isNaN(rawPage) && rawPage >= 1 ? rawPage : 1;

    set({ source, type, level, status, modality, q, qDebounced: q, page });
  },
}));
