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

export const billingAPI = {
  createCheckoutSession: async (billingCycle: BillingCycle): Promise<CheckoutSessionResponse> => {
    return api.post<CheckoutSessionResponse>('/api/v1/billing/checkout/premium', {
      billing_cycle: billingCycle,
    });
  },

  verifyCheckout: async (sessionId: string): Promise<CheckoutVerifyResponse> => {
    return api.post<CheckoutVerifyResponse>('/api/v1/billing/checkout/verify', {
      session_id: sessionId,
    });
  },
};
