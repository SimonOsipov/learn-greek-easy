import { act } from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, screen, waitFor } from '@/lib/test-utils';
import { CheckoutSuccessPage } from '../CheckoutSuccessPage';

// Hoisted so they are safe to reference inside vi.mock factories
const mockCheckAuth = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockGetSearchParams = vi.hoisted(() => vi.fn());
const mockVerifyCheckout = vi.hoisted(() => vi.fn());
const mockReportAPIError = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [{ get: mockGetSearchParams }, vi.fn()],
  };
});

vi.mock('@/services/billingAPI', () => ({
  billingAPI: {
    verifyCheckout: (...args: unknown[]) => mockVerifyCheckout(...args),
  },
}));

// useAuthStore must be callable (used as Zustand hook in LanguageProvider)
// AND have getState (used directly in CheckoutSuccessPage)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({ user: null, isAuthenticated: false })),
    {
      getState: () => ({ checkAuth: mockCheckAuth }),
    }
  ),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: (...args: unknown[]) => mockReportAPIError(...args),
}));

describe('CheckoutSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to dashboard when session_id is missing', async () => {
    mockGetSearchParams.mockReturnValue(null);

    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('should call checkAuth on successful verification', async () => {
    mockGetSearchParams.mockReturnValue('cs_test_session_123');
    mockVerifyCheckout.mockResolvedValue({ status: 'activated' });
    mockCheckAuth.mockResolvedValue(undefined);

    await act(async () => {
      render(<CheckoutSuccessPage />);
    });

    await waitFor(() => {
      expect(mockVerifyCheckout).toHaveBeenCalledWith('cs_test_session_123');
      expect(mockCheckAuth).toHaveBeenCalled();
    });
  });

  it('should swallow verification errors silently', async () => {
    mockGetSearchParams.mockReturnValue('cs_test_session_456');
    const testError = new Error('Stripe verify failed');
    mockVerifyCheckout.mockRejectedValue(testError);

    await act(async () => {
      render(<CheckoutSuccessPage />);
    });

    await waitFor(() => {
      expect(mockReportAPIError).toHaveBeenCalledWith(testError, {
        operation: 'verifyCheckout',
        silent: true,
      });
    });

    // No error shown to user — success UI still visible
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
