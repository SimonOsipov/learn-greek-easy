// src/components/admin/GenerateNounDialog.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Info,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSSE } from '@/hooks/useSSE';
import {
  GENERATE_WORD_ENTRY_STREAM_URL,
  adminAPI,
  type CombinedTier,
  type ConfidenceTier,
  type CrossAIVerificationResult,
  type DuplicateCheckStageResult,
  type FieldStatus,
  type FieldVerificationResult,
  type GeneratedNounData,
  type LocalVerificationResult,
  type MorphologySource,
  type NormalizationStageResult,
  type SuggestionItem,
  type TranslationLookupStageResult,
  type VerificationSummary,
} from '@/services/adminAPI';
import type { SSEEvent } from '@/types/sse';
import { isValidGreekInput } from '@/utils/greekValidation';

import { DeclensionTable } from './DeclensionTable';

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

const FIELD_STATUS_ICON: Record<FieldStatus, { icon: React.ElementType; className: string }> = {
  pass: { icon: Check, className: 'text-green-600 dark:text-green-400' },
  warn: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  fail: { icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  skipped: { icon: MinusCircle, className: 'text-gray-400 dark:text-gray-500' },
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

function LocalVerificationPanel({ result }: { result: LocalVerificationResult }) {
  const { t } = useTranslation('admin');
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set());

  const toggleField = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  return (
    <Collapsible data-testid="local-verification-panel" defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-muted/50">
        <span>{t('generateNoun.verification.localVerification')}</span>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1">
        {result.fields.map((field: FieldVerificationResult) => {
          const { icon: StatusIcon, className: iconClass } = FIELD_STATUS_ICON[field.status];
          const isExpanded = expandedFields.has(field.field_path);
          return (
            <div key={field.field_path} data-testid={`field-${field.field_path}`}>
              <button
                type="button"
                onClick={() => toggleField(field.field_path)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
              >
                <StatusIcon className={`h-4 w-4 shrink-0 ${iconClass}`} />
                <span className="flex-1 text-left font-mono text-xs">{field.field_path}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`generateNoun.verification.fieldStatus.${field.status}`)}
                </span>
              </button>
              {isExpanded && field.checks.length > 0 && (
                <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                  {field.checks.map((check, idx) => {
                    const { icon: CheckIcon, className: checkClass } =
                      FIELD_STATUS_ICON[check.status as FieldStatus] ?? FIELD_STATUS_ICON.warn;
                    return (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <CheckIcon className={`mt-0.5 h-3 w-3 shrink-0 ${checkClass}`} />
                        <span className="text-muted-foreground">{check.check_name}</span>
                        {check.message && (
                          <span className="text-muted-foreground">— {check.message}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CrossAIVerificationPanel({
  result,
  morphologySource,
}: {
  result: CrossAIVerificationResult;
  morphologySource: MorphologySource;
}) {
  const { t } = useTranslation('admin');

  if (result.error) {
    return (
      <Alert data-testid="cross-ai-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('generateNoun.verification.crossAiUnavailable')}: {result.error}
        </AlertDescription>
      </Alert>
    );
  }

  const agreementPct =
    result.overall_agreement != null ? Math.round(result.overall_agreement * 100) : null;
  const agreementColorClass =
    agreementPct == null
      ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      : agreementPct >= 90
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : agreementPct >= 70
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  return (
    <Collapsible data-testid="cross-ai-verification-panel" defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-muted/50">
        <span>{t('generateNoun.verification.crossAiVerification')}</span>
        <Badge data-testid="cross-ai-agreement" className={agreementColorClass}>
          {agreementPct != null
            ? t('generateNoun.verification.agreementScore', { percentage: agreementPct })
            : t('generateNoun.verification.notAvailable')}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {morphologySource === 'lexicon' && (
          <div
            data-testid="lexicon-scope-note"
            className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs dark:border-blue-800 dark:bg-blue-950"
          >
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{t('generateNoun.verification.morphologySourceNote')}</span>
          </div>
        )}
        {result.comparisons.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('generateNoun.verification.noComparisons')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-1 pr-2">
                    {t('generateNoun.verification.comparisonHeaders.field')}
                  </th>
                  <th className="pb-1 pr-2">
                    {t('generateNoun.verification.comparisonHeaders.primary')}
                  </th>
                  <th className="pb-1 pr-2">
                    {t('generateNoun.verification.comparisonHeaders.secondary')}
                  </th>
                  <th className="pb-1">{t('generateNoun.verification.comparisonHeaders.match')}</th>
                </tr>
              </thead>
              <tbody>
                {result.comparisons.map((comp) => (
                  <tr key={comp.field_path} className="border-b last:border-0">
                    <td className="py-1 pr-2 font-mono">{comp.field_path}</td>
                    <td className="py-1 pr-2">{comp.primary_value}</td>
                    <td className="py-1 pr-2">{comp.secondary_value}</td>
                    <td className="py-1">
                      {comp.agrees ? (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
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

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

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
  const showPipeline = isSubmitting || hasResult;

  const trimmedWord = greekWord.trim();
  const validation = trimmedWord ? isValidGreekInput(trimmedWord) : { valid: false };
  const showWarning = trimmedWord.length > 0 && !validation.valid && !!validation.reason;
  const canSubmit = validation.valid && !isSubmitting && !hasResult;

  const warningKey =
    validation.reason === 'tooLong' ? 'generateNoun.tooLong' : 'generateNoun.invalidGreek';

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
        <DialogContent className="sm:max-w-[650px]" data-testid="generate-noun-dialog">
          <DialogHeader>
            <DialogTitle>{t('generateNoun.title')}</DialogTitle>
            {showPipeline && (
              <div
                data-testid="pipeline-steps"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span>1. {t('generateNoun.normalizationResult')}</span>
                <span>/</span>
                <span>2. {t('generateNoun.pipeline.duplicates')}</span>
                <span>/</span>
                <span className={displayGeneration ? 'font-medium text-foreground' : ''}>
                  3.{' '}
                  {displayGeneration
                    ? t('generateNoun.pipeline.generated')
                    : isSubmitting
                      ? t('generateNoun.pipeline.generating')
                      : t('generateNoun.pipeline.generate')}
                </span>
                <span>/</span>
                <span className={displayVerification ? 'font-medium text-foreground' : ''}>
                  4.{' '}
                  {displayVerification
                    ? t('generateNoun.verification.verified')
                    : isSubmitting
                      ? t('generateNoun.verification.verifying')
                      : t('generateNoun.verification.verify')}
                </span>
              </div>
            )}
          </DialogHeader>

          {hasResult && displayPrimary ? (
            <>
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
                        {displayPrimary.pos.charAt(0).toUpperCase() +
                          displayPrimary.pos.slice(1).toLowerCase()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t('generateNoun.confidenceLabel')}
                      </span>
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
                            <span className="text-muted-foreground">
                              {suggestion.pos.charAt(0).toUpperCase() +
                                suggestion.pos.slice(1).toLowerCase()}
                            </span>
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
              </div>

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

              {displayTranslationLookup &&
                (displayTranslationLookup.en?.source !== 'none' ||
                  displayTranslationLookup.ru?.source !== 'none') && (
                  <Collapsible data-testid="tdict-section">
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-muted/50">
                      <span>{t('generateNoun.tdict.title')}</span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 px-1">
                      {displayTranslationLookup.en &&
                        displayTranslationLookup.en.source !== 'none' && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">EN:</span>
                            <span>{displayTranslationLookup.en.combined_text}</span>
                            <Badge variant="outline" className="text-xs">
                              {displayTranslationLookup.en.source}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({displayTranslationLookup.en.sense_count})
                            </span>
                          </div>
                        )}
                      {displayTranslationLookup.ru &&
                        displayTranslationLookup.ru.source !== 'none' && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">RU:</span>
                            <span>{displayTranslationLookup.ru.combined_text}</span>
                            <Badge variant="outline" className="text-xs">
                              {displayTranslationLookup.ru.source}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({displayTranslationLookup.ru.sense_count})
                            </span>
                          </div>
                        )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

              {generationLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating with AI...
                </div>
              )}

              {stageError && (
                <Alert variant="destructive" data-testid="stage-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{stageError}</AlertDescription>
                </Alert>
              )}

              {displayGeneration && (
                <Collapsible data-testid="generation-section">
                  <CollapsibleTrigger
                    data-testid="generation-section-trigger"
                    className="flex w-full items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-muted/50"
                  >
                    <span>{t('generateNoun.generation.title')}</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3 px-1">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          {t('generateNoun.generation.translationEn')}
                        </span>
                        <p data-testid="gen-translation-en" className="font-medium">
                          {displayGeneration.translation_en}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('generateNoun.generation.translationRu')}
                        </span>
                        <p data-testid="gen-translation-ru" className="font-medium">
                          {displayGeneration.translation_ru}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('generateNoun.generation.translationEnPlural')}
                        </span>
                        <p data-testid="gen-translation-en-plural" className="font-medium">
                          {displayGeneration.translation_en_plural ?? '—'}
                        </p>
                      </div>
                      {displayGeneration.translation_ru_plural != null && (
                        <div>
                          <span className="text-muted-foreground">
                            {t('generateNoun.generation.translationRuPlural')}
                          </span>
                          <p data-testid="gen-translation-ru-plural" className="font-medium">
                            {displayGeneration.translation_ru_plural}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">
                          {t('generateNoun.generation.pronunciation')}
                        </span>
                        <p data-testid="gen-pronunciation" className="font-medium">
                          {displayGeneration.pronunciation}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('generateNoun.generation.declensionGroup')}
                        </span>
                        <p>
                          <Badge data-testid="gen-declension-group" variant="outline">
                            {displayGeneration.grammar_data.declension_group}
                          </Badge>
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                        {t('generateNoun.generation.declensionTable')}
                      </h4>
                      <DeclensionTable cases={displayGeneration.grammar_data.cases} />
                    </div>
                    {displayGeneration.examples.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                          {t('generateNoun.generation.examples')}
                        </h4>
                        <div className="space-y-2">
                          {displayGeneration.examples.map((ex) => (
                            <div
                              key={ex.id}
                              data-testid={`gen-example-${ex.id}`}
                              className="rounded-md border p-2 text-sm"
                            >
                              <p className="font-medium">{ex.greek}</p>
                              <p className="text-muted-foreground">{ex.english}</p>
                              <p className="text-muted-foreground">{ex.russian}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {verificationLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running verification...
                </div>
              )}

              {displayVerification && (
                <div data-testid="verification-section" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">
                      {t('generateNoun.verification.combinedTier')}
                    </h3>
                    <VerificationTierBadge tier={displayVerification.combined_tier} />
                  </div>
                  {displayVerification.local && (
                    <LocalVerificationPanel result={displayVerification.local} />
                  )}
                  {displayVerification.cross_ai && (
                    <CrossAIVerificationPanel
                      result={displayVerification.cross_ai}
                      morphologySource={displayVerification.morphology_source}
                    />
                  )}
                </div>
              )}

              <DialogFooter>
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
