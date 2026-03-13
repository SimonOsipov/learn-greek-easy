import { useState } from 'react';

import { Loader2 } from 'lucide-react';
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
import { getApiErrorMessage } from '@/lib/apiErrorUtils';
import { useAdminChangelogStore, selectAdminChangelogIsSaving } from '@/stores/adminChangelogStore';

import { validateChangelogJson, JSON_PLACEHOLDER } from './changelogJsonValidation';

interface ChangelogCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangelogCreateModal({ open, onOpenChange }: ChangelogCreateModalProps) {
  const { t } = useTranslation('admin');
  const { createEntry } = useAdminChangelogStore();
  const isSaving = useAdminChangelogStore(selectAdminChangelogIsSaving);
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
    const validation = validateChangelogJson(jsonValue);

    if (!validation.valid) {
      const errorParams = validation.error.fields
        ? { fields: validation.error.fields.join(', ') }
        : undefined;
      setError(t(validation.error.messageKey, errorParams));
      return;
    }

    try {
      await createEntry(validation.data);
      toast({ title: t('changelog.toast.created') });
      handleOpenChange(false);
    } catch (err) {
      const apiErrorMessage = getApiErrorMessage(err);
      setError(apiErrorMessage ?? t('changelog.toast.createError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="changelog-create-modal">
        <DialogHeader>
          <DialogTitle>{t('changelog.create.title')}</DialogTitle>
          <DialogDescription>{t('changelog.create.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          data-testid="changelog-json-input"
          value={jsonValue}
          onChange={(e) => {
            setJsonValue(e.target.value);
            setError(null);
          }}
          placeholder={JSON_PLACEHOLDER}
          className="min-h-[200px] font-mono text-sm"
          disabled={isSaving}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {t('changelog.edit.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !jsonValue.trim()}
            data-testid="changelog-submit-button"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('changelog.create.submitting')}
              </>
            ) : (
              t('changelog.create.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
