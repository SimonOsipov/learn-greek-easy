import type { InputMode } from '@/stores/v2PracticeStore';

export const INPUT_MODE_KEY = 'greekly_practice_input_mode';
export const SHOW_STREAK_KEY = 'greekly_practice_show_streak';

// Type-mode toggle removed (PRACT2-2-05) — always return reveal so any
// persisted 'type' value from a previous session does not strand the user.
export function getPersistedInputMode(): InputMode {
  return 'reveal';
}

export function setPersistedInputMode(mode: InputMode): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(INPUT_MODE_KEY, mode);
  } catch {
    // best-effort persistence
  }
}

export function getPersistedShowStreak(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(SHOW_STREAK_KEY);
    return stored === 'false' ? false : true;
  } catch {
    return true;
  }
}

export function setPersistedShowStreak(value: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SHOW_STREAK_KEY, String(value));
  } catch {
    // best-effort persistence
  }
}
