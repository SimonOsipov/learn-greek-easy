/**
 * Achievements Page Utility Tests
 *
 * Tests for sorting, normalisation, filter logic, and "Almost There" selection
 * used in the Achievements page.
 */

import { describe, it, expect } from 'vitest';

import type { AchievementResponse } from '@/services/xpAPI';

import { normaliseAchievement, sortAchievements, STATUS_FILTERS } from '../AchievementsPage';

const createMockAchievement = (
  overrides: Partial<AchievementResponse> = {}
): AchievementResponse => ({
  id: 'test-achievement',
  name: 'Test Achievement',
  description: 'Test description',
  category: 'learning',
  icon: 'star',
  hint: 'Test hint',
  threshold: 100,
  xp_reward: 50,
  unlocked: false,
  unlocked_at: null,
  progress: 0,
  current_value: 0,
  ...overrides,
});

const testAchievements: AchievementResponse[] = [
  createMockAchievement({
    id: 'unlocked-1',
    unlocked: true,
    progress: 100,
    unlocked_at: '2026-01-01',
  }),
  createMockAchievement({
    id: 'unlocked-2',
    unlocked: true,
    progress: 85,
    unlocked_at: '2026-01-02',
  }),
  createMockAchievement({ id: 'in-progress-high', progress: 80, current_value: 80 }),
  createMockAchievement({ id: 'in-progress-mid', progress: 50, current_value: 50 }),
  createMockAchievement({ id: 'in-progress-low', progress: 20, current_value: 20 }),
  createMockAchievement({ id: 'locked-1', progress: 0, current_value: 0 }),
  createMockAchievement({ id: 'locked-2', progress: 0, current_value: 0 }),
];

describe('Sorting Utility', () => {
  describe('Sort Order', () => {
    it('should place unlocked achievements first', () => {
      const sorted = sortAchievements(testAchievements);
      expect(sorted[0].unlocked).toBe(true);
      expect(sorted[1].unlocked).toBe(true);
    });

    it('should place in-progress achievements after unlocked', () => {
      const sorted = sortAchievements(testAchievements);
      expect(sorted[2].id).toBe('in-progress-high');
      expect(sorted[3].id).toBe('in-progress-mid');
      expect(sorted[4].id).toBe('in-progress-low');
    });

    it('should sort in-progress achievements by progress descending', () => {
      const sorted = sortAchievements(testAchievements);
      const inProgress = sorted.filter((a) => !a.unlocked && a.progress > 0);
      expect(inProgress[0].progress).toBeGreaterThanOrEqual(inProgress[1].progress);
      expect(inProgress[1].progress).toBeGreaterThanOrEqual(inProgress[2].progress);
    });

    it('should place locked achievements last', () => {
      const sorted = sortAchievements(testAchievements);
      expect(sorted[5].progress).toBe(0);
      expect(sorted[6].progress).toBe(0);
    });

    it('should handle all-unlocked array', () => {
      const allUnlocked = [
        createMockAchievement({ id: 'u1', unlocked: true, progress: 100 }),
        createMockAchievement({ id: 'u2', unlocked: true, progress: 100 }),
      ];
      const sorted = sortAchievements(allUnlocked);
      expect(sorted).toHaveLength(2);
      expect(sorted.every((a) => a.unlocked)).toBe(true);
    });

    it('should handle all-locked array', () => {
      const allLocked = [
        createMockAchievement({ id: 'l1', progress: 0 }),
        createMockAchievement({ id: 'l2', progress: 0 }),
      ];
      const sorted = sortAchievements(allLocked);
      expect(sorted).toHaveLength(2);
      expect(sorted.every((a) => a.progress === 0)).toBe(true);
    });

    it('should handle empty array', () => {
      expect(sortAchievements([])).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const original = [...testAchievements];
      sortAchievements(testAchievements);
      expect(testAchievements).toEqual(original);
    });
  });
});

