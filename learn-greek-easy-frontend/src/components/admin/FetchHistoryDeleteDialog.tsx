// src/components/admin/FetchHistoryDeleteDialog.tsx

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
import type { FetchHistoryItem } from '@/services/adminAPI';

interface FetchHistoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FetchHistoryItem | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for deleting a fetch history record.
 *
 * Displays:
 * - Warning icon and title
 * - Description of the action
 * - Impact list (HTML deleted, questions preserved, cannot undo)
 * - Cancel and Delete buttons
 */
export const FetchHistoryDeleteDialog: React.FC<FetchHistoryDeleteDialogProps> = ({
  open,
  onOpenChange,
  item,
  onConfirm,
  isDeleting,
}) => {
  const { t } = useTranslation('admin');

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="history-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('sources.history.delete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p>{t('sources.history.delete.description')}</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>{t('sources.history.delete.impact.htmlDeleted')}</li>
                <li>{t('sources.history.delete.impact.questionsPreserved')}</li>
                <li>{t('sources.history.delete.impact.cannotUndo')}</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="history-delete-cancel"
          >
            {t('sources.history.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="history-delete-confirm"
          >
            {isDeleting
              ? t('sources.history.delete.deleting')
              : t('sources.history.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
