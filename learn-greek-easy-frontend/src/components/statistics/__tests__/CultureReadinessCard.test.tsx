import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/lib/test-utils';
import { CultureReadinessCard } from '../CultureReadinessCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseCultureReadiness = vi.fn();
vi.mock('@/hooks/useCultureReadiness', () => ({
  useCultureReadiness: () => mockUseCultureReadiness(),
}));

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseData = {
  readiness_percentage: 72,
  verdict: 'ready' as const,
  questions_learned: 152,
  questions_total: 550,
  accuracy_percentage: 78.5,
  total_answers: 340,
  categories: [],
  motivation: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CultureReadinessCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders percentage, verdict text, questions counter, and accuracy', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
      error: null,
    });
    const { container } = render(<CultureReadinessCard />);
    expect(container.textContent).toContain('72');
    expect(container.textContent).toContain('152');
    expect(container.textContent).toContain('550');
    expect(container.textContent).toContain('78.5');
  });

  it('applies correct verdict color classes for all 4 verdicts', () => {
    const verdicts = [
      { verdict: 'not_ready', colorClass: 'text-red-500' },
      { verdict: 'getting_there', colorClass: 'text-orange-500' },
      { verdict: 'ready', colorClass: 'text-green-500' },
      { verdict: 'thoroughly_prepared', colorClass: 'text-emerald-500' },
    ] as const;

    for (const { verdict, colorClass } of verdicts) {
      mockUseCultureReadiness.mockReturnValue({
        data: { ...baseData, verdict },
        isLoading: false,
        isError: false,
        error: null,
      });
      const { container, unmount } = render(<CultureReadinessCard />);
      const coloredEl = container.querySelector(`.${colorClass}`);
      expect(coloredEl, `Expected color class ${colorClass} for verdict ${verdict}`).not.toBeNull();
      unmount();
    }
  });

  it('shows N/A when accuracy_percentage is null', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: { ...baseData, accuracy_percentage: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<CultureReadinessCard />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows loading skeletons with animate-pulse while loading', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });
    const { container } = render(<CultureReadinessCard />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state message when isError is true', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
    });
    const { container } = render(<CultureReadinessCard />);
    expect(container.textContent?.length).toBeGreaterThan(0);
    // Error state renders the card header title
    expect(container.textContent).toContain('Culture Exam Readiness');
  });

  it('renders zero state with 0%, Not Ready verdict, 0/0 questions, and N/A accuracy', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: {
        ...baseData,
        readiness_percentage: 0,
        verdict: 'not_ready',
        questions_learned: 0,
        questions_total: 0,
        accuracy_percentage: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    const { container } = render(<CultureReadinessCard />);
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('Not Ready');
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
