import { useState } from 'react';

import { AlertTriangle, ArrowLeft, Loader2, Check } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface ResetProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetProgressDialog({ open, onOpenChange }: ResetProgressDialogProps) {
  const { t } = useTranslation('settings');
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleClose = () => {
    if (isResetting) return;
    setStep(1);
    setConfirmText('');
    setIsResetting(false);
    onOpenChange(false);
  };

  const handleReset = async () => {
    setIsResetting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Clear progress data from localStorage
      localStorage.removeItem('learn-greek-easy:review-data');
      localStorage.removeItem('learn-greek-easy:analytics');
      localStorage.removeItem('learn-greek-easy:deck-progress');

      toast({
        title: t('danger.resetProgress.success'),
        description: t('danger.resetProgress.successDescription'),
      });

      handleClose();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: t('danger.resetProgress.error'),
        description: error instanceof Error ? error.message : t('common:error.tryAgain'),
        variant: 'destructive',
      });
      setIsResetting(false);
    }
  };

  const isConfirmValid = confirmText === 'RESET';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  {t('danger.resetProgress.dialogTitle')}
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  {t('danger.resetProgress.willDelete')}
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>{t('danger.resetProgress.deleteItems.deckProgress')}</li>
                  <li>{t('danger.resetProgress.deleteItems.statistics')}</li>
                  <li>{t('danger.resetProgress.deleteItems.spacedRepetition')}</li>
                  <li>{t('danger.resetProgress.deleteItems.streaks')}</li>
                </ul>
                <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
                  <Check className="mr-2 inline-block h-4 w-4" />
                  {t('danger.preserved')}
                </p>
                <p className="font-medium text-red-600">{t('danger.cannotBeUndone')}</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('danger.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                {t('danger.continue')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  {t('danger.resetProgress.finalConfirmation')}
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-4 pt-2">
                <p className="text-foreground">
                  <Trans
                    i18nKey="danger.resetProgress.typeToConfirm"
                    ns="settings"
                    components={{ strong: <span className="font-mono font-bold" /> }}
                  />
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirm-reset">
                    {t('danger.resetProgress.confirmationText')}
                  </Label>
                  <Input
                    id="confirm-reset"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={t('danger.resetProgress.typeReset')}
                    className="font-mono"
                    disabled={isResetting}
                  />
                  {confirmText && !isConfirmValid && (
                    <p className="text-sm text-red-600">
                      {t('danger.resetProgress.mustTypeReset')}
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isResetting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('danger.back')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!isConfirmValid || isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('danger.resetProgress.resetting')}
                  </>
                ) : (
                  t('danger.resetProgress.resetMyProgress')
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
