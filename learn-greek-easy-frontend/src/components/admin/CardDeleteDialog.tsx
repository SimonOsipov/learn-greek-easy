// src/components/admin/CardDeleteDialog.tsx

import React from 'react';

import { AlertTriangle, Trash2 } from 'lucide-react';
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

interface CardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemPreview: string;
  itemType: 'card' | 'question';
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Strong warning confirmation dialog for HARD DELETE of cards/questions.
 *
 * Features:
 * - Destructive/warning visual style with red accents
 * - Clearly states permanent deletion
 * - Lists all data that will be deleted
 * - Shows item preview for verification
 * - "This action cannot be undone" warning
 * - Red destructive delete button
 */
export const CardDeleteDialog: React.FC<CardDeleteDialogProps> = ({
  open,
  onOpenChange,
  itemPreview,
  itemType,
  onConfirm,
  isDeleting,
}) => {
  const { t } = useTranslation('admin');

  const titleKey = itemType === 'card' ? 'cardDelete.title' : 'cardDelete.titleQuestion';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="card-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t(titleKey)}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Item Preview */}
              {itemPreview && (
                <div className="max-w-full overflow-hidden rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="whitespace-pre-wrap break-words text-sm font-medium text-foreground">
                    {itemPreview}
                  </p>
                </div>
              )}

              {/* Warning Message */}
              <div className="space-y-3">
                <p className="font-medium text-destructive">{t('cardDelete.warning')}</p>

                {/* Data Loss List */}
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>{t('cardDelete.dataLost1')}</li>
                  <li>{t('cardDelete.dataLost2')}</li>
                  <li>{t('cardDelete.dataLost3')}</li>
                </ul>

                {/* Final Warning */}
                <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t('cardDelete.irreversible')}
                  </p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="card-delete-cancel"
          >
            {t('cardDelete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="gap-2"
            data-testid="card-delete-confirm"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? t('cardDelete.deleting') : t('cardDelete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
