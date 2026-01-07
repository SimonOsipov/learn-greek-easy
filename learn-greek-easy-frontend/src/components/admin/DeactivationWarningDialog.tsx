// src/components/admin/DeactivationWarningDialog.tsx

import React from 'react';

import { AlertTriangle } from 'lucide-react';
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

interface DeactivationWarningDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deckName: string;
}

/**
 * Warning dialog shown when admin attempts to deactivate a deck.
 *
 * Displays:
 * - Amber warning icon and title
 * - Deck name being deactivated
 * - Impact explanation (deck hidden, progress preserved, reversible)
 * - Cancel ("Keep Active") and Confirm ("Deactivate") buttons
 */
export const DeactivationWarningDialog: React.FC<DeactivationWarningDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  deckName,
}) => {
  const { t } = useTranslation('admin');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="deactivation-warning-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {t('deckEdit.deactivateWarning.title', 'Deactivate Deck?')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="font-medium text-foreground">
                {t('deckEdit.deactivateWarning.deckName', {
                  name: deckName,
                  defaultValue: `You are about to deactivate "${deckName}"`,
                })}
              </p>
              <p>
                {t(
                  'deckEdit.deactivateWarning.description',
                  'Deactivating this deck will have the following effects:'
                )}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>
                  {t(
                    'deckEdit.deactivateWarning.impact.hidden',
                    'The deck will be hidden from all learners'
                  )}
                </li>
                <li>
                  {t(
                    'deckEdit.deactivateWarning.impact.progressPreserved',
                    'All user progress will be preserved'
                  )}
                </li>
                <li>
                  {t(
                    'deckEdit.deactivateWarning.impact.reversible',
                    'You can reactivate the deck at any time'
                  )}
                </li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" onClick={onCancel} data-testid="deactivation-cancel">
            {t('deckEdit.deactivateWarning.cancel', 'Keep Active')}
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700"
            onClick={onConfirm}
            data-testid="deactivation-confirm"
          >
            {t('deckEdit.deactivateWarning.confirm', 'Deactivate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
