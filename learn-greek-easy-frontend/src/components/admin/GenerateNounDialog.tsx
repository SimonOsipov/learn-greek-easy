// src/components/admin/GenerateNounDialog.tsx

import React, { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { adminAPI, type ConfidenceTier } from '@/services/adminAPI';
import { type APIRequestError } from '@/services/api';
import { isValidGreekInput } from '@/utils/greekValidation';

export interface GenerateNounDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
}

const CONFIDENCE_BADGE_CLASSES: Record<ConfidenceTier, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const GenerateNounDialog: React.FC<GenerateNounDialogProps> = ({
  open,
  onOpenChange,
  deckName,
  deckId,
}) => {
  const { t } = useTranslation('admin');

  const [greekWord, setGreekWord] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (word: string) => adminAPI.generateWordEntry(word, deckId),
    onError: (error: Error) => {
      const apiErr = error as APIRequestError;
      if (apiErr.detail && typeof apiErr.detail === 'string') {
        setApiError(apiErr.detail);
      } else {
        setApiError(error.message || t('generateNoun.errorGeneric'));
      }
    },
  });

  const isSubmitting = mutation.isPending;
  const normalizationResult = mutation.data?.normalization ?? null;
  const hasResult = normalizationResult !== null;

  const trimmedWord = greekWord.trim();
  const validation = trimmedWord ? isValidGreekInput(trimmedWord) : { valid: false };
  const showWarning = trimmedWord.length > 0 && !validation.valid && !!validation.reason;
  const canSubmit = validation.valid && !isSubmitting && !hasResult;

  const warningKey =
    validation.reason === 'tooLong' ? 'generateNoun.tooLong' : 'generateNoun.invalidGreek';

  const handleSubmit = () => {
    const trimmed = greekWord.trim();
    if (!trimmed) return;
    setApiError(null);
    mutation.mutate(trimmed);
  };

  const handleOpenChange = (openState: boolean) => {
    if (!openState) {
      setTimeout(() => {
        setGreekWord('');
        setApiError(null);
        mutation.reset();
      }, 200);
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px]" data-testid="generate-noun-dialog">
        <DialogHeader>
          <DialogTitle>{t('generateNoun.title')}</DialogTitle>
        </DialogHeader>

        {hasResult && normalizationResult ? (
          <>
            <div data-testid="generate-noun-result" className="space-y-4">
              <h3 className="font-medium">{t('generateNoun.normalizationResult')}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('generateNoun.lemmaLabel')}</span>
                  <p data-testid="result-lemma" className="font-medium">
                    {normalizationResult.lemma}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('generateNoun.genderLabel')}</span>
                  <p data-testid="result-gender" className="font-medium">
                    {normalizationResult.gender
                      ? `${normalizationResult.gender}${normalizationResult.article ? ` (${normalizationResult.article})` : ''}`
                      : t('generateNoun.genderUnknown')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('generateNoun.posLabel')}</span>
                  <p data-testid="result-pos" className="font-medium">
                    {normalizationResult.pos}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('generateNoun.confidenceLabel')}</span>
                  <Badge
                    data-testid="result-confidence-badge"
                    className={CONFIDENCE_BADGE_CLASSES[normalizationResult.confidence_tier]}
                  >
                    {normalizationResult.confidence.toFixed(2)} —{' '}
                    {t(`generateNoun.confidence.${normalizationResult.confidence_tier}`)}
                  </Badge>
                </div>
              </div>
              {normalizationResult.confidence_tier === 'low' && (
                <Alert data-testid="result-low-confidence-warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('generateNoun.lowConfidenceWarning')}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setGreekWord('');
                  setApiError(null);
                  mutation.reset();
                }}
                data-testid="generate-noun-start-over"
              >
                {t('generateNoun.startOverButton')}
              </Button>
              <Button disabled data-testid="generate-noun-continue">
                {t('generateNoun.continueButton')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              {apiError && (
                <Alert variant="destructive" data-testid="generate-noun-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}

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
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setGreekWord(e.target.value);
                    setApiError(null);
                    mutation.reset();
                  }}
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
        )}
      </DialogContent>
    </Dialog>
  );
};
