import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { render } from '@/lib/test-utils';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { MotivationalMessageCard } from '../MotivationalMessageCard';

// Minimal render without Toaster for null-check tests
const renderMinimal = () =>
  rtlRender(
    <I18nextProvider i18n={i18n}>
      <MotivationalMessageCard />
    </I18nextProvider>
  );

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

const motivationImproving = {
  message_key: 'cultureMotivation.improving.notReady.1',
  params: { previousPercent: 30, currentPercent: 45, delta: 15 },
  delta_direction: 'improving' as const,
  delta_percentage: 15,
};

const motivationNewUser = {
  message_key: 'cultureMotivation.newUser.1',
  params: {},
  delta_direction: 'new_user' as const,
  delta_percentage: 0,
};

const baseData = {
  readiness_percentage: 45,
  verdict: 'getting_there' as const,
  questions_learned: 50,
  questions_total: 550,
  accuracy_percentage: 60,
  total_answers: 100,
  categories: [],
  motivation: motivationImproving,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MotivationalMessageCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the motivational message when data and motivation are present', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
    });
    render(<MotivationalMessageCard />);
    // The i18n translation key renders to the actual English message
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(0);
  });

  it('returns null when motivation is null', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: { ...baseData, motivation: null },
      isLoading: false,
      isError: false,
    });
    const { container } = renderMinimal();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when isLoading is true', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });
    const { container } = renderMinimal();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when isError is true', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });
    const { container } = renderMinimal();
    expect(container.firstChild).toBeNull();
  });

  it('renders with role="status" and aria-live="polite" for accessibility', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
    });
    render(<MotivationalMessageCard />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
  });

  it('renders with amber background class', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
    });
    const { container } = render(<MotivationalMessageCard />);
    const amberEl = container.querySelector('[class*="bg-amber"]');
    expect(amberEl).not.toBeNull();
  });

  it('renders new_user motivation message correctly', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: { ...baseData, motivation: motivationNewUser },
      isLoading: false,
      isError: false,
    });
    render(<MotivationalMessageCard />);
    const statusEl = screen.getByRole('status');
    // The new_user message should render some text content
    expect(statusEl.textContent?.length).toBeGreaterThan(0);
    // Should contain something from the new user message key
    expect(statusEl.textContent).toContain('culture');
  });

  it('renders within dark mode compatible container (dark class present in className)', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
    });
    const { container } = render(<MotivationalMessageCard />);
    const card = container.querySelector('[class*="dark:bg"]');
    expect(card).not.toBeNull();
  });
});
