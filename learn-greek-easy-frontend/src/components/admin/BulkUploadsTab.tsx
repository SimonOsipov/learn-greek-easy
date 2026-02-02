// src/components/admin/BulkUploadsTab.tsx

/**
 * Bulk Uploads Tab Component
 *
 * Admin tab for bulk uploading vocabulary cards via JSON.
 * Features:
 * - JSON textarea with deck_id and cards in payload
 * - Validate & Preview functionality
 * - Preview summary showing card counts and grammar breakdown
 * - Upload with progress indication
 * - Success/error handling with toast notifications
 */

import React, { useCallback, useState } from 'react';

import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cardAPI, type CardCreatePayload } from '@/services/cardAPI';
import type { PartOfSpeech, DeckLevel } from '@/types/grammar';

// ============================================================================
// Types
// ============================================================================

/**
 * Single card in bulk JSON input
 */
interface BulkCardInput {
  front_text: string;
  back_text_en: string;
  back_text_ru?: string | null;
  pronunciation?: string | null;
  part_of_speech?: PartOfSpeech | null;
  level?: DeckLevel | null;
  example_sentence?: string | null;
  examples?: Array<{
    greek: string;
    english?: string;
    russian?: string;
    tense?: string | null;
  }> | null;
  noun_data?: Record<string, unknown> | null;
  verb_data?: Record<string, unknown> | null;
  adjective_data?: Record<string, unknown> | null;
  adverb_data?: Record<string, unknown> | null;
}

/**
 * Validation error for a single card
 */
interface ValidationError {
  cardIndex: number;
  field: string;
  message: string;
}

/**
 * Preview summary data
 */
interface PreviewSummary {
  totalCards: number;
  grammarCounts: {
    nouns: number;
    verbs: number;
    adjectives: number;
    adverbs: number;
  };
  totalExamples: number;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_PARTS_OF_SPEECH: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb'];
const VALID_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MAX_CARDS = 100;

/**
 * Validate a single card and return any errors
 */
function validateCard(card: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof card !== 'object' || card === null) {
    errors.push({ cardIndex: index, field: 'card', message: 'Card must be an object' });
    return errors;
  }

  const c = card as Record<string, unknown>;

  // Required fields
  if (typeof c.front_text !== 'string' || c.front_text.trim() === '') {
    errors.push({ cardIndex: index, field: 'front_text', message: 'front_text is required' });
  }

  if (typeof c.back_text_en !== 'string' || c.back_text_en.trim() === '') {
    errors.push({ cardIndex: index, field: 'back_text_en', message: 'back_text_en is required' });
  }

  // Optional string fields
  if (
    c.back_text_ru !== undefined &&
    c.back_text_ru !== null &&
    typeof c.back_text_ru !== 'string'
  ) {
    errors.push({
      cardIndex: index,
      field: 'back_text_ru',
      message: 'back_text_ru must be a string',
    });
  }

  if (
    c.pronunciation !== undefined &&
    c.pronunciation !== null &&
    typeof c.pronunciation !== 'string'
  ) {
    errors.push({
      cardIndex: index,
      field: 'pronunciation',
      message: 'pronunciation must be a string',
    });
  }

  if (
    c.example_sentence !== undefined &&
    c.example_sentence !== null &&
    typeof c.example_sentence !== 'string'
  ) {
    errors.push({
      cardIndex: index,
      field: 'example_sentence',
      message: 'example_sentence must be a string',
    });
  }

  // Part of speech validation
  if (c.part_of_speech !== undefined && c.part_of_speech !== null) {
    if (!VALID_PARTS_OF_SPEECH.includes(c.part_of_speech as PartOfSpeech)) {
      errors.push({
        cardIndex: index,
        field: 'part_of_speech',
        message: `part_of_speech must be one of: ${VALID_PARTS_OF_SPEECH.join(', ')}`,
      });
    }
  }

  // Level validation
  if (c.level !== undefined && c.level !== null) {
    if (!VALID_LEVELS.includes(c.level as DeckLevel)) {
      errors.push({
        cardIndex: index,
        field: 'level',
        message: `level must be one of: ${VALID_LEVELS.join(', ')}`,
      });
    }
  }

  // Examples validation
  if (c.examples !== undefined && c.examples !== null) {
    if (!Array.isArray(c.examples)) {
      errors.push({ cardIndex: index, field: 'examples', message: 'examples must be an array' });
    } else {
      c.examples.forEach((ex: unknown, exIndex: number) => {
        if (typeof ex !== 'object' || ex === null) {
          errors.push({
            cardIndex: index,
            field: `examples[${exIndex}]`,
            message: 'example must be an object',
          });
        } else {
          const example = ex as Record<string, unknown>;
          if (typeof example.greek !== 'string' || example.greek.trim() === '') {
            errors.push({
              cardIndex: index,
              field: `examples[${exIndex}].greek`,
              message: 'example.greek is required',
            });
          }
        }
      });
    }
  }

  return errors;
}

/**
 * Validate all cards and return errors
 */
