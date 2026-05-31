import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/lib/test-utils';
import { RetentionWidget } from '../RetentionWidget';
import type { AnalyticsDashboardData, RetentionRate } from '@/types/analytics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAnalytics = vi.fn();
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => mockUseAnalytics(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal stub of AnalyticsDashboardData. Only `retention` is exercised by
 * the component — the rest can be empty/zero stubs.
 */
const makeData = (retention: RetentionRate[]): AnalyticsDashboardData =>
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
    wordStatus: {} as AnalyticsDashboardData['wordStatus'],
    retention,
    recentActivity: [],
  }) as AnalyticsDashboardData;

const makeRetention = (interval: number, value: number): RetentionRate => ({
  interval,
  intervalLabel: `${interval} days`,
  cardsReviewedAtInterval: 100,
  cardsRemembered: value,
  retention: value,
  calculatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RetentionWidget', () => {
  beforeEach(() => vi.clearAllMocks());

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('renders skeleton when isLoading prop is true', () => {
    mockUseAnalytics.mockReturnValue({ data: null, loading: false });
    const { container } = render(<RetentionWidget isLoading />);
    // Skeleton renders as an animated pulse element
    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).not.toBeNull();
    // No percentage text while loading
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('renders skeleton when hook loading is true', () => {
    mockUseAnalytics.mockReturnValue({ data: null, loading: true });
    const { container } = render(<RetentionWidget />);
    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // calculateRetentionRate — 7-day primary path
  // -------------------------------------------------------------------------

  it('uses interval=7 retention value directly when present', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(1, 90), makeRetention(7, 82), makeRetention(30, 70)]),
      loading: false,
    });
    render(<RetentionWidget />);
    // Should show 82%, not average of 90/82/70 (=81)
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('shows 7-day value even when other intervals are present with higher averages', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(1, 95), makeRetention(7, 60), makeRetention(30, 85)]),
      loading: false,
    });
    render(<RetentionWidget />);
    // interval=7 → 60, not average (80)
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // calculateRetentionRate — fallback to average when no 7-day entry
  // -------------------------------------------------------------------------

  it('falls back to rounded average of all intervals when no interval=7 entry', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(1, 90), makeRetention(14, 70), makeRetention(30, 60)]),
      loading: false,
    });
    render(<RetentionWidget />);
    // Average = (90 + 70 + 60) / 3 = 73.33 → Math.round → 73
    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('falls back to average with a single non-7 interval', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(1, 85)]),
      loading: false,
    });
    render(<RetentionWidget />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // calculateRetentionRate — null when empty / non-numeric
  // -------------------------------------------------------------------------

  it('shows N/A when retention array is empty', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([]),
      loading: false,
    });
    render(<RetentionWidget />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('shows N/A when data is null', () => {
    mockUseAnalytics.mockReturnValue({ data: null, loading: false });
    render(<RetentionWidget />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows N/A when all retention entries have non-numeric values', () => {
    // Construct entries with non-numeric retention field
    const badEntries = [
      { ...makeRetention(7, 0), retention: 'bad' as unknown as number },
      { ...makeRetention(1, 0), retention: null as unknown as number },
    ];
    mockUseAnalytics.mockReturnValue({
      data: makeData(badEntries),
      loading: false,
    });
    render(<RetentionWidget />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('skips non-numeric entries in fallback average calculation', () => {
    const entries = [
      { ...makeRetention(1, 0), retention: 'bad' as unknown as number },
      makeRetention(14, 80),
    ];
    mockUseAnalytics.mockReturnValue({
      data: makeData(entries),
      loading: false,
    });
    render(<RetentionWidget />);
    // Only numeric entry is 80 → average = 80
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Color thresholds
  // -------------------------------------------------------------------------

  it('applies success (green) color classes when retention rate is exactly 80', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 80)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    // text-success class on the percentage element
    const successEl = container.querySelector('.text-success');
    expect(successEl).not.toBeNull();
    expect(successEl?.textContent).toContain('80%');
  });

  it('applies success (green) color classes when retention rate is above 80', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 95)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    const successEl = container.querySelector('.text-success');
    expect(successEl).not.toBeNull();
    expect(successEl?.textContent).toContain('95%');
  });

  it('applies warning (yellow) color classes when retention rate is exactly 79', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 79)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    const warningEl = container.querySelector('.text-warning');
    expect(warningEl).not.toBeNull();
    expect(warningEl?.textContent).toContain('79%');
    expect(container.querySelector('.text-success')).toBeNull();
  });

  it('applies warning (yellow) color classes when retention rate is exactly 60', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 60)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    const warningEl = container.querySelector('.text-warning');
    expect(warningEl).not.toBeNull();
    expect(warningEl?.textContent).toContain('60%');
  });

  it('applies danger (red) color classes when retention rate is exactly 59', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 59)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    const dangerEl = container.querySelector('.text-danger');
    expect(dangerEl).not.toBeNull();
    expect(dangerEl?.textContent).toContain('59%');
    expect(container.querySelector('.text-success')).toBeNull();
    expect(container.querySelector('.text-warning')).toBeNull();
  });

  it('applies danger (red) color classes when retention rate is 0', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 0)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    expect(container.querySelector('.text-danger')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Muted color when N/A (no data)
  // -------------------------------------------------------------------------

  it('applies muted color classes when retention data is unavailable', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    const mutedEl = container.querySelector('.text-muted-foreground');
    expect(mutedEl).not.toBeNull();
    // No colored threshold classes on bold display element
    expect(container.querySelector('.text-success')).toBeNull();
    expect(container.querySelector('.text-warning')).toBeNull();
    expect(container.querySelector('.text-danger')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TrendingUp icon only appears when rate >= 75
  // -------------------------------------------------------------------------

  it('shows TrendingUp icon when retention rate is 75 or above', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 75)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    // TrendingUp is an SVG icon rendered as an aria-hidden svg
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    // Brain icon + TrendingUp icon = 2
    expect(svgs.length).toBe(2);
  });

  it('does not show TrendingUp icon when retention rate is below 75', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 74)]),
      loading: false,
    });
    const { container } = render(<RetentionWidget />);
    // Only the Brain icon
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Subtext
  // -------------------------------------------------------------------------

  it('shows "% remembered after 7+ days" subtext when data is present', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([makeRetention(7, 85)]),
      loading: false,
    });
    render(<RetentionWidget />);
    expect(screen.getByText('% remembered after 7+ days')).toBeInTheDocument();
  });

  it('shows "Insufficient data" subtext when no data is available', () => {
    mockUseAnalytics.mockReturnValue({
      data: makeData([]),
      loading: false,
    });
    render(<RetentionWidget />);
    expect(screen.getByText('Insufficient data')).toBeInTheDocument();
  });
});
