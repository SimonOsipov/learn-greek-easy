/**
 * SubscriptionSection Component Tests
 *
 * Verifies all subscription states, PostHog tracking, date formatting,
 * disabled button patterns, and navigation behavior.
 *
 * NOTE: i18n is initialized with real English translations in test-setup.ts,
 * so assertions use actual English strings from profile.json / upgrade.json.
 */

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

import { SubscriptionSection } from '../SubscriptionSection';
import type { BillingStatusResponse } from '@/services/billingAPI';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTrack = vi.fn();
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetBillingStatus = vi.fn();
vi.mock('@/services/billingAPI', () => ({
  billingAPI: {
    getBillingStatus: () => mockGetBillingStatus(),
  },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// Tooltip in Radix requires a Provider.  Provide a minimal inline mock so
// tests do not need a full Radix context provider.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <span>{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_STATUS: BillingStatusResponse = {
  subscription_status: 'free',
  subscription_tier: 'free',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: null,
  is_premium: false,
  pricing: [],
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: null,
  current_price_formatted: null,
  current_price_currency: null,
};

const FREE_STATUS: BillingStatusResponse = { ...BASE_STATUS };

const TRIALING_STATUS: BillingStatusResponse = {
  ...BASE_STATUS,
  subscription_status: 'trialing',
  subscription_tier: 'free',
  is_premium: true,
  trial_end_date: '2026-03-15T00:00:00Z',
  trial_days_remaining: 22,
};

const TRIAL_EXPIRED_STATUS: BillingStatusResponse = {
  ...TRIALING_STATUS,
  trial_days_remaining: 0,
};

const ACTIVE_STATUS: BillingStatusResponse = {
  ...BASE_STATUS,
  subscription_status: 'active',
  subscription_tier: 'premium',
  is_premium: true,
  billing_cycle: 'monthly',
  current_period_end: '2026-03-21T00:00:00Z',
  current_price_amount: 999,
  current_price_formatted: '9.99',
  current_price_currency: 'usd',
};

const ACTIVE_NO_PRICE_STATUS: BillingStatusResponse = {
  ...ACTIVE_STATUS,
  current_price_amount: null,
  current_price_formatted: null,
  current_price_currency: null,
};

// Cancelled via subscription_status field
const CANCELLED_VIA_STATUS: BillingStatusResponse = {
  ...BASE_STATUS,
  subscription_status: 'canceled',
  subscription_tier: 'premium',
  is_premium: true,
  billing_cycle: 'monthly',
  current_period_end: '2026-03-21T00:00:00Z',
  current_price_amount: 999,
  current_price_formatted: '9.99',
  current_price_currency: 'usd',
};

// Cancelled via cancel_at_period_end flag (active status but will cancel)
const CANCELLED_VIA_PERIOD_END: BillingStatusResponse = {
  ...ACTIVE_STATUS,
  cancel_at_period_end: true,
};

const PAST_DUE_STATUS: BillingStatusResponse = {
  ...ACTIVE_STATUS,
  subscription_status: 'past_due',
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderComponent() {
  return render(
    <BrowserRouter>
      <SubscriptionSection />
    </BrowserRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubscriptionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-9: Loading & Error states
  // -------------------------------------------------------------------------

  describe('loading state (AC-9)', () => {
    it('shows an animated spinner while fetching', async () => {
      // Never resolves during this test — keeps loading state visible
      mockGetBillingStatus.mockReturnValue(new Promise(() => {}));
      renderComponent();
      // Loader2 renders an SVG with animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });

    it('does not show plan content while loading', () => {
      mockGetBillingStatus.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
    });
  });

  describe('error state (AC-9)', () => {
    it('shows error message when fetch fails', async () => {
      mockGetBillingStatus.mockRejectedValue(new Error('network error'));
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Failed to load subscription status')).toBeInTheDocument();
      });
    });

    it('shows a retry button in the error state', async () => {
      mockGetBillingStatus.mockRejectedValue(new Error('network error'));
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });

    it('re-fetches when the retry button is clicked', async () => {
      mockGetBillingStatus
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(FREE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => {
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(2);
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Free state
  // -------------------------------------------------------------------------

  describe('free state (AC-3)', () => {
    beforeEach(() => {
      mockGetBillingStatus.mockResolvedValue(FREE_STATUS);
    });

    it('displays the Free plan badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Free')).toBeInTheDocument();
      });
    });

    it('renders an enabled Subscribe Now button', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Subscribe Now' });
        expect(btn).toBeInTheDocument();
        expect(btn).not.toBeDisabled();
      });
    });

    it('navigates to /upgrade when Subscribe Now is clicked', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Subscribe Now' })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: 'Subscribe Now' }));
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });

    it('does not show billing details section', async () => {
      renderComponent();
      await waitFor(() => {
        // Wait for load to finish (Free badge visible)
        expect(screen.getByText('Free')).toBeInTheDocument();
      });
      expect(screen.queryByText('Billing details')).not.toBeInTheDocument();
    });

    it('does not show manage subscription or reactivate buttons', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Free')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Manage Subscription' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Trialing state
  // -------------------------------------------------------------------------

  describe('trialing state (AC-4)', () => {
    beforeEach(() => {
      mockGetBillingStatus.mockResolvedValue(TRIALING_STATUS);
    });

    it('displays the Free Trial plan badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Free Trial')).toBeInTheDocument();
      });
    });

    it('shows trial ends label in billing details', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Trial ends')).toBeInTheDocument();
      });
    });

    it('shows a formatted trial end date with relative distance', async () => {
      renderComponent();
      await waitFor(() => {
        // formatDate produces "Month D, YYYY (in X days)" — just check it contains the year
        const trialEndCell = screen.getByText(/2026/);
        expect(trialEndCell).toBeInTheDocument();
      });
    });

    it('renders an enabled Subscribe Now button', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Subscribe Now' });
        expect(btn).not.toBeDisabled();
      });
    });

    it('navigates to /upgrade when Subscribe Now is clicked', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Subscribe Now' })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: 'Subscribe Now' }));
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });
  });

  describe('trialing state — trial expired (AC-4)', () => {
    it('shows trial expired message when trial_days_remaining === 0', async () => {
      mockGetBillingStatus.mockResolvedValue(TRIAL_EXPIRED_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your free trial has expired')).toBeInTheDocument();
      });
    });

    it('does not show trial end date row when trial has expired', async () => {
      mockGetBillingStatus.mockResolvedValue(TRIAL_EXPIRED_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your free trial has expired')).toBeInTheDocument();
      });
      expect(screen.queryByText('Trial ends')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Active premium state
  // -------------------------------------------------------------------------

  describe('active premium state (AC-5)', () => {
    beforeEach(() => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_STATUS);
    });

    it('displays the Premium badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
      });
    });

    it('renders a Crown icon inside the Premium badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
      });
      const badge = screen.getByText('Premium').closest('span');
      expect(badge?.querySelector('svg')).not.toBeNull();
    });

    it('shows billing cycle label and value', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Billing cycle')).toBeInTheDocument();
        expect(screen.getByText('Monthly')).toBeInTheDocument();
      });
    });

    it('shows price line when current_price_amount is not null', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Price')).toBeInTheDocument();
      });
    });

    it('shows next renewal label', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Next renewal')).toBeInTheDocument();
      });
    });

    it('renders a disabled Manage Subscription button', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Manage Subscription' });
        expect(btn).toBeDisabled();
      });
    });

    it('wraps disabled Manage Subscription button in a span (AC-15)', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Manage Subscription' });
        // Parent should be a span (for Radix Tooltip compatibility)
        expect(btn.closest('span')).not.toBeNull();
      });
    });

    it('shows coming soon tooltip text', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
        expect(screen.getByText('Coming soon')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-8: Price line conditional on current_price_amount
  // -------------------------------------------------------------------------

  describe('active premium state — null price (AC-8)', () => {
    it('omits price line when current_price_amount is null', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_NO_PRICE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Billing cycle')).toBeInTheDocument();
      });
      expect(screen.queryByText('Price')).not.toBeInTheDocument();
    });

    it('still shows billing cycle and renewal date without price', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_NO_PRICE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Billing cycle')).toBeInTheDocument();
        expect(screen.getByText('Next renewal')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Cancelled state
  // -------------------------------------------------------------------------

  describe('cancelled state — via subscription_status=canceled (AC-6)', () => {
    beforeEach(() => {
      mockGetBillingStatus.mockResolvedValue(CANCELLED_VIA_STATUS);
    });

    it('displays the Premium (Cancelled) badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium (Cancelled)')).toBeInTheDocument();
      });
    });

    it('renders a Crown icon inside the cancelled badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium (Cancelled)')).toBeInTheDocument();
      });
      const badge = screen.getByText('Premium (Cancelled)').closest('span');
      expect(badge?.querySelector('svg')).not.toBeNull();
    });

    it('shows access ends label (not next renewal)', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Access ends')).toBeInTheDocument();
      });
      expect(screen.queryByText('Next renewal')).not.toBeInTheDocument();
    });

    it('shows features you will lose section', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText("Features you'll lose")).toBeInTheDocument();
      });
    });

    it('renders a disabled Reactivate button wrapped in a span (AC-15)', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Reactivate' });
        expect(btn).toBeDisabled();
        expect(btn.closest('span')).not.toBeNull();
      });
    });

    it('does not show manage subscription button in cancelled state', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium (Cancelled)')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Manage Subscription' })).not.toBeInTheDocument();
    });
  });

  describe('cancelled state — via cancel_at_period_end=true (AC-6)', () => {
    it('treats active subscription with cancel_at_period_end=true as cancelled', async () => {
      mockGetBillingStatus.mockResolvedValue(CANCELLED_VIA_PERIOD_END);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium (Cancelled)')).toBeInTheDocument();
      });
    });

    it('shows Reactivate (not Manage Subscription) for cancel_at_period_end', async () => {
      mockGetBillingStatus.mockResolvedValue(CANCELLED_VIA_PERIOD_END);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reactivate' })).toBeDisabled();
      });
      expect(screen.queryByRole('button', { name: 'Manage Subscription' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-7: Past due state
  // -------------------------------------------------------------------------

  describe('past due state (AC-7)', () => {
    beforeEach(() => {
      mockGetBillingStatus.mockResolvedValue(PAST_DUE_STATUS);
    });

    it('displays a payment warning banner', async () => {
      renderComponent();
      await waitFor(() => {
        expect(
          screen.getByText('Your payment is overdue. Please update your payment method.')
        ).toBeInTheDocument();
      });
    });

    it('displays the Premium badge with Crown icon', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
      });
      const badge = screen.getByText('Premium').closest('span');
      expect(badge?.querySelector('svg')).not.toBeNull();
    });

    it('shows billing details (cycle, price, renewal)', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Billing cycle')).toBeInTheDocument();
        expect(screen.getByText('Price')).toBeInTheDocument();
        expect(screen.getByText('Next renewal')).toBeInTheDocument();
      });
    });

    it('renders a disabled Manage Subscription button', async () => {
      renderComponent();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Manage Subscription' });
        expect(btn).toBeDisabled();
      });
    });

    it('does not show past due banner in non-past-due states', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Your payment is overdue. Please update your payment method.')
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-12 & AC-13: PostHog tracking
  // -------------------------------------------------------------------------

  describe('PostHog tracking (AC-12, AC-13)', () => {
    it('fires subscription_tab_viewed with all required props on successful load', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith('subscription_tab_viewed', {
          subscription_status: 'active',
          subscription_tier: 'premium',
          is_premium: true,
          cancel_at_period_end: false,
          billing_cycle: 'monthly',
          has_price_data: true,
        });
      });
    });

    it('sets has_price_data=false when current_price_amount is null', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_NO_PRICE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith(
          'subscription_tab_viewed',
          expect.objectContaining({ has_price_data: false })
        );
      });
    });

    it('does not fire subscription_tab_viewed when fetch fails', async () => {
      mockGetBillingStatus.mockRejectedValue(new Error('fail'));
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Failed to load subscription status')).toBeInTheDocument();
      });
      expect(mockTrack).not.toHaveBeenCalledWith('subscription_tab_viewed', expect.anything());
    });

    it('fires subscription_action_clicked with action=subscribe_now in free state', async () => {
      mockGetBillingStatus.mockResolvedValue(FREE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Subscribe Now' })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: 'Subscribe Now' }));
      expect(mockTrack).toHaveBeenCalledWith('subscription_action_clicked', {
        action: 'subscribe_now',
        subscription_status: 'free',
        is_enabled: true,
      });
    });

    it('fires subscription_action_clicked with action=subscribe_now in trialing state', async () => {
      mockGetBillingStatus.mockResolvedValue(TRIALING_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Subscribe Now' })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: 'Subscribe Now' }));
      expect(mockTrack).toHaveBeenCalledWith('subscription_action_clicked', {
        action: 'subscribe_now',
        subscription_status: 'trialing',
        is_enabled: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: getSubscriptionState priority logic
  // -------------------------------------------------------------------------

  describe('getSubscriptionState priority logic (AC-4, AC-6)', () => {
    it('treats canceled status as cancelled (reactivate shown, not manage)', async () => {
      mockGetBillingStatus.mockResolvedValue(CANCELLED_VIA_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Manage Subscription' })).not.toBeInTheDocument();
    });

    it('treats cancel_at_period_end=true as cancelled even when status=active', async () => {
      mockGetBillingStatus.mockResolvedValue(CANCELLED_VIA_PERIOD_END);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
      });
    });

    it('treats past_due separately from cancelled (manage shown, not reactivate)', async () => {
      mockGetBillingStatus.mockResolvedValue(PAST_DUE_STATUS);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Manage Subscription' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Data fetch cancellation flag pattern
  // -------------------------------------------------------------------------

  describe('cancellation flag pattern (AC-6 / data fetching)', () => {
    it('does not update state or throw after component unmounts mid-fetch', async () => {
      let resolvePromise!: (value: BillingStatusResponse) => void;
      mockGetBillingStatus.mockReturnValue(
        new Promise<BillingStatusResponse>((resolve) => {
          resolvePromise = resolve;
        })
      );
      const { unmount } = renderComponent();
      unmount();
      // Resolving the promise after unmount should not cause any state-update errors
      resolvePromise(FREE_STATUS);
      await Promise.resolve();
      // Test passes if no error is thrown
    });
  });

  // -------------------------------------------------------------------------
  // AC-14: Date formatting
  // -------------------------------------------------------------------------

  describe('date formatting (AC-14)', () => {
    it('renders trial end date with absolute and relative parts', async () => {
      mockGetBillingStatus.mockResolvedValue(TRIALING_STATUS);
      renderComponent();
      await waitFor(() => {
        // format() produces "March 15, 2026"
        // formatDistanceToNow() adds "(in N days)" — the exact count depends on test date
        const dateEl = screen.getByText(/March 15, 2026/);
        expect(dateEl).toBeInTheDocument();
        // Must also contain a parenthetical for the relative part
        expect(dateEl.textContent).toMatch(/\(.+\)/);
      });
    });

    it('renders renewal date with absolute and relative parts', async () => {
      mockGetBillingStatus.mockResolvedValue(ACTIVE_STATUS);
      renderComponent();
      await waitFor(() => {
        const dateEl = screen.getByText(/March 21, 2026/);
        expect(dateEl).toBeInTheDocument();
        expect(dateEl.textContent).toMatch(/\(.+\)/);
      });
    });
  });
});
