import { create } from 'zustand';
import type { UserSettingsUpdate } from '@/types/user';

export type Level = 'new' | 'A1' | 'A2' | 'B1';
export type Goal = 'travel' | 'live' | 'work' | 'family' | 'citizen';
export type DailyMinutes = 5 | 15 | 30 | 60;

export const MINUTES_TO_GOAL = { 5: 10, 15: 25, 30: 50, 60: 100 } as const;

interface OnboardingState {
  level: Level | null;
  goal: Goal | null;
  dailyMinutes: DailyMinutes;
  isSubmitting: boolean;
  error: string | null;
  setLevel: (l: Level) => void;
  setGoal: (g: Goal) => void;
  setDailyMinutes: (m: DailyMinutes) => void;
  clearError: () => void;
  complete: (submit: (payload: UserSettingsUpdate) => Promise<void>) => Promise<void>;
  reset: () => void;
}

const initialState = {
  level: null as Level | null,
  goal: null as Goal | null,
  dailyMinutes: 15 as DailyMinutes,
  isSubmitting: false,
  error: null as string | null,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setLevel: (l: Level) => set({ level: l }),

  setGoal: (g: Goal) => set({ goal: g }),

  setDailyMinutes: (m: DailyMinutes) => set({ dailyMinutes: m }),

  clearError: () => set({ error: null }),

  complete: async (submit: (payload: UserSettingsUpdate) => Promise<void>) => {
    const proficiency_level = get().level ?? 'new';
    const learning_goal = get().goal ?? 'live';
    const daily_goal = MINUTES_TO_GOAL[get().dailyMinutes];
    const tour_completed_at = new Date().toISOString();

    const payload: UserSettingsUpdate = {
      proficiency_level,
      learning_goal,
      daily_goal,
      tour_completed_at,
    };

    set({ isSubmitting: true, error: null });
    try {
      await submit(payload);
      // On success, leave state as-is — the guard re-routes.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      set({ error: message });
    } finally {
      set({ isSubmitting: false });
    }
  },

  reset: () => set({ ...initialState }),
}));
