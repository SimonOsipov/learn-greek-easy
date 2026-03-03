import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TourDismissDialogProps {
  open: boolean;
  onSkip: () => void;
  onContinue: () => void;
}

export function TourDismissDialog({ open, onSkip, onContinue }: TourDismissDialogProps) {
  const { t } = useTranslation('common');
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onContinue()}>
      <AlertDialogContent className="z-[10001]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('tour.dismiss.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('tour.dismiss.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinue}>{t('tour.dismiss.continue')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onSkip}
          >
            {t('tour.dismiss.skip')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
