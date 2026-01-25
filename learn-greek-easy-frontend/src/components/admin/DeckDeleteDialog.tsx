// src/components/admin/DeckDeleteDialog.tsx

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
import type { UnifiedDeckItem } from '@/services/adminAPI';

interface DeckDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: UnifiedDeckItem | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for deleting (soft-delete) a deck.
 *
 * Displays:
 * - Warning icon and title
 * - Deck name and type being deleted
 * - Description of soft-delete behavior (hidden, not permanently deleted)
 * - Impact list (hidden from users, progress preserved, can reactivate)
 * - Cancel and Delete buttons
 */
export const DeckDeleteDialog: React.FC<DeckDeleteDialogProps> = ({
  open,
  onOpenChange,
  deck,
  onConfirm,
  isDeleting,
}) => {
  const { t } = useTranslation('admin');

  if (!deck) return null;

  // Get display name for the deck
  const deckName = typeof deck.name === 'string' ? deck.name : deck.name.en;
  const deckType = t(`deckTypes.${deck.type}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="deck-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('deckDelete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="font-medium text-foreground">
                {t('deckDelete.deckInfo', { name: deckName, type: deckType })}
              </p>
              <p>{t('deckDelete.explanation')}</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>{t('deckDelete.impact.hidden')}</li>
                <li>{t('deckDelete.impact.progressPreserved')}</li>
                <li>{t('deckDelete.impact.canReactivate')}</li>
              </ul>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                {t('deckDelete.warning')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="deck-delete-cancel"
          >
            {t('deckDelete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="deck-delete-confirm"
          >
            {isDeleting ? t('deckDelete.deleting') : t('deckDelete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
