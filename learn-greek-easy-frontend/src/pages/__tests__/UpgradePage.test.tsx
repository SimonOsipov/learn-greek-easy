import { describe, it, expect, vi, beforeEach } from 'vitest';

import userEvent from '@testing-library/user-event';

import { render, screen } from '@/lib/test-utils';
import { UpgradePage } from '../UpgradePage';

// Hoisted mocks — must be hoisted to be referenced inside vi.mock factories
const mockGetBillingStatus = vi.hoisted(() => vi.fn());
const mockStartCheckout = vi.hoisted(() => vi.fn());
const mockIsLoading = vi.hoisted(() => ({ value: false }));
const mockTrack = vi.hoisted(() => vi.fn());
const mockSearchParamsGet = vi.hoisted(() => vi.fn());

vi.mock('@/services/billingAPI', () => ({
  billingAPI: {
    getBillingStatus: mockGetBillingStatus,
  },
}));

vi.mock('@/hooks/useCheckout', () => ({
  useCheckout: () => ({
    startCheckout: mockStartCheckout,
    isLoading: mockIsLoading.value,
  }),
}));

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({
    track: mockTrack,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [{ get: mockSearchParamsGet }, vi.fn()],
  };
});

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (options && 'days' in options) return `${key}_${options.days}`;
        if (options && 'percent' in options) return `${key}_${options.percent}`;
        return key;
      },
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: null, isAuthenticated: false })),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

const FREE_USER_STATUS = {
  subscription_status: 'none',
  subscription_tier: 'free',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: null,
  is_premium: false,
  pricing: [
    {
      billing_cycle: 'monthly',
      price_amount: 2900,
      price_formatted: '29.00',
      currency: 'eur',
      interval: 'month',
      interval_count: 1,
      savings_percent: null,
    },
    {
      billing_cycle: 'quarterly',
      price_amount: 7500,
      price_formatted: '75.00',
      currency: 'eur',
      interval: 'month',
      interval_count: 3,
      savings_percent: 14,
    },
    {
      billing_cycle: 'semi_annual',
      price_amount: 13800,
      price_formatted: '138.00',
      currency: 'eur',
      interval: 'month',
      interval_count: 6,
      savings_percent: 21,
    },
  ],
};

describe('UpgradePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBillingStatus.mockResolvedValue(FREE_USER_STATUS);
    mockSearchParamsGet.mockReturnValue(null);
    mockIsLoading.value = false;
  });

  it('renders loading state', () => {
    mockGetBillingStatus.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<UpgradePage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    mockGetBillingStatus.mockRejectedValue(new Error('Network error'));
    render(<UpgradePage />);
    expect(await screen.findByText('error.title')).toBeInTheDocument();
    expect(screen.getByText('error.retry')).toBeInTheDocument();
  });

  it('renders feature comparison table', async () => {
    render(<UpgradePage />);
    expect(await screen.findByText('comparison.freeColumn')).toBeInTheDocument();
    expect(screen.getByText('comparison.premiumColumn')).toBeInTheDocument();
  });

  it('renders pricing cards', async () => {
    render(<UpgradePage />);
    expect(await screen.findByText('€29.00')).toBeInTheDocument();
    expect(screen.getByText('€75.00')).toBeInTheDocument();
    expect(screen.getByText('€138.00')).toBeInTheDocument();
  });

  it('semi_annual shows most popular badge', async () => {
    render(<UpgradePage />);
    expect(await screen.findByText('pricing.mostPopular')).toBeInTheDocument();
  });

  it('shows savings percentage', async () => {
    render(<UpgradePage />);
    expect(await screen.findByText('pricing.save_14')).toBeInTheDocument();
    expect(screen.getByText('pricing.save_21')).toBeInTheDocument();
  });

  it('subscribe calls startCheckout', async () => {
    render(<UpgradePage />);
    const buttons = await screen.findAllByText('pricing.subscribe');
    await userEvent.click(buttons[0]); // first = monthly
    expect(mockStartCheckout).toHaveBeenCalledWith('monthly', undefined);
  });

  it('free user sees no banner', async () => {
    render(<UpgradePage />);
    await screen.findByText('page.title');
    expect(screen.queryByText(/banner\./)).not.toBeInTheDocument();
  });

  it('trialing user sees trial banner', async () => {
    mockGetBillingStatus.mockResolvedValue({
      ...FREE_USER_STATUS,
      subscription_status: 'trialing',
      trial_days_remaining: 5,
      is_premium: false,
    });
    render(<UpgradePage />);
    expect(await screen.findByText('banner.trialActive_5')).toBeInTheDocument();
  });

  it('expired trial shows warning banner', async () => {
    mockGetBillingStatus.mockResolvedValue({
      ...FREE_USER_STATUS,
      subscription_status: 'trialing',
      trial_days_remaining: 0,
      is_premium: false,
    });
    render(<UpgradePage />);
    expect(await screen.findByText('banner.trialExpired')).toBeInTheDocument();
  });

  it('premium user sees already premium card', async () => {
    mockGetBillingStatus.mockResolvedValue({
      ...FREE_USER_STATUS,
      subscription_status: 'active',
      subscription_tier: 'premium',
      is_premium: true,
      pricing: [],
    });
    render(<UpgradePage />);
    expect(await screen.findByText('alreadyPremium.title')).toBeInTheDocument();
    expect(screen.queryByText('pricing.subscribe')).not.toBeInTheDocument();
  });

  it('empty pricing shows unavailable message', async () => {
    mockGetBillingStatus.mockResolvedValue({
      ...FREE_USER_STATUS,
      pricing: [],
    });
    render(<UpgradePage />);
    expect(await screen.findByText('pricing.unavailable')).toBeInTheDocument();
  });

  it('reads promo from URL', async () => {
    mockSearchParamsGet.mockReturnValue('PROMO123');
    render(<UpgradePage />);
    const buttons = await screen.findAllByText('pricing.subscribe');
    await userEvent.click(buttons[0]);
    expect(mockStartCheckout).toHaveBeenCalledWith('monthly', 'PROMO123');
  });

  it('tracks upgrade_page_viewed', async () => {
    render(<UpgradePage />);
    await screen.findByText('page.title');
    expect(mockTrack).toHaveBeenCalledWith(
      'upgrade_page_viewed',
      expect.objectContaining({
        user_status: 'none',
        has_promo: false,
        pricing_count: 3,
      })
    );
  });

  it('tracks billing_cycle_selected on subscribe', async () => {
    render(<UpgradePage />);
    const buttons = await screen.findAllByText('pricing.subscribe');
    await userEvent.click(buttons[0]);
    expect(mockTrack).toHaveBeenCalledWith(
      'billing_cycle_selected',
      expect.objectContaining({
        billing_cycle: 'monthly',
        price_amount: 2900,
        currency: 'eur',
      })
    );
  });

  it('retry button refetches data', async () => {
    mockGetBillingStatus.mockRejectedValueOnce(new Error('fail'));
    render(<UpgradePage />);
    const retryButton = await screen.findByText('error.retry');

    mockGetBillingStatus.mockResolvedValue(FREE_USER_STATUS);
    await userEvent.click(retryButton);

    expect(await screen.findByText('page.title')).toBeInTheDocument();
    expect(mockGetBillingStatus).toHaveBeenCalledTimes(2);
  });
});
