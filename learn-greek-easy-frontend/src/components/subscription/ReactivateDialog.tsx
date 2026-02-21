import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import { type BillingStatusResponse } from '@/services/billingAPI';

interface ReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingStatus: BillingStatusResponse;
  onSuccess: () => void;
}

export function ReactivateDialog({
  open,
  onOpenChange,
  billingStatus,
  onSuccess,
}: ReactivateDialogProps) {
  const { t } = useTranslation('subscription');
  const { reactivateSubscription, isReactivating } = useSubscriptionActions();

  const formattedDate = billingStatus.current_period_end
    ? format(new Date(billingStatus.current_period_end), 'MMMM d, yyyy')
    : null;

  const handleReactivate = async () => {
    const result = await reactivateSubscription();
    if (result) {
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reactivate.title', 'Reactivate Subscription')}</DialogTitle>
          <DialogDescription>
            {t('reactivate.description', 'Resume your subscription before it expires.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {billingStatus.billing_cycle && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('labels.currentPlan', 'Current Plan')}
              </span>
              <span className="font-medium">
                {t(`cycle.${billingStatus.billing_cycle}`, billingStatus.billing_cycle)}
              </span>
            </div>
          )}
          {billingStatus.current_price_formatted && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('labels.price', 'Price')}</span>
              <span className="font-medium">
                {billingStatus.current_price_currency?.toUpperCase()}{' '}
                {billingStatus.current_price_formatted}
              </span>
            </div>
          )}
          {formattedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('labels.nextBilling', 'Next billing date')}
              </span>
              <span className="font-medium">{formattedDate}</span>
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" disabled={isReactivating} onClick={() => onOpenChange(false)}>
            {t('reactivate.cancel', 'Cancel')}
          </Button>
          <Button variant="default" disabled={isReactivating} onClick={handleReactivate}>
            {t('reactivate.confirm', 'Reactivate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
