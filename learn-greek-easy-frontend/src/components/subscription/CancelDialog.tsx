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

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEndDate: string | null;
  onSuccess: () => void;
}

export function CancelDialog({ open, onOpenChange, periodEndDate, onSuccess }: CancelDialogProps) {
  const { t } = useTranslation('subscription');
  const { cancelSubscription, isCanceling } = useSubscriptionActions();

  const formattedDate = periodEndDate ? format(new Date(periodEndDate), 'MMMM d, yyyy') : null;

  const handleCancel = async () => {
    const result = await cancelSubscription();
    if (result) {
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cancel.title', 'Cancel Subscription')}</DialogTitle>
          <DialogDescription>
            {formattedDate
              ? t(
                  'cancel.description',
                  'Your subscription will remain active until the end of the current billing period.'
                ) + ` ${t('labels.canceledAt', 'Access until')}: ${formattedDate}.`
              : t(
                  'cancel.description',
                  'Your subscription will remain active until the end of the current billing period.'
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" disabled={isCanceling} onClick={() => onOpenChange(false)}>
            {t('cancel.dismiss', 'Keep Subscription')}
          </Button>
          <Button variant="destructive" disabled={isCanceling} onClick={handleCancel}>
            {t('cancel.confirm', 'Yes, Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
