import type { InputMode } from '@/stores/v2PracticeStore';

export const INPUT_MODE_KEY = 'greekly_practice_input_mode';
export const SHOW_STREAK_KEY = 'greekly_practice_show_streak';

export function getPersistedInputMode(): InputMode {
  try {
    if (typeof window === 'undefined') return 'reveal';
    const stored = window.localStorage.getItem(INPUT_MODE_KEY);
    return stored === 'type' ? 'type' : 'reveal';
  } catch {
    return 'reveal';
  }
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
