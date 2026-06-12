// src/components/charts/__tests__/StageDistributionChart.test.tsx
//
// PRACT2-7-02 — RED tests for StageDistributionChart relearning-slice removal
//
// AC-3 (chart side): wordStatus.total === 0 triggers the empty-state gate at
//   line 170 of StageDistributionChart.tsx (data.wordStatus.total === 0).
//
// AC-4: pieData must contain no entry with original === 'relearning'.
//   BUG: the current chart hardcodes a relearning slice and feeds it from
//   wordStatus.relearning. We inject wordStatus.relearning > 0 to force the
//   slice to appear — the test then asserts it is ABSENT, causing a RED
//   failure until the executor removes the relearning entry from the pieData
//   array.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/lib/test-utils';
import { StageDistributionChart } from '../StageDistributionChart';
import type { AnalyticsDashboardData } from '@/types/analytics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAnalytics = vi.fn();
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => mockUseAnalytics(),
}));

/**
 * Capture the data prop handed to recharts <Pie> so we can assert on it
 * without depending on SVG rendering.
 */
interface PieDataItem {
  name: string;
  value: number;
  percent: number;
  original: string;
}
let capturedPieData: PieDataItem[] = [];

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    Pie: ({ data }: { data: PieDataItem[] }) => {
      // Capture the pieData for assertion
      capturedPieData = data ?? [];
      return (
        <div data-testid="pie">
          {(data ?? []).map((item: PieDataItem) => (
            <span key={item.original} data-testid={`pie-slice-${item.original}`}>
              {item.name}
            </span>
          ))}
        </div>
      );
    },
    Cell: () => null,
    Legend: () => null,
    // Tooltip from recharts is used indirectly via ChartTooltip (ui/chart.tsx)
    Tooltip: () => null,
  };
});

// ChartTooltip and ChartTooltipContent are wrappers in @/components/ui/chart
// that render the recharts Tooltip internally — mock at the ui/chart level to
// avoid recharts internal state errors in jsdom.
vi.mock('@/components/ui/chart', async () => {
  const actual =
    await vi.importActual<typeof import('@/components/ui/chart')>('@/components/ui/chart');
  return {
    ...actual,
    ChartTooltip: () => null,
    ChartTooltipContent: () => null,
  };
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Minimal AnalyticsDashboardData stub. Only wordStatus is exercised here.
 */
const makeData = (
  wordStatusOverrides: Partial<AnalyticsDashboardData['wordStatus']>
): AnalyticsDashboardData =>
  ({
    userId: 'u1',
    dateRange: { startDate: new Date(), endDate: new Date(), label: '' },
    fetchedAt: new Date(),
    summary: {
      totalCardsReviewed: 0,
      totalTimeStudied: 0,
      averageAccuracy: 0,
      cardsNewlyMastered: 0,
      cultureQuestionsMastered: 0,
    },
    streak: {} as AnalyticsDashboardData['streak'],
    progressData: [],
    deckStats: [],
    wordStatus: {
      new: 10,
      learning: 5,
      review: 3,
      mastered: 7,
      relearning: 0,
      newPercent: 40,
      learningPercent: 20,
      reviewPercent: 12,
      masteredPercent: 28,
      relearningPercent: 0,
      total: 25,
      deckId: 'all',
      date: new Date(),
      ...wordStatusOverrides,
    },
    retention: [],
    recentActivity: [],
  }) as AnalyticsDashboardData;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  capturedPieData = [];
});

// AC-3 (chart side): when total === 0, the chart renders the empty state gate.
describe('StageDistributionChart empty state (AC-3)', () => {
  it('test_empty_state_when_only_due_nonzero — total=0 shows no-data message', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData({
        new: 0,
        learning: 0,
        review: 0,
        mastered: 0,
        relearning: 0,
        newPercent: 0,
        learningPercent: 0,
        reviewPercent: 0,
        masteredPercent: 0,
        relearningPercent: 0,
        total: 0,
      }),
      loading: false,
      error: null,
    });

    render(<StageDistributionChart />);

    // The empty-state gate at line 170 renders when total === 0.
    // The pie chart should NOT render.
    expect(screen.queryByTestId('pie-chart')).toBeNull();
  });
});

// AC-4: pieData must never include an entry with original === 'relearning'.
//
// The current code hardcodes a relearning entry in the pieData array and only
// hides it via .filter(item => item.value > 0). We inject relearning=3 to
// force it through that filter. The test asserts the entry is ABSENT —
// this fails RED now (the slice IS present) and goes green when the executor
// removes the relearning entry from the pieData array entirely.
describe('StageDistributionChart no-relearning slice (AC-4)', () => {
  it('test_pie_data_has_no_relearning_entry — relearning slice absent even with relearning cards', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData({
        // Inject non-zero relearning so the current filter(value > 0) lets it through.
        relearning: 3,
        relearningPercent: 12,
        // Keep total > 0 so the chart renders (not empty state).
        new: 5,
        learning: 3,
        review: 2,
        mastered: 7,
        newPercent: 29.4,
        learningPercent: 17.6,
        reviewPercent: 11.8,
        masteredPercent: 41.2,
        total: 17,
      }),
      loading: false,
      error: null,
    });

    render(<StageDistributionChart />);

    // After the fix: the relearning slice must NOT appear in pieData.
    // Currently (buggy): capturedPieData will contain an entry with
    // original === 'relearning' → this assertion fails RED.
    const relearningEntry = capturedPieData.find((item) => item.original === 'relearning');
    expect(relearningEntry).toBeUndefined();
  });
});
