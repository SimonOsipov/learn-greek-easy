import { api } from './api';

export type BillingCycle = 'monthly' | 'quarterly' | 'semi_annual';

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface CheckoutVerifyResponse {
  status: 'activated' | 'already_active';
  subscription_tier: string;
  billing_cycle: string;
  subscription_status: string;
}

export interface PricingPlan {
  billing_cycle: string;
  price_amount: number;
  price_formatted: string;
  currency: string;
  interval: string;
  interval_count: number;
  savings_percent: number | null;
}

export interface BillingStatusResponse {
  subscription_status: string;
  subscription_tier: string;
  trial_end_date: string | null;
  trial_days_remaining: number | null;
  billing_cycle: string | null;
  is_premium: boolean;
  pricing: PricingPlan[];
  // Subscription period and price fields (BP-10)
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  current_price_amount: number | null;
  current_price_formatted: string | null;
  current_price_currency: string | null;
}

export const billingAPI = {
  createCheckoutSession: async (
    billingCycle: BillingCycle,
    promoCode?: string
  ): Promise<CheckoutSessionResponse> => {
    const body: Record<string, string> = { billing_cycle: billingCycle };
    if (promoCode) {
      body.promo_code = promoCode;
    }
    return api.post<CheckoutSessionResponse>('/api/v1/billing/checkout/premium', body);
  },

  verifyCheckout: async (sessionId: string): Promise<CheckoutVerifyResponse> => {
    return api.post<CheckoutVerifyResponse>('/api/v1/billing/checkout/verify', {
      session_id: sessionId,
    });
  },

  getBillingStatus: async (): Promise<BillingStatusResponse> => {
    return api.get<BillingStatusResponse>('/api/v1/billing/status');
  },
};
