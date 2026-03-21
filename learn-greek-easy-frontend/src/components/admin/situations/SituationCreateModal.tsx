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
import { useAdminSituationStore } from '@/stores/adminSituationStore';

import { SITUATION_JSON_PLACEHOLDER, validateSituationJson } from './SituationCreateValidation';

interface SituationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SituationCreateModal({ open, onOpenChange }: SituationCreateModalProps) {
  const { t } = useTranslation('admin');
  const [jsonValue, setJsonValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { createSituation, isCreating } = useAdminSituationStore();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setJsonValue('');
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const validation = validateSituationJson(jsonValue);
    if (!validation.valid) {
      setError(t(validation.error.messageKey));
      return;
    }
    try {
      await createSituation(validation.data);
      toast({ title: t('situations.create.success') });
      handleOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('situations.create.error');
      setError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="situation-create-modal">
        <DialogHeader>
          <DialogTitle>{t('situations.create.title')}</DialogTitle>
          <DialogDescription>{t('situations.create.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          data-testid="situation-json-input"
          value={jsonValue}
          onChange={(e) => {
            setJsonValue(e.target.value);
            setError(null);
          }}
          placeholder={SITUATION_JSON_PLACEHOLDER}
          className="min-h-[160px] font-mono text-sm"
          disabled={isCreating}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            {t('situations.create.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !jsonValue.trim()}
            data-testid="situation-submit-button"
          >
            {isCreating ? t('situations.create.submitting') : t('situations.create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