function validateCards(cards: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];

  cards.forEach((card, index) => {
    errors.push(...validateCard(card, index));
  });

  return errors;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse JSON input and extract deck_id and cards.
 * Requires object format with deck_id and cards fields.
 * Rejects bare array format with helpful migration message.
 * Returns detailed syntax error info when parsing fails.
 */
function parseCardsJson(jsonString: string):
  | { success: true; deck_id: string; cards: unknown[] }
  | {
      success: false;
      errorKey:
        | 'invalidJson'
        | 'arrayFormatDetected'
        | 'missingDeckId'
        | 'invalidDeckId'
        | 'missingCards';
      syntaxError?: { message: string; line?: number; column?: number };
    } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Try to extract position from error message
      const posMatch = error.message.match(/position\s+(\d+)/i);
      if (posMatch) {
        const position = parseInt(posMatch[1], 10);
        const beforeError = jsonString.substring(0, position);
        const lines = beforeError.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        // Clean up error message (remove "at position N" suffix)
        const cleanMessage = error.message.replace(/\s*at position \d+/i, '').trim();
        return {
          success: false,
          errorKey: 'invalidJson',
          syntaxError: { message: cleanMessage, line, column },
        };
      }
      // No position info available
      return {
        success: false,
        errorKey: 'invalidJson',
        syntaxError: { message: error.message },
      };
    }
    return { success: false, errorKey: 'invalidJson' };
  }

  // Reject bare array format with helpful migration message
  if (Array.isArray(parsed)) {
    return { success: false, errorKey: 'arrayFormatDetected' };
  }

  // Must be an object
  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, errorKey: 'missingDeckId' };
  }

  const obj = parsed as Record<string, unknown>;

  // Validate deck_id is present and non-empty string
  if (typeof obj.deck_id !== 'string' || obj.deck_id.trim() === '') {
    return { success: false, errorKey: 'missingDeckId' };
  }

  // Validate deck_id is valid UUID format
  if (!UUID_REGEX.test(obj.deck_id)) {
    return { success: false, errorKey: 'invalidDeckId' };
  }

  // Validate cards array exists
  if (!Array.isArray(obj.cards)) {
    return { success: false, errorKey: 'missingCards' };
  }

  return { success: true, deck_id: obj.deck_id, cards: obj.cards };
}

/**
 * Calculate preview summary from validated cards
 */
function calculatePreviewSummary(cards: BulkCardInput[]): PreviewSummary {
  const grammarCounts = { nouns: 0, verbs: 0, adjectives: 0, adverbs: 0 };
  let totalExamples = 0;

  cards.forEach((card) => {
    if (card.part_of_speech === 'noun' || card.noun_data) grammarCounts.nouns++;
    if (card.part_of_speech === 'verb' || card.verb_data) grammarCounts.verbs++;
    if (card.part_of_speech === 'adjective' || card.adjective_data) grammarCounts.adjectives++;
    if (card.part_of_speech === 'adverb' || card.adverb_data) grammarCounts.adverbs++;

    if (card.examples && Array.isArray(card.examples)) {
      totalExamples += card.examples.length;
    }
  });

  return {
    totalCards: cards.length,
    grammarCounts,
    totalExamples,
  };
}

// ============================================================================
// Component
// ============================================================================

