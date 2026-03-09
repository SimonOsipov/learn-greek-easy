import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AchievementsGrid } from '../AchievementsGrid';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Return full namespaced key for stable, distinct test assertions
      const namespaced = ns ? `${ns}:${key}` : key;
      if (opts) {
        return Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          namespaced
        );
      }
      return namespaced;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock xpStore
const mockUseXPStore = vi.fn();
vi.mock('@/stores/xpStore', () => ({
  useXPStore: (selector: (state: Record<string, unknown>) => unknown) => mockUseXPStore(selector),
  selectAchievements: (state: Record<string, unknown>) => state.achievements,
  selectIsLoadingAchievements: (state: Record<string, unknown>) => state.loadingAchievements,
  selectXPError: (state: Record<string, unknown>) => state.error,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
}));

// Mock AchievementIcon
vi.mock('@/components/achievements/AchievementIcon', () => ({
  AchievementIcon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

const makeAchievement = (overrides = {}) => ({
  id: 'first_steps',
  name: 'First Steps',
  description: 'Learn 10 words',
  category: 'learning',
  icon: 'star',
  hint: 'Learn 10 words',
  threshold: 10,
  xp_reward: 50,
  unlocked: false,
  unlocked_at: null,
  progress: 0,
  current_value: 0,
  ...overrides,
});

const makeStoreState = (overrides = {}) => ({
  achievements: null,
  loadingAchievements: false,
  error: null,
  ...overrides,
});

function renderGrid(storeState = makeStoreState()) {
  mockUseXPStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeState as Record<string, unknown>)
  );
  return render(
    <MemoryRouter>
      <AchievementsGrid />
    </MemoryRouter>
  );
}

describe('AchievementsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when loading and no achievements', () => {
    renderGrid(makeStoreState({ loadingAchievements: true, achievements: null }));
    // Skeletons render inside Card — just confirm no loaded content
    expect(
      screen.queryByText(/statistics:achievements\.summary\.unlocked/)
    ).not.toBeInTheDocument();
  });

  it('shows error message when error and no achievements', () => {
    renderGrid(makeStoreState({ error: 'Network error', achievements: null }));
    expect(screen.getByText(/statistics:error\.loadingData/)).toBeInTheDocument();
  });

  it('shows noProgress empty state when 0 unlocked and 0 progress', () => {
    const achievements = {
      achievements: [
        makeAchievement({ progress: 0 }),
        makeAchievement({ id: 'week_warrior', progress: 0 }),
      ],
      total_count: 2,
      unlocked_count: 0,
      total_xp_earned: 0,
    };
    renderGrid(makeStoreState({ achievements }));
    expect(screen.getByText('statistics:achievements.emptyState.noProgress')).toBeInTheDocument();
    expect(
      screen.queryByText('statistics:achievements.emptyState.someProgress')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('statistics:achievements.recentlyUnlocked.title')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('statistics:achievements.nextUp.title')).not.toBeInTheDocument();
    // CTA link still present
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('shows someProgress empty state when 0 unlocked but some progress exists', () => {
    const achievements = {
      achievements: [
        makeAchievement({ progress: 40, current_value: 4, threshold: 10 }),
        makeAchievement({ id: 'week_warrior', progress: 0 }),
      ],
      total_count: 2,
      unlocked_count: 0,
      total_xp_earned: 0,
    };
    renderGrid(makeStoreState({ achievements }));
    expect(screen.getByText('statistics:achievements.emptyState.someProgress')).toBeInTheDocument();
    expect(
      screen.queryByText('statistics:achievements.emptyState.noProgress')
    ).not.toBeInTheDocument();
    // Next Up section is visible
    expect(screen.getByText('statistics:achievements.nextUp.title')).toBeInTheDocument();
    // CTA link still present
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('shows normal state when some achievements are unlocked', () => {
    const achievements = {
      achievements: [
        makeAchievement({
          id: 'first_steps',
          unlocked: true,
          unlocked_at: '2026-03-01T10:00:00Z',
          progress: 100,
        }),
        makeAchievement({ id: 'week_warrior', progress: 50, current_value: 3, threshold: 7 }),
      ],
      total_count: 2,
      unlocked_count: 1,
      total_xp_earned: 50,
    };
    renderGrid(makeStoreState({ achievements }));
    expect(
      screen.queryByText('statistics:achievements.emptyState.someProgress')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('statistics:achievements.emptyState.noProgress')
    ).not.toBeInTheDocument();
    // Recently Unlocked and Next Up headings visible
    expect(screen.getByText('statistics:achievements.recentlyUnlocked.title')).toBeInTheDocument();
    expect(screen.getByText('statistics:achievements.nextUp.title')).toBeInTheDocument();
  });
});
