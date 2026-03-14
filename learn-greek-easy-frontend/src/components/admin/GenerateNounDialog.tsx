// src/components/admin/GenerateNounDialog.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { InlineEditableText } from '@/components/admin/InlineEditableText';
import { UnifiedVerificationTable } from '@/components/admin/UnifiedVerificationTable';
import type { PillState, SelectionSource } from '@/components/admin/UnifiedVerificationTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { toast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import {
  GENERATE_WORD_ENTRY_STREAM_URL,
  adminAPI,
  type CombinedTier,
  type ConfidenceTier,
  type DuplicateCheckStageResult,
  type GeneratedNounData,
  type NormalizationStageResult,
  type SuggestionItem,
  type TranslationLookupStageResult,
  type VerificationSummary,
} from '@/services/adminAPI';
import { wordEntryAPI } from '@/services/wordEntryAPI';
import type { SSEEvent } from '@/types/sse';
import { isValidGreekInput } from '@/utils/greekValidation';
import { buildWordEntryPayload, initializeResolvedValues } from '@/utils/nounPayloadBuilder';
import type { EditableExample } from '@/utils/nounPayloadBuilder';

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

const TIER_BADGE_CLASSES: Record<CombinedTier, string> = {
  auto_approve: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  quick_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  manual_review: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function VerificationTierBadge({ tier }: { tier: CombinedTier }) {
  const { t } = useTranslation('admin');
  const tierLabel = {
    auto_approve: t('generateNoun.verification.tierAutoApprove'),
    quick_review: t('generateNoun.verification.tierQuickReview'),
    manual_review: t('generateNoun.verification.tierManualReview'),
  }[tier];
  return (
    <Badge data-testid="verification-tier-badge" className={TIER_BADGE_CLASSES[tier]}>
      {tierLabel}
    </Badge>
  );
}

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
  const [displayDuplicate, setDisplayDuplicate] = useState<DuplicateCheckStageResult | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayVerification, setDisplayVerification] = useState<VerificationSummary | null>(null);
  const [displayGeneration, setDisplayGeneration] = useState<GeneratedNounData | null>(null);
  const [displayTranslationLookup, setDisplayTranslationLookup] =
    useState<TranslationLookupStageResult | null>(null);

  // SSE pipeline state
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>(
    'idle'
  );
  const [generationLoading, setGenerationLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [streamBody, setStreamBody] = useState<unknown>(null);
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [swapConfirmation, setSwapConfirmation] = useState<{ index: number } | null>(null);
  const [editableExamples, setEditableExamples] = useState<EditableExample[]>([]);
  const [resolvedValues, setResolvedValues] = useState<Map<string, PillState>>(new Map());
  const [selections, setSelections] = useState<Map<string, SelectionSource>>(new Map());

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (displayGeneration) {
      setResolvedValues(initializeResolvedValues(displayGeneration, displayVerification));
      setEditableExamples(
        displayGeneration.examples.map((ex) => ({
          greek: ex.greek,
          english: ex.english ?? '',
          russian: ex.russian ?? '',
        }))
      );
    }
  }, [displayGeneration, displayVerification]);

  const handleSSEEvent = useCallback((event: SSEEvent<unknown>) => {
    const data = event.data as Record<string, unknown>;
    switch (event.type) {
      case 'normalization_complete':
        setDisplayPrimary(data['normalization'] as NormalizationStageResult);
        setDisplaySuggestions((data['suggestions'] as SuggestionItem[]) ?? []);
        break;
      case 'duplicates_checked':
        setDisplayDuplicate(data as unknown as DuplicateCheckStageResult);
        break;
      case 'translations_found':
        setDisplayTranslationLookup((data['data'] as TranslationLookupStageResult) ?? null);
        break;
      case 'generation_started':
        setGenerationLoading(true);
        break;
      case 'generation_complete':
        setDisplayGeneration(data as unknown as GeneratedNounData);
        setGenerationLoading(false);
        break;
      case 'generation_failed':
        setStageError((data['error'] as string) ?? 'Generation failed');
        setGenerationLoading(false);
        setPipelineStatus('error');
        break;
      case 'verification_started':
        setVerificationLoading(true);
        break;
      case 'verification_complete':
        setDisplayVerification(data as unknown as VerificationSummary);
        setVerificationLoading(false);
        break;
      case 'verification_failed':
        setVerificationLoading(false);
        break;
      case 'pipeline_complete':
        setPipelineStatus('done');
        setStreamEnabled(false);
        setStreamBody(null);
        break;
      case 'pipeline_stopped':
        setPipelineStatus('done');
        setStageError((data['error'] as string) ?? 'Pipeline stopped');
        setStreamEnabled(false);
        setStreamBody(null);
        break;
      case 'pipeline_failed':
        setStageError((data['error'] as string) ?? 'Pipeline failed');
        setPipelineStatus('error');
        setStreamEnabled(false);
        setStreamBody(null);
        break;
    }
  }, []);

  const { close: closeStream } = useSSE(GENERATE_WORD_ENTRY_STREAM_URL, {
    method: 'POST',
    body: streamBody,
    enabled: streamEnabled,
    onEvent: handleSSEEvent,
    onError: (err) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string }).message ?? 'Stream error');
      setApiError(msg);
      setPipelineStatus('error');
      setStreamEnabled(false);
      setStreamBody(null);
    },
    maxRetries: 0,
  });

  const linkMutation = useMutation({
    mutationFn: ({ wordEntryId }: { wordEntryId: string }) =>
      adminAPI.linkWordEntry(deckId, wordEntryId),
    onSuccess: () => {
      onWordLinked?.();
      handleOpenChange(false);
    },
    onError: (error: unknown) => {
      const apiErr = error as { detail?: string; message?: string };
      setApiError(apiErr.detail ?? String(error));
    },
  });

  const isSubmitting = pipelineStatus === 'streaming';
  const hasResult = displayPrimary !== null;

  const trimmedWord = greekWord.trim();
  const validation = trimmedWord ? isValidGreekInput(trimmedWord) : { valid: false };
  const showWarning = trimmedWord.length > 0 && !validation.valid && !!validation.reason;
  const canSubmit = validation.valid && !isSubmitting && !hasResult;

  const warningKey =
    validation.reason === 'tooLong' ? 'generateNoun.tooLong' : 'generateNoun.invalidGreek';

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!displayGeneration) {
        throw new Error('Generation data not available');
      }
      const payload = buildWordEntryPayload({
        generation: displayGeneration,
        resolvedValues,
        editableExamples,
      });
      return wordEntryAPI.bulkUpsert(deckId, [payload]);
    },
    onSuccess: () => {
      toast({ title: t('generateNoun.approve.successToast') });
      onWordLinked?.();
      handleOpenChange(false);
    },
    onError: () => {
      toast({
        title: t('generateNoun.approve.errorToast'),
        variant: 'destructive',
      });
    },
  });

  const executeSwap = useCallback(
    (suggestionIndex: number) => {
      const chosen = displaySuggestions[suggestionIndex];
      if (!displayPrimary || !chosen) return;

      // Client-side swap
      const newSuggestions = [...displaySuggestions];
      newSuggestions[suggestionIndex] = {
        lemma: displayPrimary.lemma,
        gender: displayPrimary.gender,
        article: displayPrimary.article,
        pos: displayPrimary.pos,
        confidence: displayPrimary.confidence,
        confidence_tier: displayPrimary.confidence_tier,
        strategy: displayPrimary.strategy ?? 'direct',
      };
      setDisplaySuggestions(newSuggestions);
      setDisplayPrimary({
        ...displayPrimary,
        lemma: chosen.lemma,
        gender: chosen.gender,
        article: chosen.article,
      });

      // Clear generation/verification
      setDisplayGeneration(null);
      setDisplayVerification(null);
      setGenerationLoading(false);
      setVerificationLoading(false);
      setStageError(null);
      setResolvedValues(new Map());
      setSelections(new Map());
      setPipelineStatus('streaming');

      // Start new SSE stream from generation stage
      const word = greekWord.trim();
      setStreamBody({
        word,
        deck_id: deckId,
        lemma: chosen.lemma,
        gender: chosen.gender,
        article: chosen.article,
        translation_lookup: displayTranslationLookup,
      });
      // Toggle stream to restart (if already streaming, need to reset)
      setStreamEnabled(false);
      setTimeout(() => setStreamEnabled(true), 0);

      setSwapConfirmation(null);
    },
    [displayPrimary, displaySuggestions, displayTranslationLookup, greekWord, deckId]
  );

  const handleSwap = useCallback(
    (suggestionIndex: number) => {
      if (!displayPrimary) return;
      if (displayGeneration) {
        // Generation done — need confirmation
        setSwapConfirmation({ index: suggestionIndex });
      } else {
        // Still generating — swap immediately
        executeSwap(suggestionIndex);
      }
    },
    [displayPrimary, displayGeneration, executeSwap]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = greekWord.trim();
    if (!trimmed || !deckId) return;

    // Reset all display state
    setDisplayPrimary(null);
    setDisplaySuggestions([]);
    setDisplayDuplicate(null);
    setDisplayGeneration(null);
    setDisplayVerification(null);
    setDisplayTranslationLookup(null);
    setGenerationLoading(false);
    setVerificationLoading(false);
    setStageError(null);
    setApiError(null);
    setPipelineStatus('streaming');

    setStreamBody({ word: trimmed, deck_id: deckId });
    setStreamEnabled(true);
  }, [greekWord, deckId]);

  const handleSelect = useCallback((fieldPath: string, source: SelectionSource) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(fieldPath, source);
      return next;
    });
  }, []);

  const resetAllState = useCallback(() => {
    setGreekWord('');
    setApiError(null);
    setDisplayPrimary(null);
    setDisplaySuggestions([]);
    setDisplayDuplicate(null);
    setDisplayVerification(null);
    setDisplayGeneration(null);
    setDisplayTranslationLookup(null);
    setPipelineStatus('idle');
    setGenerationLoading(false);
    setVerificationLoading(false);
    setStageError(null);
    setStreamEnabled(false);
    setStreamBody(null);
    setEditableExamples([]);
    setResolvedValues(new Map());
    setSelections(new Map());
    closeStream();
  }, [closeStream]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        resetAllState();
        resetTimerRef.current = null;
      }, 200);
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn('sm:max-w-[650px]', displayVerification && 'sm:max-w-[1200px]')}
          data-testid="generate-noun-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t('generateNoun.title')}</DialogTitle>
          </DialogHeader>

          {hasResult && displayPrimary ? (
            <>
              <div data-testid="generate-noun-content-area" className="space-y-4">
                <div className="space-y-4">
                  <div data-testid="generate-noun-result" className="space-y-4">
                    <h3 className="font-medium">{t('generateNoun.normalizationResult')}</h3>
                    {displayPrimary.corrected_from && displayPrimary.corrected_to && (
                      <div
                        data-testid="correction-note"
                        className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950"
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                          {t('generateNoun.accentCorrected', {
                            from: displayPrimary.corrected_from,
                            to: displayPrimary.corrected_to,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  {displayPrimary && (
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="font-medium">{t('generateNoun.lemmaLabel')}</span>
                        <p data-testid="result-lemma" className="text-muted-foreground">
                          {displayPrimary.lemma}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">{t('generateNoun.genderLabel')}</span>
                        <p data-testid="result-gender" className="text-muted-foreground">
                          {displayPrimary.gender
                            ? `${displayPrimary.gender}${displayPrimary.article ? ` (${displayPrimary.article})` : ''}`
                            : t('generateNoun.genderUnknown')}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">{t('generateNoun.posLabel')}</span>
                        <p data-testid="result-pos" className="text-muted-foreground">
                          {displayPrimary.pos.charAt(0).toUpperCase() +
                            displayPrimary.pos.slice(1).toLowerCase()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">{t('generateNoun.confidenceLabel')}</span>
                        <p>
                          <Badge
                            data-testid="result-confidence-badge"
                            className={CONFIDENCE_BADGE_CLASSES[displayPrimary.confidence_tier]}
                          >
                            {displayPrimary.confidence.toFixed(2)} —{' '}
                            {t(`generateNoun.confidence.${displayPrimary.confidence_tier}`)}
                          </Badge>
                        </p>
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
                      <h4 className="text-sm font-medium">{t('generateNoun.suggestionsTitle')}</h4>
                      <div className="space-y-1">
                        {displaySuggestions.map((suggestion, index) => (
                          <div
                            key={`${suggestion.lemma}-${suggestion.pos}-${index}`}
                            data-testid={`suggestion-row-${index}`}
                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold">{suggestion.lemma}</span>
                              <span className="text-muted-foreground">
                                {suggestion.pos.charAt(0).toUpperCase() +
                                  suggestion.pos.slice(1).toLowerCase()}
                              </span>
                              <Badge
                                className={CONFIDENCE_BADGE_CLASSES[suggestion.confidence_tier]}
                              >
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
                  {displayDuplicate && (
                    <DuplicateCheckSection
                      duplicateCheck={displayDuplicate}
                      currentDeckId={deckId}
                      onLinkToDeck={() => {
                        const wordEntryId = displayDuplicate.word_entry_id;
                        if (wordEntryId) {
                          linkMutation.mutate({ wordEntryId });
                        }
                      }}
                      isLinking={linkMutation.isPending}
                    />
                  )}

                  {displayDuplicate && (
                    <div data-testid="duplicate-check-section">
                      {displayDuplicate.is_duplicate ? (
                        <div className="space-y-2">
                          <div
                            data-testid="duplicate-found-warning"
                            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
                          >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="font-medium">
                                {t('generateNoun.duplicateFound', {
                                  deckName: displayDuplicate.matched_decks[0]?.deck_name ?? '',
                                })}
                              </p>
                              {displayDuplicate.existing_entry && (
                                <p className="mt-1 text-muted-foreground">
                                  {t('generateNoun.duplicateTranslation', {
                                    translation: displayDuplicate.existing_entry.translation_en,
                                  })}
                                </p>
                              )}
                              <p className="mt-1 text-muted-foreground">
                                {t('generateNoun.duplicateWarning')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          data-testid="no-duplicate-banner"
                          className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950"
                        >
                          <Info className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                          <span>{t('generateNoun.noDuplicates')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {generationLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('generateNoun.generatingWithAI')}
                    </div>
                  )}

                  {stageError && (
                    <Alert variant="destructive" data-testid="stage-error">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{stageError}</AlertDescription>
                    </Alert>
                  )}

                  {verificationLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('generateNoun.runningVerification')}
                    </div>
                  )}
                </div>

                {displayVerification && (
                  <div data-testid="verification-section" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">
                        {t('generateNoun.verification.combinedTier')}
                      </h3>
                      <VerificationTierBadge tier={displayVerification.combined_tier} />
                      {displayVerification.cross_ai?.overall_agreement != null &&
                        !displayVerification.cross_ai?.error && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            data-testid="cross-ai-agreement"
                          >
                            {t('generateNoun.verification.agreementScore', {
                              percentage: Math.round(
                                displayVerification.cross_ai.overall_agreement * 100
                              ),
                            })}
                          </Badge>
                        )}
                    </div>
                    <UnifiedVerificationTable
                      local={displayVerification.local}
                      crossAI={displayVerification.cross_ai}
                      interactive
                      resolvedValues={resolvedValues}
                      selections={selections}
                      onSelect={handleSelect}
                      onResolvedValueChange={(fieldPath, value) => {
                        setResolvedValues((prev) => {
                          const next = new Map(prev);
                          const existing = next.get(fieldPath);
                          if (existing) {
                            next.set(fieldPath, { ...existing, value, status: 'resolved' });
                          } else {
                            next.set(fieldPath, { value, source: 'manual', status: 'resolved' });
                          }
                          return next;
                        });
                      }}
                    />
                  </div>
                )}

                {editableExamples.length > 0 && (
                  <div data-testid="examples-section" className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {t('generateNoun.editable.examplesTitle')}
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {editableExamples.map((ex, i) => (
                        <div
                          key={i}
                          data-testid={`gen-example-${displayGeneration?.examples[i]?.id ?? i}`}
                          className="space-y-1.5 rounded-lg border bg-muted/30 p-3"
                        >
                          <InlineEditableText
                            data-testid={`editable-example-${i}-greek`}
                            value={ex.greek}
                            onChange={(val) =>
                              setEditableExamples((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, greek: val } : item
                                )
                              )
                            }
                            placeholder={t('generateNoun.editable.exampleGreek')}
                            className="text-xs font-medium"
                          />
                          <InlineEditableText
                            data-testid={`editable-example-${i}-english`}
                            value={ex.english}
                            onChange={(val) =>
                              setEditableExamples((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, english: val } : item
                                )
                              )
                            }
                            placeholder={t('generateNoun.editable.exampleEnglish')}
                            className="text-xs text-muted-foreground"
                          />
                          <InlineEditableText
                            data-testid={`editable-example-${i}-russian`}
                            value={ex.russian}
                            onChange={(val) =>
                              setEditableExamples((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, russian: val } : item
                                )
                              )
                            }
                            placeholder={t('generateNoun.editable.exampleRussian')}
                            className="text-xs text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {pipelineStatus === 'done' && displayGeneration && displayVerification && (
                  <>
                    <Button
                      data-testid="approve-save-button"
                      onClick={() => approveMutation.mutate()}
                      disabled={
                        !resolvedValues.get('translation_en')?.value?.trim() ||
                        approveMutation.isPending
                      }
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('generateNoun.approve.saving')}
                        </>
                      ) : (
                        t('generateNoun.approve.button')
                      )}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={resetAllState}
                  data-testid="generate-noun-start-over"
                >
                  {t('generateNoun.startOverButton')}
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
                {stageError && (
                  <Alert variant="destructive" data-testid="stage-error-early">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{stageError}</AlertDescription>
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

      <AlertDialog
        open={swapConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setSwapConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('generateNoun.swapConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('generateNoun.swapConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => swapConfirmation && executeSwap(swapConfirmation.index)}
            >
              {t('generateNoun.swapConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