export const BulkUploadsTab: React.FC = () => {
  const { t } = useTranslation('admin');

  // JSON input state
  const [jsonInput, setJsonInput] = useState('');

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [validatedDeckId, setValidatedDeckId] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // ========================================
  // Reset validation when input changes
  // ========================================
  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
    setIsValidated(false);
    setValidationErrors([]);
    setPreviewSummary(null);
    setValidatedDeckId(null);
  }, []);

  // ========================================
  // Validate & Preview
  // ========================================
  const handleValidate = useCallback(() => {
    // Reset state
    setValidationErrors([]);
    setPreviewSummary(null);
    setIsValidated(false);
    setValidatedDeckId(null);

    // Check if JSON is provided
    if (!jsonInput.trim()) {
      setValidationErrors([{ cardIndex: -1, field: 'json', message: t('bulkUploads.noCards') }]);
      return;
    }

    // Parse JSON and extract deck_id and cards
    const parseResult = parseCardsJson(jsonInput);
    if (!parseResult.success) {
      let errorMessage: string;
      if (parseResult.syntaxError) {
        const { message, line, column } = parseResult.syntaxError;
        if (line !== undefined && column !== undefined) {
          errorMessage = t('bulkUploads.jsonSyntaxError', { line, column, message });
        } else {
          errorMessage = t('bulkUploads.jsonSyntaxErrorNoPosition', { message });
        }
      } else {
        errorMessage = t(`bulkUploads.${parseResult.errorKey}`);
      }
      setValidationErrors([{ cardIndex: -1, field: 'json', message: errorMessage }]);
      return;
    }

    const cardsArray = parseResult.cards;

    // Check if empty
    if (cardsArray.length === 0) {
      setValidationErrors([{ cardIndex: -1, field: 'json', message: t('bulkUploads.noCards') }]);
      return;
    }

    // Check max cards
    if (cardsArray.length > MAX_CARDS) {
      setValidationErrors([
        { cardIndex: -1, field: 'json', message: t('bulkUploads.tooManyCards') },
      ]);
      return;
    }

    // Validate each card
    const errors = validateCards(cardsArray);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // All valid - calculate preview and store deck_id
    const summary = calculatePreviewSummary(cardsArray as BulkCardInput[]);
    setPreviewSummary(summary);
    setValidatedDeckId(parseResult.deck_id);
    setIsValidated(true);
  }, [jsonInput, t]);

  // ========================================
  // Upload Cards
  // ========================================
  const handleUpload = useCallback(async () => {
    if (!isValidated || !validatedDeckId || !previewSummary) return;

    setIsUploading(true);

    try {
      const parseResult = parseCardsJson(jsonInput);
      if (!parseResult.success) return; // Should not happen since validated
      // Cast to the API expected type - validation already verified structure
      const cards = parseResult.cards as Omit<CardCreatePayload, 'deck_id'>[];

      // Call bulk create API using deck_id from the validated JSON
      const response = await cardAPI.bulkCreate(validatedDeckId, cards);

      // Show success toast
      toast({
        title: t('bulkUploads.successToast', { count: response.created_count }),
      });

      // Clear form on success
      setJsonInput('');
      setIsValidated(false);
      setPreviewSummary(null);
      setValidationErrors([]);
      setValidatedDeckId(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('bulkUploads.errorToast'),
        description: errorMessage,
        variant: 'destructive',
      });
      // Preserve form content on error (don't clear)
    } finally {
      setIsUploading(false);
    }
  }, [isValidated, validatedDeckId, previewSummary, jsonInput, t]);

  // ========================================
  // Render
  // ========================================
  return (
    <div className="space-y-6" data-testid="bulk-uploads-tab">
      <Card>
        <CardHeader>
          <CardTitle>{t('bulkUploads.title')}</CardTitle>
          <CardDescription>{t('bulkUploads.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* JSON Textarea */}
          <div className="space-y-2">
            <Label htmlFor="json-textarea">{t('bulkUploads.jsonLabel')}</Label>
            <Textarea
              id="json-textarea"
              data-testid="bulk-uploads-json-textarea"
              value={jsonInput}
              onChange={handleJsonChange}
              placeholder={t('bulkUploads.jsonPlaceholder')}
              className="min-h-[300px] font-mono text-sm"
              disabled={isUploading}
            />
            <p className="text-sm text-muted-foreground">{t('bulkUploads.maxCardsWarning')}</p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive" data-testid="bulk-uploads-errors">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">{t('bulkUploads.validationErrors')}</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>
                        {error.cardIndex >= 0 ? (
                          <>
                            <strong>Card {error.cardIndex + 1}</strong> - {error.field}:{' '}
                            {error.message}
                          </>
                        ) : (
                          error.message
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Summary */}
          {isValidated && previewSummary && (
            <Alert
              className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
              data-testid="bulk-uploads-preview"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    {t('bulkUploads.previewTitle')}
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('bulkUploads.totalCards')}</p>
                      <p className="text-lg font-semibold">{previewSummary.totalCards}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('bulkUploads.withGrammar')}
                      </p>
                      <p className="text-sm">
                        {previewSummary.grammarCounts.nouns > 0 && (
                          <span className="mr-2">
                            {t('bulkUploads.grammarCounts.nouns')}:{' '}
                            {previewSummary.grammarCounts.nouns}
                          </span>
                        )}
                        {previewSummary.grammarCounts.verbs > 0 && (
                          <span className="mr-2">
                            {t('bulkUploads.grammarCounts.verbs')}:{' '}
                            {previewSummary.grammarCounts.verbs}
                          </span>
                        )}
                        {previewSummary.grammarCounts.adjectives > 0 && (
                          <span className="mr-2">
                            {t('bulkUploads.grammarCounts.adjectives')}:{' '}
                            {previewSummary.grammarCounts.adjectives}
                          </span>
                        )}
                        {previewSummary.grammarCounts.adverbs > 0 && (
                          <span>
                            {t('bulkUploads.grammarCounts.adverbs')}:{' '}
                            {previewSummary.grammarCounts.adverbs}
                          </span>
                        )}
                        {Object.values(previewSummary.grammarCounts).every((c) => c === 0) && '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('bulkUploads.withExamples')}
                      </p>
                      <p className="text-lg font-semibold">{previewSummary.totalExamples}</p>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Indicator */}
          {isUploading && (
            <div
              className="flex items-center gap-2 text-muted-foreground"
              data-testid="bulk-uploads-progress"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('bulkUploads.uploadingButton')}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={isUploading || !jsonInput.trim()}
              data-testid="bulk-uploads-validate-button"
            >
              {t('bulkUploads.validateButton')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!isValidated || isUploading}
              data-testid="bulk-uploads-upload-button"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('bulkUploads.uploadingButton')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('bulkUploads.uploadButton')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
