// src/components/admin/news/NewsItemDeleteDialog.tsx

/**
 * News Item Delete Dialog Component
 *
 * Alert dialog for confirming news item deletion.
 * Features:
 * - AlertTriangle warning icon
 * - Item title displayed (in current language with en fallback)
 * - Clear warning about permanent deletion (hard delete)
 * - Cancel/Delete buttons with loading state
 * - Cancel is first / auto-focused (AC #3: destructive NOT auto-focused)
 */

import React from 'react';

import { AlertTriangle } from 'lucide-react';
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
import { buttonVariants } from '@/components/ui/button';
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
  const { t, i18n } = useTranslation('admin');
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

  const lang = i18n.language;
  const titleInCurrentLang =
    lang === 'el' ? item.title_el : lang === 'ru' ? item.title_ru : item.title_en;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md" data-testid="news-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('news.delete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('news.delete.warning')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-1 pb-2">
          <p className="font-medium text-foreground">{titleInCurrentLang}</p>
          <p className="text-sm font-medium text-destructive">{t('news.delete.irreversible')}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="news-delete-cancel"
          >
            {t('news.delete.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isDeleting}
            data-testid="news-delete-confirm"
          >
            {isDeleting ? t('news.delete.deleting') : t('news.delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
