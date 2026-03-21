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
import { useAdminSituationStore } from '@/stores/adminSituationStore';
interface SituationDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  situation: { id: string; scenario_el: string } | null;
}

export function SituationDeleteDialog({
  open,
  onOpenChange,
  situation,
}: SituationDeleteDialogProps) {
  const { t } = useTranslation('admin');
  const { deleteSituation, isDeleting } = useAdminSituationStore();

  const handleDelete = async () => {
    if (!situation) return;
    try {
      await deleteSituation(situation.id);
      toast({ title: t('situations.delete.success') });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('situations.delete.error');
      toast({ title: t('situations.delete.error'), description: message, variant: 'destructive' });
    }
  };

  if (!situation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="situation-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('situations.delete.title')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="font-medium text-foreground">{situation.scenario_el}</p>
              <p className="text-sm text-muted-foreground">{t('situations.delete.description')}</p>
              <p className="text-sm font-medium text-destructive">
                {t('situations.delete.warning')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="situation-delete-cancel"
          >
            {t('situations.delete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="situation-delete-confirm-btn"
          >
            {isDeleting ? t('situations.delete.deleting') : t('situations.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
