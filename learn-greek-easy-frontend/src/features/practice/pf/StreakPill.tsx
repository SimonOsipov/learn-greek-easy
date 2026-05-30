// src/features/practice/pf/StreakPill.tsx
//
// Displays the current session streak count with a flame icon.
// Hidden when `showStreak` is false.
//
// Design-system: uses --practice-hard token (25 95% 53%) via .pf-streak class.
// No raw hex or arbitrary Tailwind values (drift-rule compliant).

import { Flame } from 'lucide-react';

export interface StreakPillProps {
  /** Current streak count. */
  streak: number;
  /** Whether to show the streak pill. When false, renders nothing. */
  showStreak: boolean;
}

/**
 * StreakPill — flame icon + count pill for the practice top bar.
 *
 * Increments on OK/Easy ratings (managed by the store), resets on Forgot.
 * The showStreak gate is controlled by the session configuration.
 */
export function StreakPill({ streak, showStreak }: StreakPillProps) {
  if (!showStreak) return null;

  return (
    <span className="pf-streak" aria-label={`Streak: ${streak}`} role="status" aria-live="polite">
      <Flame className="pf-streak__icon" aria-hidden="true" />
      {streak}
    </span>
  );
}
