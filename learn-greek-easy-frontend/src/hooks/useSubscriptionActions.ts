import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useTrackEvent } from '@/hooks/useTrackEvent';
import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI, type BillingCycle, type BillingStatusResponse } from '@/services/billingAPI';

import { toast } from './use-toast';

export function useSubscriptionActions() {
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const { t } = useTranslation('subscription');
  const { track } = useTrackEvent();

  const changePlan = async (billingCycle: BillingCycle): Promise<BillingStatusResponse | null> => {
    if (isChangingPlan) return null;
    setIsChangingPlan(true);

    try {
      const result = await billingAPI.changePlan(billingCycle);
      track('plan_change_confirmed', { billing_cycle: billingCycle });
      toast({
        title: t('changePlan.success.title', 'Plan updated'),
        description: t('changePlan.success.description', 'Your billing cycle has been updated.'),
      });
      setIsChangingPlan(false);
      return result;
    } catch (error) {
      setIsChangingPlan(false);
      reportAPIError(error, { operation: 'changePlan' });
      toast({
        title: t('changePlan.error.title', 'Plan change failed'),
        description: t('changePlan.error.description', 'Failed to change plan. Please try again.'),
        variant: 'destructive',
      });
      return null;
    }
  };

  const cancelSubscription = async (): Promise<BillingStatusResponse | null> => {
    if (isCanceling) return null;
    setIsCanceling(true);

    try {
      const result = await billingAPI.cancelSubscription();
      track('cancel_confirmed');
      toast({
        title: t('cancel.success.title', 'Subscription canceled'),
        description: t(
          'cancel.success.description',
          "You'll retain premium access until your current billing period ends."
        ),
      });
      setIsCanceling(false);
      return result;
    } catch (error) {
      setIsCanceling(false);
      reportAPIError(error, { operation: 'cancelSubscription' });
      toast({
        title: t('cancel.error.title', 'Cancellation failed'),
        description: t(
          'cancel.error.description',
          'Failed to cancel your subscription. Please try again.'
        ),
        variant: 'destructive',
      });
      return null;
    }
  };

  const reactivateSubscription = async (): Promise<BillingStatusResponse | null> => {
    if (isReactivating) return null;
    setIsReactivating(true);

    try {
      const result = await billingAPI.reactivateSubscription();
      track('reactivate_confirmed');
      toast({
        title: t('reactivate.success.title', 'Subscription reactivated'),
        description: t(
          'reactivate.success.description',
          'Your premium subscription has been reactivated.'
        ),
      });
      setIsReactivating(false);
      return result;
    } catch (error) {
      setIsReactivating(false);
      reportAPIError(error, { operation: 'reactivateSubscription' });
      toast({
        title: t('reactivate.error.title', 'Reactivation failed'),
        description: t(
          'reactivate.error.description',
          'Failed to reactivate your subscription. Please try again.'
        ),
        variant: 'destructive',
      });
      return null;
    }
  };

  return {
    changePlan,
    cancelSubscription,
    reactivateSubscription,
    isChangingPlan,
    isCanceling,
    isReactivating,
  };
}
