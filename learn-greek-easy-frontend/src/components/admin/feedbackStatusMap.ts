// src/components/admin/feedbackStatusMap.ts
//
// Single source of truth for the bidirectional mapping between the 8 handoff-facing
// status values (used in the admin drawer picker) and the 6 backend FeedbackStatus
// values stored in the database.
//
// Mapping is intentionally lossy in two directions:
//   'responded'  → 'under_review'   (backend auto-promotes when admin_response is saved)
//   'duplicate'  → 'cancelled'      (no distinct backend bucket)
// The reverse map picks the canonical handoff label for each backend bucket.

import type { FeedbackStatus } from '@/types/feedback';

// ── Handoff status type ────────────────────────────────────────────────────────

/** 8 handoff-facing status values shown in the admin drawer picker. */
export type HandoffStatus =
  | 'new'
  | 'investigating'
  | 'planned'
  | 'in_progress'
  | 'responded'
  | 'shipped'
  | 'wont_fix'
  | 'duplicate';

export const HANDOFF_STATUSES: readonly HandoffStatus[] = [
  'new',
  'investigating',
  'planned',
  'in_progress',
  'responded',
  'shipped',
  'wont_fix',
  'duplicate',
] as const;

// ── Lookup tables ──────────────────────────────────────────────────────────────

// Record<HandoffStatus, FeedbackStatus> — compile error if HandoffStatus gains a
// new variant and the table is not updated.
export const HANDOFF_TO_BACKEND: Record<HandoffStatus, FeedbackStatus> = {
  new: 'new',
  investigating: 'under_review',
  planned: 'planned',
  in_progress: 'in_progress',
  responded: 'under_review',
  shipped: 'completed',
  wont_fix: 'cancelled',
  duplicate: 'cancelled',
};

// Record<FeedbackStatus, HandoffStatus> — compile error if FeedbackStatus gains a
// new variant and the table is not updated.
export const BACKEND_TO_HANDOFF: Record<FeedbackStatus, HandoffStatus> = {
  new: 'new',
  under_review: 'investigating',
  planned: 'planned',
  in_progress: 'in_progress',
  completed: 'shipped',
  cancelled: 'wont_fix',
};

// ── Exhaustiveness helper ──────────────────────────────────────────────────────

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled status value: ${String(x)}`);
}

// ── Conversion functions (switch-based for exhaustive `never` guard) ───────────

export function handoffToBackend(h: HandoffStatus): FeedbackStatus {
  switch (h) {
    case 'new':
      return 'new';
    case 'investigating':
      return 'under_review';
    case 'planned':
      return 'planned';
    case 'in_progress':
      return 'in_progress';
    case 'responded':
      return 'under_review';
    case 'shipped':
      return 'completed';
    case 'wont_fix':
      return 'cancelled';
    case 'duplicate':
      return 'cancelled';
    default:
      return assertUnreachable(h);
  }
}

export function backendToHandoff(b: FeedbackStatus): HandoffStatus {
  switch (b) {
    case 'new':
      return 'new';
    case 'under_review':
      return 'investigating';
    case 'planned':
      return 'planned';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'shipped';
    case 'cancelled':
      return 'wont_fix';
    default:
      return assertUnreachable(b);
  }
}
