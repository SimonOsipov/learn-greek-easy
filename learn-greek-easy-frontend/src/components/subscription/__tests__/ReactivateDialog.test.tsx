import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { BillingStatusResponse } from '@/services/billingAPI';

const mockReactivateSubscription = vi.fn();

vi.mock('@/hooks/useSubscriptionActions', () => ({
  useSubscriptionActions: () => ({
    reactivateSubscription: mockReactivateSubscription,
    isReactivating: false,
    changePlan: vi.fn(),
    cancelSubscription: vi.fn(),
    isChangingPlan: false,
    isCanceling: false,
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import { ReactivateDialog } from '../ReactivateDialog';

const mockBillingStatus: BillingStatusResponse = {
  subscription_status: 'active',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'monthly',
  is_premium: true,
  pricing: [],
  current_period_end: '2026-03-21T00:00:00Z',
  cancel_at_period_end: true,
  current_price_amount: 999,
  current_price_formatted: '9.99',
  current_price_currency: 'eur',
};

describe('ReactivateDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    billingStatus: mockBillingStatus,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with billing info', () => {
    render(<ReactivateDialog {...defaultProps} />);
    expect(screen.getByText('Reactivate Subscription')).toBeInTheDocument();
  });

  it('shows price when current_price_formatted available', () => {
    render(<ReactivateDialog {...defaultProps} />);
    expect(screen.getByText(/9.99/)).toBeInTheDocument();
  });

  it('calls reactivateSubscription on confirm button click', async () => {
    mockReactivateSubscription.mockResolvedValue(null);
    render(<ReactivateDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(mockReactivateSubscription).toHaveBeenCalledTimes(1));
  });

  it('closes dialog and calls onSuccess on successful reactivation', async () => {
    mockReactivateSubscription.mockResolvedValue(mockBillingStatus);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(
      <ReactivateDialog {...defaultProps} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('clicking Cancel closes dialog', () => {
    const onOpenChange = vi.fn();
    render(<ReactivateDialog {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
