import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCancelSubscription = vi.fn();

vi.mock('@/hooks/useSubscriptionActions', () => ({
  useSubscriptionActions: () => ({
    cancelSubscription: mockCancelSubscription,
    isCanceling: false,
    changePlan: vi.fn(),
    reactivateSubscription: vi.fn(),
    isChangingPlan: false,
    isReactivating: false,
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import { CancelDialog } from '../CancelDialog';

describe('CancelDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    periodEndDate: '2026-03-21T00:00:00Z',
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<CancelDialog {...defaultProps} />);
    expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
  });

  it('shows formatted date in description when periodEndDate provided', () => {
    render(<CancelDialog {...defaultProps} />);
    expect(screen.getByText(/March 21, 2026/)).toBeInTheDocument();
  });

  it('does not show date when periodEndDate is null', () => {
    render(<CancelDialog {...defaultProps} periodEndDate={null} />);
    expect(screen.queryByText(/March/)).not.toBeInTheDocument();
  });

  it('calls cancelSubscription on confirm button click', async () => {
    mockCancelSubscription.mockResolvedValue(null);
    render(<CancelDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));
    await waitFor(() => expect(mockCancelSubscription).toHaveBeenCalledTimes(1));
  });

  it('closes dialog and calls onSuccess on successful cancel', async () => {
    const mockStatus = { subscription_status: 'active' };
    mockCancelSubscription.mockResolvedValue(mockStatus);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(<CancelDialog {...defaultProps} onOpenChange={onOpenChange} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('clicking Keep Subscription closes dialog', () => {
    const onOpenChange = vi.fn();
    render(<CancelDialog {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Subscription' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
