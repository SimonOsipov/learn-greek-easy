// src/components/admin/__tests__/feedbackStatusMap.test.ts

import { describe, expect, it } from 'vitest';

import type { FeedbackCategory, FeedbackStatus } from '@/types/feedback';
import {
  BACKEND_TO_HANDOFF,
  CATEGORY_TONE,
  HANDOFF_STATUSES,
  HANDOFF_TO_BACKEND,
  STATUS_TONE,
  backendToHandoff,
  handoffToBackend,
  type HandoffStatus,
} from '../feedbackStatusMap';

const BACKEND_STATUSES: readonly FeedbackStatus[] = [
  'new',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'cancelled',
];

describe('feedbackStatusMap', () => {
  it('handoff table and function agree for all 8 handoff values', () => {
    for (const h of HANDOFF_STATUSES) {
      expect(handoffToBackend(h)).toBe(HANDOFF_TO_BACKEND[h]);
    }
  });

  it('backend table and function agree for all 6 backend values', () => {
    for (const b of BACKEND_STATUSES) {
      expect(backendToHandoff(b)).toBe(BACKEND_TO_HANDOFF[b]);
    }
  });

  it('round-trip: every handoff → backend → handoff lands in a value whose forward mapping equals the original backend value (lossy is OK)', () => {
    for (const h of HANDOFF_STATUSES) {
      const b = handoffToBackend(h);
      const hPrime = backendToHandoff(b);
      expect(handoffToBackend(hPrime)).toBe(b);
    }
  });

  it('round-trip: every backend → handoff → backend equals the original backend value', () => {
    for (const b of BACKEND_STATUSES) {
      const h = backendToHandoff(b);
      expect(handoffToBackend(h)).toBe(b);
    }
  });

  it('documents the two lossy collapses explicitly', () => {
    expect(handoffToBackend('responded')).toBe('under_review');
    expect(handoffToBackend('duplicate')).toBe('cancelled');
    // Reverse map picks the canonical handoff label for the collapsed bucket.
    expect(backendToHandoff('under_review')).toBe('investigating');
    expect(backendToHandoff('cancelled')).toBe('wont_fix');
  });

  it('HANDOFF_STATUSES array contains exactly 8 entries', () => {
    expect(HANDOFF_STATUSES).toHaveLength(8);
  });

  it('BACKEND_STATUSES covers exactly 6 entries (matches FeedbackStatus union)', () => {
    expect(BACKEND_STATUSES).toHaveLength(6);
  });

  it('every HANDOFF_STATUSES entry is a key in HANDOFF_TO_BACKEND', () => {
    for (const h of HANDOFF_STATUSES) {
      expect(HANDOFF_TO_BACKEND).toHaveProperty(h);
    }
  });

  it('every BACKEND_STATUSES entry is a key in BACKEND_TO_HANDOFF', () => {
    for (const b of BACKEND_STATUSES) {
      expect(BACKEND_TO_HANDOFF).toHaveProperty(b);
    }
  });
});

// ── STATUS_TONE exhaustiveness ─────────────────────────────────────────────────

describe('STATUS_TONE', () => {
  it('every handoff status has a tone entry', () => {
    for (const h of HANDOFF_STATUSES) {
      expect(STATUS_TONE).toHaveProperty(h);
      expect(STATUS_TONE[h]).toBeTruthy();
    }
  });

  it('STATUS_TONE has exactly 8 entries (one per HandoffStatus)', () => {
    expect(Object.keys(STATUS_TONE)).toHaveLength(8);
  });
});

// ── CATEGORY_TONE exhaustiveness ───────────────────────────────────────────────

const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = [
  'bug_incorrect_data',
  'feature_request',
] as const;

describe('CATEGORY_TONE', () => {
  it('every feedback category has a tone entry', () => {
    for (const c of FEEDBACK_CATEGORIES) {
      expect(CATEGORY_TONE).toHaveProperty(c);
      expect(CATEGORY_TONE[c]).toBeTruthy();
    }
  });

  it('CATEGORY_TONE has exactly 2 entries (one per FeedbackCategory)', () => {
    expect(Object.keys(CATEGORY_TONE)).toHaveLength(2);
  });
});
