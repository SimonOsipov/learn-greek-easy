export const TOUR_COMPLETED_KEY = 'greekly_tour_completed';

export function isTourCompleted(serverTourCompletedAt?: string | null): boolean {
  // Server-side check first (authoritative)
  if (serverTourCompletedAt) return true;

  // Fall back to localStorage (fast cache)
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
