import { useState, useEffect } from 'react';

import { AlertTriangle, Loader2, Check } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usersAPI } from '@/services/usersAPI';

interface ResetProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetProgressDialog({ open, onOpenChange }: ResetProgressDialogProps) {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track modal opened event
  useEffect(() => {
    if (open) {
      posthog.capture('reset_progress_modal_opened');
    }
  }, [open]);

  const handleClose = () => {
    if (isResetting) return;
    setError(null);
    onOpenChange(false);
  };

  const handleCancel = () => {
    posthog.capture('reset_progress_cancelled');
    handleClose();
  };

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);

    try {
      await usersAPI.resetProgress();

      posthog.capture('reset_progress_confirmed');

      // Navigate to dashboard on success
      navigate('/dashboard');
    } catch (err) {
      setError(t('danger.resetProgress.error'));
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="reset-progress-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle className="text-red-600" data-testid="reset-progress-title">
              {t('danger.resetProgress.dialogTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="space-y-3 pt-2">
            <p className="font-medium text-foreground">{t('danger.resetProgress.willDelete')}</p>
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

        {error && (
          <div
            className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400"
            data-testid="reset-error"
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isResetting}
            data-testid="reset-cancel-button"
          >
            {t('danger.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={isResetting}
            data-testid="reset-confirm-button"
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
      </DialogContent>
    </Dialog>
  );
}