describe('Data Integrity — Progress Normalisation', () => {
  it('should normalise progress to 100 when unlocked is true and progress < 100', () => {
    const achievement = createMockAchievement({ unlocked: true, progress: 85 });
    const normalised = normaliseAchievement(achievement);
    expect(normalised.progress).toBe(100);
  });

  it('should keep progress at 100 when unlocked is true and progress is already 100', () => {
    const achievement = createMockAchievement({ unlocked: true, progress: 100 });
    const normalised = normaliseAchievement(achievement);
    expect(normalised.progress).toBe(100);
  });

  it('should not change progress when unlocked is false', () => {
    const achievement = createMockAchievement({ unlocked: false, progress: 42 });
    const normalised = normaliseAchievement(achievement);
    expect(normalised.progress).toBe(42);
  });
});

describe('Filter Logic', () => {
  const normalised = testAchievements.map(normaliseAchievement);

  describe('Counts', () => {
    it('should return correct count for "All" tab', () => {
      expect(normalised.filter(STATUS_FILTERS.all)).toHaveLength(7);
    });

    it('should return correct count for "Unlocked" tab', () => {
      expect(normalised.filter(STATUS_FILTERS.unlocked)).toHaveLength(2);
    });

    it('should return correct count for "In Progress" tab', () => {
      expect(normalised.filter(STATUS_FILTERS.in_progress)).toHaveLength(3);
    });

    it('should return correct count for "Locked" tab', () => {
      expect(normalised.filter(STATUS_FILTERS.locked)).toHaveLength(2);
    });
  });

  describe('Filtering', () => {
    it('should return all achievements for "All" filter', () => {
      const filtered = normalised.filter(STATUS_FILTERS.all);
      expect(filtered).toHaveLength(normalised.length);
    });

    it('should return only unlocked achievements for "Unlocked" filter', () => {
      const filtered = normalised.filter(STATUS_FILTERS.unlocked);
      expect(filtered.every((a) => a.unlocked)).toBe(true);
    });

    it('should return only in-progress achievements for "In Progress" filter', () => {
      const filtered = normalised.filter(STATUS_FILTERS.in_progress);
      expect(filtered.every((a) => !a.unlocked && a.progress > 0)).toBe(true);
    });

    it('should return only locked achievements for "Locked" filter', () => {
      const filtered = normalised.filter(STATUS_FILTERS.locked);
      expect(filtered.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
    });

    it('should handle empty result sets gracefully', () => {
      const allUnlocked = [createMockAchievement({ id: 'u1', unlocked: true, progress: 100 })].map(
        normaliseAchievement
      );
      expect(allUnlocked.filter(STATUS_FILTERS.locked)).toHaveLength(0);
    });
  });
});

describe('"Almost There" Selection', () => {
  // Replicate the page's almostThereAchievements logic
  const selectAlmostThere = (achievements: AchievementResponse[]) =>
    achievements
      .map(normaliseAchievement)
      .filter((a) => !a.unlocked && a.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);

  it('should return top 3 achievements sorted by progress descending', () => {
    const result = selectAlmostThere(testAchievements);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('in-progress-high');
    expect(result[1].id).toBe('in-progress-mid');
    expect(result[2].id).toBe('in-progress-low');
  });

  it('should exclude achievements where unlocked === true', () => {
    const result = selectAlmostThere(testAchievements);
    expect(result.every((a) => !a.unlocked)).toBe(true);
  });

  it('should exclude achievements where progress === 0', () => {
    const result = selectAlmostThere(testAchievements);
    expect(result.every((a) => a.progress > 0)).toBe(true);
  });

  it('should return fewer than 3 if fewer candidates exist', () => {
    const few = [
      createMockAchievement({ id: 'ip-1', progress: 60 }),
      createMockAchievement({ id: 'locked', progress: 0 }),
    ];
    const result = selectAlmostThere(few);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ip-1');
  });

  it('should return empty array if no candidates match', () => {
    const none = [
      createMockAchievement({ id: 'u1', unlocked: true, progress: 100 }),
      createMockAchievement({ id: 'l1', progress: 0 }),
    ];
    expect(selectAlmostThere(none)).toHaveLength(0);
  });

  it('should handle tie-breaking deterministically', () => {
    const tied = [
      createMockAchievement({ id: 'a', progress: 50 }),
      createMockAchievement({ id: 'b', progress: 50 }),
      createMockAchievement({ id: 'c', progress: 50 }),
      createMockAchievement({ id: 'd', progress: 50 }),
    ];
    const result = selectAlmostThere(tied);
    expect(result).toHaveLength(3);
    // Stable sort preserves original order for equal values
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('c');
  });
});
