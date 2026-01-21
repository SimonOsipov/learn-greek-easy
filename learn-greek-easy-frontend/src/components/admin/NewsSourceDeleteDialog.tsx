// src/components/admin/NewsSourceDeleteDialog.tsx

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
import type { NewsSourceResponse } from '@/services/adminAPI';

interface NewsSourceDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: NewsSourceResponse | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for deleting a news source.
 *
 * Displays:
 * - Warning icon and title
 * - Source name being deleted
 * - Description of what happens (source removed, articles unaffected)
 * - Cancel and Delete buttons
 */
export const NewsSourceDeleteDialog: React.FC<NewsSourceDeleteDialogProps> = ({
  open,
  onOpenChange,
  source,
  onConfirm,
  isDeleting,
}) => {
  const { t } = useTranslation('admin');

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="source-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('sources.delete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="font-medium text-foreground">
                {t('sources.delete.sourceName', { name: source.name })}
              </p>
              <p>{t('sources.delete.description')}</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>{t('sources.delete.impact.removed')}</li>
                <li>{t('sources.delete.impact.articlesUnaffected')}</li>
                <li>{t('sources.delete.impact.cannotUndo')}</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="source-delete-cancel"
          >
            {t('sources.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="source-delete-confirm"
          >
            {isDeleting ? t('sources.delete.deleting') : t('sources.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
