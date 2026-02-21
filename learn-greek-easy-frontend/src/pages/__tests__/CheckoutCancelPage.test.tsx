import { act } from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, waitFor } from '@/lib/test-utils';
import { CheckoutCancelPage } from '../CheckoutCancelPage';

// Hoisted so they are safe to reference inside vi.mock factories
const mockNavigate = vi.hoisted(() => vi.fn());
const mockGetSearchParams = vi.hoisted(() => vi.fn());
const mockCapture = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [{ get: mockGetSearchParams }, vi.fn()],
  };
});

vi.mock('posthog-js', () => ({
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
  },
}));

// Required: LanguageProvider in test-utils render tree calls useAuthStore() as a hook
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: null, isAuthenticated: false })),
}));

describe('CheckoutCancelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fire checkout_abandoned event with billing_cycle when present', async () => {
    mockGetSearchParams.mockReturnValue('monthly');

    await act(async () => {
      render(<CheckoutCancelPage />);
    });

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith('checkout_abandoned', {
        billing_cycle: 'monthly',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade', { replace: true });
    });
  });

  it('should fire checkout_abandoned event without billing_cycle when param absent', async () => {
    mockGetSearchParams.mockReturnValue(null);

    await act(async () => {
      render(<CheckoutCancelPage />);
    });

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith('checkout_abandoned', {});
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade', { replace: true });
    });
  });
});
