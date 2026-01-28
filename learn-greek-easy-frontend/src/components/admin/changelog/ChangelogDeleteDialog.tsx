// src/components/admin/changelog/ChangelogDeleteDialog.tsx

/**
 * Changelog Delete Dialog Component
 *
 * Alert dialog for confirming changelog entry deletion.
 * Features:
 * - AlertTriangle warning icon
 * - Entry title displayed
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
import { useAdminChangelogStore } from '@/stores/adminChangelogStore';
import type { ChangelogEntryAdmin } from '@/types/changelog';

interface ChangelogDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ChangelogEntryAdmin | null;
}

/**
 * ChangelogDeleteDialog component
 */
export const ChangelogDeleteDialog: React.FC<ChangelogDeleteDialogProps> = ({
  open,
  onOpenChange,
  entry,
}) => {
  const { t } = useTranslation('admin');
  const { deleteEntry, isDeleting } = useAdminChangelogStore();

  const handleDelete = async () => {
    if (!entry) return;

    try {
      await deleteEntry(entry.id);
      toast({
        title: t('changelog.delete.success'),
      });
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('changelog.delete.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="changelog-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('changelog.delete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">{t('changelog.delete.warning')}</p>
              <p className="font-medium text-foreground">{entry.title_en}</p>
              <p className="text-sm font-medium text-destructive">
                {t('changelog.delete.irreversible')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="changelog-delete-cancel"
          >
            {t('changelog.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="changelog-delete-confirm"
          >
            {isDeleting ? t('changelog.delete.deleting') : t('changelog.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
