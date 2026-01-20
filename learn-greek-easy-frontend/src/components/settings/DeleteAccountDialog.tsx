import { useState, useEffect } from 'react';

import { AlertTriangle, Loader2 } from 'lucide-react';
import posthog from 'posthog-js';
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
import { useAuth } from '@/hooks/useAuth';
import { usersAPI } from '@/services/usersAPI';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useTranslation('settings');
  const { logout } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the localized confirmation word
  const confirmationWord = t('danger.deleteAccount.confirmationWord');

  // Track modal opened event
  useEffect(() => {
    if (open) {
      posthog.capture('delete_account_modal_opened');
    }
  }, [open]);

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmationInput('');
    setError(null);
    onOpenChange(false);
  };

  const handleCancel = () => {
    posthog.capture('delete_account_cancelled');
    handleClose();
  };

  const handleDelete = async () => {
    // Double-check confirmation matches
    if (confirmationInput !== confirmationWord) {
      setError(t('danger.deleteAccount.mustTypeDelete'));
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await usersAPI.deleteAccount();

      posthog.capture('delete_account_confirmed');

      // Logout handles redirect to '/'
      await logout();
    } catch (err) {
      setError(t('danger.deleteAccount.error'));
      setIsDeleting(false);
    }
  };

  const isConfirmDisabled = confirmationInput !== confirmationWord || isDeleting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="delete-account-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle className="text-red-600" data-testid="delete-account-title">
              {t('danger.deleteAccount.dialogTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="space-y-3 pt-2">
            <p className="font-medium text-foreground">{t('danger.deleteAccount.willDelete')}</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>{t('danger.deleteAccount.deleteItems.account')}</li>
              <li>{t('danger.deleteAccount.deleteItems.progress')}</li>
              <li>{t('danger.deleteAccount.deleteItems.statistics')}</li>
              <li>{t('danger.deleteAccount.deleteItems.deckData')}</li>
              <li>{t('danger.deleteAccount.deleteItems.settings')}</li>
            </ul>
            <p className="font-medium text-red-600">{t('danger.deleteAccount.permanentWarning')}</p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              <Trans
                i18nKey="danger.deleteAccount.typeToConfirm"
                ns="settings"
                components={{ strong: <strong className="font-bold" /> }}
              />
            </Label>
            <Input
              id="confirm-delete"
              type="text"
              value={confirmationInput}
              onChange={(e) => {
                setConfirmationInput(e.target.value);
                setError(null);
              }}
              placeholder={t('danger.deleteAccount.typeDelete')}
              disabled={isDeleting}
              data-testid="delete-confirmation-input"
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <div
            className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400"
            data-testid="delete-error"
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
            data-testid="delete-cancel-button"
          >
            {t('danger.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isConfirmDisabled}
            data-testid="delete-confirm-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('danger.deleteAccount.deleting')}
              </>
            ) : (
              t('danger.deleteAccount.deleteMyAccount')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
