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

interface TourCompletionDialogProps {
  open: boolean;
  onStartLearning: () => void;
  onDismiss: () => void;
}

export function TourCompletionDialog({
  open,
  onStartLearning,
  onDismiss,
}: TourCompletionDialogProps) {
  const { t } = useTranslation('common');
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tour.complete.title')}</DialogTitle>
          <DialogDescription>{t('tour.complete.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onDismiss}>
            {t('tour.complete.maybeLater')}
          </Button>
          <Button className="btn-primary" onClick={onStartLearning}>
            {t('tour.complete.startLearning')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
