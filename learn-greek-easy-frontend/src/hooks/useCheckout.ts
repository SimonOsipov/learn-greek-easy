import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI, type BillingCycle } from '@/services/billingAPI';

import { toast } from './use-toast';

export function useCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation('common');

  const startCheckout = async (billingCycle: BillingCycle, promoCode?: string) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { checkout_url } = await billingAPI.createCheckoutSession(billingCycle, promoCode);
      // Navigate to Stripe — browser leaves page, button stays disabled
      window.location.href = checkout_url;
    } catch (error) {
      setIsLoading(false);
      reportAPIError(error, { operation: 'createCheckoutSession' });
      toast({
        title: t('checkout.error.title', 'Checkout failed'),
        description: t('checkout.error.description', 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  return { startCheckout, isLoading };
}
