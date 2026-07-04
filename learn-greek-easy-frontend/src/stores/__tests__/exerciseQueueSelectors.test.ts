// src/stores/__tests__/exerciseQueueSelectors.test.ts
// RED specs for PERF-22-03: selectExerciseQueueTotal (canonical queue total).
//
// RED reason: src/stores/exerciseQueueSelectors.ts does not exist yet — this
// file fails at module resolution ("Cannot find module '../exerciseQueueSelectors'"),
// not as a per-assertion failure. Unlike sessionSelectors.ts (PRACT2-12-05),
// no stub placeholder was pre-created for this story, so module-not-found is
// the sanctioned RED here. The two assertions below are written so they only
// pass once selectExerciseQueueTotal correctly returns queue.total_in_queue
// (not total_due + total_new, and not some other derived sum).

import { describe, expect, it } from 'vitest';

import type { ExerciseQueue } from '@/services/exerciseAPI';

import { selectExerciseQueueTotal } from '../exerciseQueueSelectors';

describe('selectExerciseQueueTotal', () => {
  // D10/F4 regression guard: total_in_queue is the canonical count. A queue
  // where total_due + total_new = 3 but total_in_queue = 0 (e.g. all items
  // dropped for insufficient distractor pool) must return 0, NOT 3.
  it('returns total_in_queue, NOT total_due + total_new', () => {
    const queue: ExerciseQueue = {
      total_due: 2,
      total_new: 1,
      total_early_practice: 0,
      total_in_queue: 0,
      exercises: [],
    };

    expect(selectExerciseQueueTotal(queue)).toBe(0);
  });

  // Complement direction: total_due=0, total_new=0 (old sum-based logic would
  // read 0), but total_early_practice folds into total_in_queue=2. The
  // selector must return 2 — proving it reads the canonical field in both
  // directions, not just "more conservative".
  it('reflects early-practice-only queues (total_due=0, total_new=0, total_early_practice>0)', () => {
    const queue: ExerciseQueue = {
      total_due: 0,
      total_new: 0,
      total_early_practice: 2,
      total_in_queue: 2,
      exercises: [],
    };

    expect(selectExerciseQueueTotal(queue)).toBe(2);
  });

  // QA adversarial (PERF-22-03 Mode B): the selector is a direct property
  // read with no `?? 0` fallback. A malformed API response (field missing at
  // runtime despite the static ExerciseQueue contract) must not silently
  // coerce to a truthy/incorrect value — it should surface as `undefined`,
  // NOT as a falsy-looking 0 masking a real backend contract violation.
  // Documents current behavior; the hub already guards the undefined case
  // separately at the call site (`data ? selectExerciseQueueTotal(data) : 0`).
  it('returns undefined (not 0, not a thrown error) when total_in_queue is missing at runtime', () => {
    const malformedQueue = {
      total_due: 1,
      total_new: 1,
      total_early_practice: 0,
      exercises: [],
    } as unknown as ExerciseQueue;

    expect(selectExerciseQueueTotal(malformedQueue)).toBeUndefined();
  });
});
