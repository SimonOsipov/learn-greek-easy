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
import { tDynamic } from '@/i18n/tDynamic';
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
          <DialogTitle>{t('reactivate.title')}</DialogTitle>
          <DialogDescription>{t('reactivate.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {billingStatus.billing_cycle && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('labels.currentPlan')}</span>
              <span className="font-medium">
                {tDynamic(t, `cycle.${billingStatus.billing_cycle}`)}
              </span>
            </div>
          )}
          {billingStatus.current_price_formatted && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('labels.price')}</span>
              <span className="font-medium">
                {billingStatus.current_price_currency?.toUpperCase()}{' '}
                {billingStatus.current_price_formatted}
              </span>
            </div>
          )}
          {formattedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('labels.nextBilling')}</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" disabled={isReactivating} onClick={() => onOpenChange(false)}>
            {t('reactivate.cancel')}
          </Button>
          <Button variant="default" disabled={isReactivating} onClick={handleReactivate}>
            {t('reactivate.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
