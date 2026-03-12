import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAdminDialogStore } from '@/stores/adminDialogStore';

interface DialogCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogCreateModal({ open, onOpenChange }: DialogCreateModalProps) {
  const { t } = useTranslation('admin');
  const { createDialog, isCreating } = useAdminDialogStore();
  const [jsonValue, setJsonValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setJsonValue('');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    try {
      JSON.parse(jsonValue);
    } catch (e) {
      setError(t('listeningDialogs.create.errors.invalidJson', { message: (e as Error).message }));
      return;
    }
    try {
      await createDialog(jsonValue);
      toast({ title: t('listeningDialogs.create.success') });
      handleOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        String(err);
      setError(t('listeningDialogs.create.errors.createFailed', { message }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="dialog-create-modal">
        <DialogHeader>
          <DialogTitle>{t('listeningDialogs.create.title')}</DialogTitle>
          <DialogDescription>{t('listeningDialogs.create.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          data-testid="dialog-json-textarea"
          value={jsonValue}
          onChange={(e) => {
            setJsonValue(e.target.value);
            setError(null);
          }}
          placeholder={t('listeningDialogs.create.placeholder')}
          className="min-h-[300px] font-mono"
          disabled={isCreating}
        />
        {error && (
          <Alert variant="destructive" data-testid="dialog-json-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
            data-testid="dialog-create-cancel"
          >
            {t('listeningDialogs.create.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !jsonValue.trim()}
            data-testid="dialog-create-submit"
          >
            {isCreating
              ? t('listeningDialogs.create.creating')
              : t('listeningDialogs.create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
