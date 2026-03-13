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
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { JSON_PLACEHOLDER, validateNewsItemJson } from './newsJsonValidation';

interface NewsItemCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewsItemCreateModal({ open, onOpenChange }: NewsItemCreateModalProps) {
  const { t } = useTranslation('admin');
  const { createNewsItem, isCreating } = useAdminNewsStore();
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
    const validation = validateNewsItemJson(jsonValue);

    if (!validation.valid) {
      setError(t(validation.error.messageKey));
      return;
    }

    try {
      await createNewsItem(validation.data);
      toast({
        title: t('news.create.success'),
      });
      handleOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Check for duplicate URL (409)
      if (errorMessage.includes('409') || errorMessage.toLowerCase().includes('duplicate')) {
        setError(t('news.create.duplicateUrl'));
      }
      // Check for image download failure (400)
      else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('image')) {
        setError(t('news.create.imageDownloadFailed'));
      } else {
        setError(errorMessage);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="news-create-modal">
        <DialogHeader>
          <DialogTitle>{t('news.create.title')}</DialogTitle>
          <DialogDescription>{t('news.create.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          data-testid="news-json-input"
          value={jsonValue}
          onChange={(e) => {
            setJsonValue(e.target.value);
            setError(null);
          }}
          placeholder={JSON_PLACEHOLDER}
          className="min-h-[200px] font-mono text-sm"
          disabled={isCreating}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            {t('news.edit.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !jsonValue.trim()}
            data-testid="news-submit-button"
          >
            {isCreating ? t('news.create.submitting') : t('news.create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
