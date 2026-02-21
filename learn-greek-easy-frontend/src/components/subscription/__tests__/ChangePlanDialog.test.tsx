import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { BillingStatusResponse, PricingPlan } from '@/services/billingAPI';

const mockChangePlan = vi.fn();

vi.mock('@/hooks/useSubscriptionActions', () => ({
  useSubscriptionActions: () => ({
    changePlan: mockChangePlan,
    isChangingPlan: false,
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    isCanceling: false,
    isReactivating: false,
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/components/billing/PricingCard', () => ({
  PricingCard: ({
    plan,
    onSubscribe,
  }: {
    plan: PricingPlan;
    onSubscribe: (plan: PricingPlan) => void;
  }) => <button onClick={() => onSubscribe(plan)}>Subscribe {plan.billing_cycle}</button>,
}));

import { ChangePlanDialog } from '../ChangePlanDialog';

const makePlan = (billingCycle: string): PricingPlan => ({
  billing_cycle: billingCycle,
  price_amount: 999,
  price_formatted: '9.99',
  currency: 'eur',
  interval: 'month',
  interval_count: 1,
  savings_percent: null,
});

const mockBillingStatus: BillingStatusResponse = {
  subscription_status: 'active',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'monthly',
  is_premium: true,
  pricing: [makePlan('monthly'), makePlan('quarterly'), makePlan('semi_annual')],
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: 999,
  current_price_formatted: '9.99',
  current_price_currency: 'eur',
};

describe('ChangePlanDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    billingStatus: mockBillingStatus,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<ChangePlanDialog {...defaultProps} />);
    expect(screen.getByText('Change Plan')).toBeInTheDocument();
  });

  it('shows "no plans" message when pricing is empty', () => {
    const emptyStatus = { ...mockBillingStatus, pricing: [] };
    render(<ChangePlanDialog {...defaultProps} billingStatus={emptyStatus} />);
    expect(screen.getByText('No plans available')).toBeInTheDocument();
  });

  it('renders PricingCards when pricing has entries', () => {
    render(<ChangePlanDialog {...defaultProps} />);
    expect(screen.getByText('Subscribe monthly')).toBeInTheDocument();
    expect(screen.getByText('Subscribe quarterly')).toBeInTheDocument();
    expect(screen.getByText('Subscribe semi_annual')).toBeInTheDocument();
  });

  it('calls changePlan with the selected billing cycle when PricingCard is clicked', async () => {
    mockChangePlan.mockResolvedValue(null);
    render(<ChangePlanDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Subscribe quarterly'));
    await waitFor(() => expect(mockChangePlan).toHaveBeenCalledWith('quarterly'));
  });

  it('calls onSuccess and closes dialog on successful plan change', async () => {
    mockChangePlan.mockResolvedValue(mockBillingStatus);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(
      <ChangePlanDialog {...defaultProps} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    );
    fireEvent.click(screen.getByText('Subscribe quarterly'));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('does not close dialog when changePlan returns null (error case)', async () => {
    mockChangePlan.mockResolvedValue(null);
    const onOpenChange = vi.fn();
    render(<ChangePlanDialog {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Subscribe quarterly'));
    await waitFor(() => expect(mockChangePlan).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
