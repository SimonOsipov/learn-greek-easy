import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as billingAPIModule from '@/services/billingAPI';
import type { BillingStatusResponse } from '@/services/billingAPI';

// Use vi.fn() directly in factories to avoid hoisting issues
vi.mock('@/services/billingAPI', () => ({
  billingAPI: {
    changePlan: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const mockToastFn = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToastFn(...args),
}));

const mockReportAPIErrorFn = vi.fn();
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: (...args: unknown[]) => mockReportAPIErrorFn(...args),
}));

const mockTrackFn = vi.fn();
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: (...args: unknown[]) => mockTrackFn(...args) }),
}));

import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';

const mockBillingStatus: BillingStatusResponse = {
  subscription_status: 'active',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'monthly',
  is_premium: true,
  pricing: [],
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: 999,
  current_price_formatted: '9.99',
  current_price_currency: 'eur',
};

describe('useSubscriptionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('changePlan', () => {
    it('calls billingAPI.changePlan, tracks event, shows success toast, returns result', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'changePlan').mockResolvedValue(mockBillingStatus);

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null = null;
      await act(async () => {
        returnValue = await result.current.changePlan('quarterly');
      });

      expect(billingAPIModule.billingAPI.changePlan).toHaveBeenCalledWith('quarterly');
      expect(mockTrackFn).toHaveBeenCalledWith('plan_change_confirmed', {
        billing_cycle: 'quarterly',
      });
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.any(String) })
      );
      expect(returnValue).toEqual(mockBillingStatus);
    });

    it('shows destructive toast, calls reportAPIError, returns null on error', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'changePlan').mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null | undefined = undefined;
      await act(async () => {
        returnValue = await result.current.changePlan('quarterly');
      });

      expect(mockReportAPIErrorFn).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'changePlan',
      });
      expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      expect(returnValue).toBeNull();
    });

    it('is a no-op (returns null) if already loading', async () => {
      let resolve: (v: BillingStatusResponse) => void;
      const pending = new Promise<BillingStatusResponse>((r) => {
        resolve = r;
      });
      vi.spyOn(billingAPIModule.billingAPI, 'changePlan').mockReturnValue(pending);

      const { result } = renderHook(() => useSubscriptionActions());

      // Start first call (don't await)
      act(() => {
        void result.current.changePlan('quarterly');
      });

      // Second call immediately — should be no-op
      let secondResult: BillingStatusResponse | null | undefined;
      await act(async () => {
        secondResult = await result.current.changePlan('monthly');
      });

      expect(secondResult).toBeNull();
      expect(billingAPIModule.billingAPI.changePlan).toHaveBeenCalledTimes(1);

      // Resolve first call to clean up
      resolve!(mockBillingStatus);
    });
  });

  describe('cancelSubscription', () => {
    it('calls billingAPI.cancelSubscription, tracks event, shows toast, returns result', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'cancelSubscription').mockResolvedValue(
        mockBillingStatus
      );

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null = null;
      await act(async () => {
        returnValue = await result.current.cancelSubscription();
      });

      expect(billingAPIModule.billingAPI.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(mockTrackFn).toHaveBeenCalledWith('cancel_confirmed');
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.any(String) })
      );
      expect(returnValue).toEqual(mockBillingStatus);
    });

    it('shows destructive toast and returns null on error', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'cancelSubscription').mockRejectedValue(
        new Error('API error')
      );

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null | undefined;
      await act(async () => {
        returnValue = await result.current.cancelSubscription();
      });

      expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      expect(returnValue).toBeNull();
    });
  });

  describe('reactivateSubscription', () => {
    it('calls billingAPI.reactivateSubscription, tracks event, shows toast, returns result', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'reactivateSubscription').mockResolvedValue(
        mockBillingStatus
      );

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null = null;
      await act(async () => {
        returnValue = await result.current.reactivateSubscription();
      });

      expect(billingAPIModule.billingAPI.reactivateSubscription).toHaveBeenCalledTimes(1);
      expect(mockTrackFn).toHaveBeenCalledWith('reactivate_confirmed');
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.any(String) })
      );
      expect(returnValue).toEqual(mockBillingStatus);
    });

    it('shows destructive toast and returns null on error', async () => {
      vi.spyOn(billingAPIModule.billingAPI, 'reactivateSubscription').mockRejectedValue(
        new Error('API error')
      );

      const { result } = renderHook(() => useSubscriptionActions());

      let returnValue: BillingStatusResponse | null | undefined;
      await act(async () => {
        returnValue = await result.current.reactivateSubscription();
      });

      expect(mockToastFn).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      expect(returnValue).toBeNull();
    });
  });
});
