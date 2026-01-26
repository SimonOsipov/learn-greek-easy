// src/components/admin/news/NewsItemDeleteDialog.tsx

/**
 * News Item Delete Dialog Component
 *
 * Alert dialog for confirming news item deletion.
 * Features:
 * - AlertTriangle warning icon
 * - Item title displayed
 * - Clear warning about permanent deletion (hard delete)
 * - Cancel/Delete buttons with loading state
 */

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
import { toast } from '@/hooks/use-toast';
import type { NewsItemResponse } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

interface NewsItemDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: NewsItemResponse | null;
}

/**
 * NewsItemDeleteDialog component
 */
export const NewsItemDeleteDialog: React.FC<NewsItemDeleteDialogProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const { t } = useTranslation('admin');
  const { deleteNewsItem, isDeleting } = useAdminNewsStore();

  const handleDelete = async () => {
    if (!item) return;

    try {
      await deleteNewsItem(item.id);
      toast({
        title: t('news.delete.success'),
      });
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('news.delete.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="news-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('news.delete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="font-medium text-foreground">{item.title_el}</p>
              <p className="text-sm text-muted-foreground">{t('news.delete.warning')}</p>
              <p className="text-sm font-medium text-destructive">
                {t('news.delete.irreversible')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="news-delete-cancel"
          >
            {t('news.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="news-delete-confirm"
          >
            {isDeleting ? t('news.delete.deleting') : t('news.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
