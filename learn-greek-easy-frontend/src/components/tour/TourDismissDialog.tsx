import { useEffect, useRef } from 'react';

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
  const skipRequestedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const overlay = document.querySelector('.driver-overlay') as HTMLElement | null;
    const popover = document.querySelector('.driver-popover') as HTMLElement | null;
    if (overlay) overlay.style.pointerEvents = 'none';
    if (popover) popover.style.pointerEvents = 'none';
    return () => {
      if (overlay) overlay.style.pointerEvents = '';
      if (popover) popover.style.pointerEvents = '';
    };
  }, [open]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !skipRequestedRef.current) onContinue();
        skipRequestedRef.current = false;
      }}
    >
      <AlertDialogContent className="z-[1000000001]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('tour.dismiss.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('tour.dismiss.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('tour.dismiss.continue')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              skipRequestedRef.current = true;
              onSkip();
            }}
          >
            {t('tour.dismiss.skip')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
