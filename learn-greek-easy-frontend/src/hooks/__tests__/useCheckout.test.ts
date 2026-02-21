/**
 * useCheckout Hook Tests
 * Tests checkout flow hook including promoCode passthrough
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as billingAPIModule from '@/services/billingAPI';

vi.mock('@/services/billingAPI');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/errorReporting', () => ({ reportAPIError: vi.fn() }));

import { useCheckout } from '@/hooks/useCheckout';

describe('useCheckout Hook', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    vi.clearAllMocks();
  });

  it('startCheckout passes promoCode to billingAPI.createCheckoutSession', async () => {
    vi.spyOn(billingAPIModule.billingAPI, 'createCheckoutSession').mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com',
      session_id: 'cs_test',
    });

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.startCheckout('monthly', 'PROMO123');
    });

    expect(billingAPIModule.billingAPI.createCheckoutSession).toHaveBeenCalledWith(
      'monthly',
      'PROMO123'
    );
  });

  it('startCheckout works without promoCode', async () => {
    vi.spyOn(billingAPIModule.billingAPI, 'createCheckoutSession').mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com',
      session_id: 'cs_test',
    });

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.startCheckout('monthly');
    });

    expect(billingAPIModule.billingAPI.createCheckoutSession).toHaveBeenCalledWith(
      'monthly',
      undefined
    );
  });
});
