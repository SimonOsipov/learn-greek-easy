// src/components/admin/GenerateNounDialog.tsx

import React, { useEffect, useRef, useState } from 'react';

import { CheckCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidGreekInput } from '@/utils/greekValidation';

export interface GenerateNounDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accepted but unused until NGEN-08-02 wires the API call. */
  deckId: string;
  deckName: string;
}

export const GenerateNounDialog: React.FC<GenerateNounDialogProps> = ({
  open,
  onOpenChange,
  deckName,
  deckId: _deckId,
}) => {
  const { t } = useTranslation('admin');

  const [greekWord, setGreekWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedWord = greekWord.trim();
  const validation = trimmedWord ? isValidGreekInput(trimmedWord) : { valid: false };
  const showWarning = trimmedWord.length > 0 && !validation.valid && !!validation.reason;
  const canSubmit = validation.valid && !isSubmitting && !isSuccess;

  const warningKey =
    validation.reason === 'tooLong' ? 'generateNoun.tooLong' : 'generateNoun.invalidGreek';

  const handleSubmit = () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    submitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      submitTimeoutRef.current = null;
    }, 2000);
  };

  // State reset on close — 200ms delay matches VocabularyCardCreateModal pattern
  useEffect(() => {
    if (!open) {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      const timeout = setTimeout(() => {
        setGreekWord('');
        setIsSubmitting(false);
        setIsSuccess(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]" data-testid="generate-noun-dialog">
        <DialogHeader>
          <DialogTitle>{t('generateNoun.title')}</DialogTitle>
        </DialogHeader>

        {!isSuccess ? (
          <>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('generateNoun.deckLabel')}</Label>
                <p>
                  <span data-testid="generate-noun-deck-name">{deckName}</span>
                </p>
              </div>

              <div className="space-y-1">
                <Input
                  data-testid="generate-noun-input"
                  value={greekWord}
                  onChange={(e) => setGreekWord(e.target.value)}
                  placeholder={t('generateNoun.inputPlaceholder')}
                />
                {showWarning && (
                  <p data-testid="generate-noun-warning" className="text-sm text-destructive">
                    {t(warningKey)}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="generate-noun-cancel"
              >
                {t('generateNoun.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="generate-noun-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('generateNoun.creatingButton')}
                  </>
                ) : (
                  t('generateNoun.createButton')
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p data-testid="generate-noun-success">{t('generateNoun.successMocked')}</p>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} data-testid="generate-noun-close">
                {t('generateNoun.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
