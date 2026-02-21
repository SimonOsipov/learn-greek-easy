import { useTranslation } from 'react-i18next';

import { PricingCard } from '@/components/billing/PricingCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import {
  type BillingCycle,
  type BillingStatusResponse,
  type PricingPlan,
} from '@/services/billingAPI';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingStatus: BillingStatusResponse;
  onSuccess: () => void;
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  billingStatus,
  onSuccess,
}: ChangePlanDialogProps) {
  const { t } = useTranslation('subscription');
  const { t: tUpgrade } = useTranslation('upgrade');
  const { changePlan, isChangingPlan } = useSubscriptionActions();

  const handleSubscribe = async (plan: PricingPlan) => {
    const result = await changePlan(plan.billing_cycle as BillingCycle);
    if (result) {
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('changePlan.title', 'Change Plan')}</DialogTitle>
          <DialogDescription>
            {t('changePlan.description', 'Switch to a different billing cycle')}
          </DialogDescription>
        </DialogHeader>
        {billingStatus.pricing.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            {t('errors.loadFailed', 'No plans available')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
            {billingStatus.pricing.map((plan) => {
              const isCurrentPlan = plan.billing_cycle === billingStatus.billing_cycle;
              return (
                <PricingCard
                  key={plan.billing_cycle}
                  plan={plan}
                  isLoading={isChangingPlan}
                  onSubscribe={handleSubscribe}
                  t={tUpgrade}
                  isCurrentPlan={isCurrentPlan}
                  buttonLabel={isCurrentPlan ? t('labels.currentPlan', 'Current Plan') : undefined}
                />
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
