// src/components/admin/GenerateNounDialog.tsx

import React, { useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
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
import {
  adminAPI,
  type ConfidenceTier,
  type DuplicateCheckStageResult,
  type NormalizationStageResult,
  type SuggestionItem,
} from '@/services/adminAPI';
import { type APIRequestError } from '@/services/api';
import { isValidGreekInput } from '@/utils/greekValidation';

export interface GenerateNounDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
  onWordLinked?: () => void;
}

interface DuplicateCheckSectionProps {
  duplicateCheck: DuplicateCheckStageResult;
  currentDeckId: string;
  onLinkToDeck: () => void;
  isLinking: boolean;
}

function DuplicateCheckSection({
  duplicateCheck,
  currentDeckId,
  onLinkToDeck,
  isLinking,
}: DuplicateCheckSectionProps) {
  const { t } = useTranslation('admin');

  if (!duplicateCheck.is_duplicate) return null;

  const isAlreadyInCurrentDeck = duplicateCheck.matched_decks.some(
    (d) => d.deck_id === currentDeckId
  );

  if (isAlreadyInCurrentDeck) {
    return (
      <Alert>
        <AlertDescription>{t('generateNoun.alreadyInDeck')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {t('generateNoun.existsInDecks', { count: duplicateCheck.matched_decks.length })}
      </p>
      <Button onClick={onLinkToDeck} disabled={isLinking} size="sm">
        {t('generateNoun.linkToDeck')}
      </Button>
    </div>
  );
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
  onWordLinked,
}) => {
  const { t } = useTranslation('admin');

  const [greekWord, setGreekWord] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayPrimary, setDisplayPrimary] = useState<NormalizationStageResult | null>(null);
  const [displaySuggestions, setDisplaySuggestions] = useState<SuggestionItem[]>([]);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

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

  const linkMutation = useMutation({
    mutationFn: ({ wordEntryId }: { wordEntryId: string }) =>
      adminAPI.linkWordEntry(deckId, wordEntryId),
    onSuccess: () => {
      onWordLinked?.();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const apiErr = error as { detail?: string; message?: string };
      setApiError(apiErr.detail ?? String(error));
    },
  });

  const isSubmitting = mutation.isPending;
  const normalizationResult = mutation.data?.normalization ?? null;
  const hasResult = normalizationResult !== null;

  useEffect(() => {
    if (normalizationResult) {
      setDisplayPrimary(normalizationResult);
      setDisplaySuggestions(mutation.data?.suggestions ?? []);
    }
  }, [normalizationResult, mutation.data?.suggestions]);

  const trimmedWord = greekWord.trim();
  const validation = trimmedWord ? isValidGreekInput(trimmedWord) : { valid: false };
  const showWarning = trimmedWord.length > 0 && !validation.valid && !!validation.reason;
  const canSubmit = validation.valid && !isSubmitting && !hasResult;

  const warningKey =
    validation.reason === 'tooLong' ? 'generateNoun.tooLong' : 'generateNoun.invalidGreek';

  const handleSwap = (suggestionIndex: number) => {
    if (!displayPrimary) return;
    const chosen = displaySuggestions[suggestionIndex];
    const newSuggestions = [...displaySuggestions];
    newSuggestions[suggestionIndex] = {
      lemma: displayPrimary.lemma,
      pos: displayPrimary.pos,
      gender: displayPrimary.gender,
      article: displayPrimary.article,
      confidence: displayPrimary.confidence,
      confidence_tier: displayPrimary.confidence_tier,
      strategy: displayPrimary.strategy ?? 'direct',
    };
    setDisplayPrimary({
      ...displayPrimary,
      lemma: chosen.lemma,
      pos: chosen.pos,
      gender: chosen.gender,
      article: chosen.article,
      confidence: chosen.confidence,
      confidence_tier: chosen.confidence_tier,
      strategy: chosen.strategy,
    });
    setDisplaySuggestions(newSuggestions);
  };

  const handleSubmit = () => {
    const trimmed = greekWord.trim();
    if (!trimmed) return;
    setApiError(null);
    mutation.mutate(trimmed);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setGreekWord('');
        setApiError(null);
        setDisplayPrimary(null);
        setDisplaySuggestions([]);
        mutation.reset();
        resetTimerRef.current = null;
      }, 200);
    }
    onOpenChange(open);
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
              {normalizationResult.corrected_from && normalizationResult.corrected_to && (
                <div
                  data-testid="correction-note"
                  className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    {t('generateNoun.accentCorrected', {
                      from: normalizationResult.corrected_from,
                      to: normalizationResult.corrected_to,
                    })}
                  </span>
                </div>
              )}
              {displayPrimary && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('generateNoun.lemmaLabel')}</span>
                    <p data-testid="result-lemma" className="font-medium">
                      {displayPrimary.lemma}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('generateNoun.genderLabel')}</span>
                    <p data-testid="result-gender" className="font-medium">
                      {displayPrimary.gender
                        ? `${displayPrimary.gender}${displayPrimary.article ? ` (${displayPrimary.article})` : ''}`
                        : t('generateNoun.genderUnknown')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('generateNoun.posLabel')}</span>
                    <p data-testid="result-pos" className="font-medium">
                      {displayPrimary.pos}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t('generateNoun.confidenceLabel')}
                    </span>
                    <Badge
                      data-testid="result-confidence-badge"
                      className={CONFIDENCE_BADGE_CLASSES[displayPrimary.confidence_tier]}
                    >
                      {displayPrimary.confidence.toFixed(2)} —{' '}
                      {t(`generateNoun.confidence.${displayPrimary.confidence_tier}`)}
                    </Badge>
                  </div>
                </div>
              )}
              {displayPrimary?.confidence_tier === 'low' && (
                <Alert data-testid="result-low-confidence-warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('generateNoun.lowConfidenceWarning')}</AlertDescription>
                </Alert>
              )}
              {displaySuggestions.length > 0 && (
                <div data-testid="suggestions-section" className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {t('generateNoun.suggestionsTitle')}
                  </h4>
                  <div className="space-y-1">
                    {displaySuggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.lemma}-${suggestion.pos}-${index}`}
                        data-testid={`suggestion-row-${index}`}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{suggestion.lemma}</span>
                          <span className="text-muted-foreground">{suggestion.pos}</span>
                          <Badge className={CONFIDENCE_BADGE_CLASSES[suggestion.confidence_tier]}>
                            {suggestion.confidence.toFixed(2)}{' '}
                            {t(`generateNoun.confidence.${suggestion.confidence_tier}`)}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`suggestion-use-${index}`}
                          onClick={() => handleSwap(index)}
                        >
                          {t('generateNoun.useSuggestion')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mutation.data?.duplicate_check && (
                <DuplicateCheckSection
                  duplicateCheck={mutation.data.duplicate_check}
                  currentDeckId={deckId}
                  onLinkToDeck={() => {
                    const wordEntryId = mutation.data?.duplicate_check?.word_entry_id;
                    if (wordEntryId) {
                      linkMutation.mutate({ wordEntryId });
                    }
                  }}
                  isLinking={linkMutation.isPending}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setGreekWord('');
                  setApiError(null);
                  setDisplayPrimary(null);
                  setDisplaySuggestions([]);
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
