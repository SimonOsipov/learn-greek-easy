export const TOUR_COMPLETED_KEY = 'greekly_tour_completed';

export function isTourCompleted(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTourCompleted(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
  } catch {
    // best-effort persistence
  }
}

export function resetTourCompleted(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOUR_COMPLETED_KEY);
  } catch {
    // best-effort
  }
}
