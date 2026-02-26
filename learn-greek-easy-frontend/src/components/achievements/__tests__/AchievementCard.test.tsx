/**
 * AchievementCard Component Tests
 *
 * Tests for rendering behaviour based on unlock status, progress, and edge cases.
 */

import { describe, it, expect } from 'vitest';

import { render, screen } from '@/lib/test-utils';
import type { AchievementResponse } from '@/services/xpAPI';

import { AchievementCard } from '../AchievementCard';

const createMockAchievement = (
  overrides: Partial<AchievementResponse> = {}
): AchievementResponse => ({
  id: 'test-achievement',
  name: 'Test Achievement',
  description: 'You completed the test',
  category: 'learning',
  icon: 'star',
  hint: 'Complete the test to unlock',
  threshold: 100,
  xp_reward: 50,
  unlocked: false,
  unlocked_at: null,
  progress: 0,
  current_value: 0,
  ...overrides,
});

describe('AchievementCard', () => {
  describe('Basic Rendering', () => {
    it('should render achievement name', () => {
      render(<AchievementCard achievement={createMockAchievement({ name: 'My Badge' })} />);
      expect(screen.getByText('My Badge')).toBeInTheDocument();
    });

    it('should render description when unlocked', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({
            unlocked: true,
            description: 'Well done!',
          })}
        />
      );
      expect(screen.getByText('Well done!')).toBeInTheDocument();
    });

    it('should render hint when locked', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({
            unlocked: false,
            hint: 'Keep going!',
          })}
        />
      );
      expect(screen.getByText('Keep going!')).toBeInTheDocument();
    });

    it('should render XP reward badge', () => {
      render(<AchievementCard achievement={createMockAchievement({ xp_reward: 75 })} />);
      expect(screen.getByText('75 XP')).toBeInTheDocument();
    });
  });

  describe('Unlock Status Display', () => {
    it('should show "Completed" badge for unlocked achievement', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({
            unlocked: true,
            progress: 100,
            unlocked_at: '2026-01-15T10:00:00Z',
          })}
        />
      );
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should show "Locked" badge for locked achievement', () => {
      render(<AchievementCard achievement={createMockAchievement()} />);
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('should apply purple styling for unlocked achievements', () => {
      const { container } = render(
        <AchievementCard achievement={createMockAchievement({ unlocked: true, progress: 100 })} />
      );
      const card = container.querySelector('[role="article"]');
      expect(card?.className).toContain('border-purple-300');
    });

    it('should apply muted styling for locked achievements', () => {
      const { container } = render(<AchievementCard achievement={createMockAchievement()} />);
      const card = container.querySelector('[role="article"]');
      expect(card?.className).toContain('opacity-75');
    });
  });

  describe('Progress Bar', () => {
    it('should display progress bar for in-progress achievement', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({
            progress: 65,
            current_value: 65,
            threshold: 100,
          })}
        />
      );
      expect(screen.getByText('65 / 100')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not display progress bar for fully locked achievement', () => {
      render(
        <AchievementCard achievement={createMockAchievement({ progress: 0, current_value: 0 })} />
      );
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should show current_value / threshold text', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({
            progress: 30,
            current_value: 30,
            threshold: 100,
          })}
        />
      );
      expect(screen.getByText('30 / 100')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle achievement with very long name', () => {
      const longName = 'A'.repeat(200);
      render(<AchievementCard achievement={createMockAchievement({ name: longName })} />);
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle achievement with null unlocked_at', () => {
      render(
        <AchievementCard
          achievement={createMockAchievement({ unlocked: true, unlocked_at: null })}
        />
      );
      // Should not crash, and should not show unlock date
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });
});
