// src/components/admin/WordEntriesTab.tsx

/**
 * Word Entries Tab Component
 *
 * Admin tab for bulk uploading word entries via JSON.
 * Features:
 * - JSON textarea with deck_id and word_entries in payload
 * - Validate & Preview functionality
 * - Preview summary showing entry counts and part of speech breakdown
 * - Upload with upsert support (create new or update existing)
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
import { wordEntryAPI, type WordEntryInput } from '@/services/wordEntryAPI';
import type { PartOfSpeech } from '@/types/grammar';

// ============================================================================
// Types
// ============================================================================

/**
 * Example sentence in bulk JSON input (matches backend schema)
 */
interface BulkExampleSentence {
  greek: string;
  english?: string;
  russian?: string;
  context?: string | null;
}

/**
 * Single word entry in bulk JSON input
 */
interface BulkWordEntryInput {
  lemma: string;
  part_of_speech: PartOfSpeech;
  translation_en: string;
  translation_ru?: string | null;
  pronunciation?: string | null;
  grammar_data?: Record<string, unknown> | null;
  examples?: BulkExampleSentence[] | null;
}

/**
 * Validation error for a single word entry
 */
interface ValidationError {
  entryIndex: number;
  field: string;
  message: string;
}

/**
 * Preview summary data
 */
interface PreviewSummary {
  totalEntries: number;
  partOfSpeechCounts: {
    nouns: number;
    verbs: number;
    adjectives: number;
    adverbs: number;
  };
  entriesWithExamples: number;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_PARTS_OF_SPEECH: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb'];
const MAX_ENTRIES = 100;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const JSON_PLACEHOLDER = `{
  "deck_id": "your-deck-uuid-here",
  "word_entries": [
    {
      "lemma": "σπίτι",
      "part_of_speech": "noun",
      "translation_en": "house, home",
      "translation_ru": "дом",
      "pronunciation": "/spí·ti/",
      "grammar_data": {
        "gender": "neuter",
        "nominative_singular": "σπίτι",
        "genitive_singular": "σπιτιού"
      },
      "examples": [
        {
          "greek": "Το σπίτι μου είναι μικρό.",
          "english": "My house is small."
        }
      ]
    }
  ]
}`;

/**
 * Validate a single word entry and return any errors
 */
function validateWordEntry(entry: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof entry !== 'object' || entry === null) {
    errors.push({ entryIndex: index, field: 'entry', message: 'Entry must be an object' });
    return errors;
  }

  const e = entry as Record<string, unknown>;

  // Required fields
  if (typeof e.lemma !== 'string' || e.lemma.trim() === '') {
    errors.push({ entryIndex: index, field: 'lemma', message: 'lemma is required' });
  }

  if (
    typeof e.part_of_speech !== 'string' ||
    !VALID_PARTS_OF_SPEECH.includes(e.part_of_speech as PartOfSpeech)
  ) {
    errors.push({
      entryIndex: index,
      field: 'part_of_speech',
      message: `part_of_speech must be one of: ${VALID_PARTS_OF_SPEECH.join(', ')}`,
    });
  }

  if (typeof e.translation_en !== 'string' || e.translation_en.trim() === '') {
    errors.push({
      entryIndex: index,
      field: 'translation_en',
      message: 'translation_en is required',
    });
  }

  // Optional field validations
  // translation_ru validation (optional string)
  if (
    e.translation_ru !== undefined &&
    e.translation_ru !== null &&
    typeof e.translation_ru !== 'string'
  ) {
    errors.push({
      entryIndex: index,
      field: 'translation_ru',
      message: 'translation_ru must be a string',
    });
  }

  // pronunciation validation (optional string)
  if (
    e.pronunciation !== undefined &&
    e.pronunciation !== null &&
    typeof e.pronunciation !== 'string'
  ) {
    errors.push({
      entryIndex: index,
      field: 'pronunciation',
      message: 'pronunciation must be a string',
    });
  }

  // examples validation
  if (e.examples !== undefined && e.examples !== null) {
    if (!Array.isArray(e.examples)) {
      errors.push({ entryIndex: index, field: 'examples', message: 'examples must be an array' });
    } else {
      e.examples.forEach((ex: unknown, exIndex: number) => {
        if (typeof ex !== 'object' || ex === null) {
          errors.push({
            entryIndex: index,
            field: `examples[${exIndex}]`,
            message: 'example must be an object',
          });
        } else {
          const example = ex as Record<string, unknown>;
          if (typeof example.greek !== 'string' || example.greek.trim() === '') {
            errors.push({
              entryIndex: index,
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
 * Validate all word entries and return errors
 */
function validateWordEntries(entries: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];

  entries.forEach((entry, index) => {
    errors.push(...validateWordEntry(entry, index));
  });

  return errors;
}

/**
 * Parse JSON input and extract deck_id and word_entries.
 * Requires object format with deck_id and word_entries fields.
 * Rejects bare array format with helpful migration message.
 * Returns detailed syntax error info when parsing fails.
 */
function parseWordEntriesJson(jsonString: string):
  | { success: true; deck_id: string; word_entries: unknown[] }
  | {
      success: false;
      errorKey:
        | 'invalidJson'
        | 'arrayFormatDetected'
        | 'missingDeckId'
        | 'invalidDeckId'
        | 'missingWordEntries';
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

  // Validate word_entries array exists
  if (!Array.isArray(obj.word_entries)) {
    return { success: false, errorKey: 'missingWordEntries' };
  }

  return { success: true, deck_id: obj.deck_id, word_entries: obj.word_entries };
}

/**
 * Calculate preview summary from validated word entries
 */
function calculatePreviewSummary(entries: BulkWordEntryInput[]): PreviewSummary {
  const partOfSpeechCounts = { nouns: 0, verbs: 0, adjectives: 0, adverbs: 0 };
  let entriesWithExamples = 0;

  entries.forEach((entry) => {
    switch (entry.part_of_speech) {
      case 'noun':
        partOfSpeechCounts.nouns++;
        break;
      case 'verb':
        partOfSpeechCounts.verbs++;
        break;
      case 'adjective':
        partOfSpeechCounts.adjectives++;
        break;
      case 'adverb':
        partOfSpeechCounts.adverbs++;
        break;
    }

    if (entry.examples && Array.isArray(entry.examples) && entry.examples.length > 0) {
      entriesWithExamples++;
    }
  });

  return {
    totalEntries: entries.length,
    partOfSpeechCounts,
    entriesWithExamples,
  };
}

// ============================================================================
// Component
// ============================================================================

export const WordEntriesTab: React.FC = () => {
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
      setValidationErrors([{ entryIndex: -1, field: 'json', message: t('wordEntries.noEntries') }]);
      return;
    }

    // Parse JSON and extract deck_id and word_entries
    const parseResult = parseWordEntriesJson(jsonInput);
    if (!parseResult.success) {
      let errorMessage: string;
      if (parseResult.syntaxError) {
        const { message, line, column } = parseResult.syntaxError;
        if (line !== undefined && column !== undefined) {
          errorMessage = t('wordEntries.jsonSyntaxError', { line, column, message });
        } else {
          errorMessage = t('wordEntries.jsonSyntaxErrorNoPosition', { message });
        }
      } else {
        errorMessage = t(`wordEntries.${parseResult.errorKey}`);
      }
      setValidationErrors([{ entryIndex: -1, field: 'json', message: errorMessage }]);
      return;
    }

    const entriesArray = parseResult.word_entries;

    // Check if empty
    if (entriesArray.length === 0) {
      setValidationErrors([{ entryIndex: -1, field: 'json', message: t('wordEntries.noEntries') }]);
      return;
    }

    // Check max entries
    if (entriesArray.length > MAX_ENTRIES) {
      setValidationErrors([
        { entryIndex: -1, field: 'json', message: t('wordEntries.tooManyEntries') },
      ]);
      return;
    }

    // Validate each entry
    const errors = validateWordEntries(entriesArray);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // All valid - calculate preview and store deck_id
    const summary = calculatePreviewSummary(entriesArray as BulkWordEntryInput[]);
    setPreviewSummary(summary);
    setValidatedDeckId(parseResult.deck_id);
    setIsValidated(true);
  }, [jsonInput, t]);

  // ========================================
  // Upload Word Entries
  // ========================================
  const handleUpload = useCallback(async () => {
    if (!isValidated || !validatedDeckId || !previewSummary) return;

    setIsUploading(true);

    try {
      const parseResult = parseWordEntriesJson(jsonInput);
      if (!parseResult.success) return; // Should not happen since validated
      // Cast to the API expected type - validation already verified structure
      const wordEntries = parseResult.word_entries as WordEntryInput[];

      // Call bulk upsert API using deck_id from the validated JSON
      const response = await wordEntryAPI.bulkUpsert(validatedDeckId, wordEntries);

      // Show success toast with upsert counts
      toast({
        title: t('wordEntries.successToast', {
          created: response.created_count,
          updated: response.updated_count,
        }),
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
        title: t('wordEntries.errorToast'),
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
    <div className="space-y-6" data-testid="word-entries-tab">
      <Card>
        <CardHeader>
          <CardTitle>{t('wordEntries.title')}</CardTitle>
          <CardDescription>{t('wordEntries.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* JSON Textarea */}
          <div className="space-y-2">
            <Label htmlFor="word-entries-json-textarea">{t('wordEntries.jsonLabel')}</Label>
            <Textarea
              id="word-entries-json-textarea"
              data-testid="word-entries-json-textarea"
              value={jsonInput}
              onChange={handleJsonChange}
              placeholder={JSON_PLACEHOLDER}
              className="min-h-[300px] font-mono text-sm"
              disabled={isUploading}
            />
            <p className="text-sm text-muted-foreground">{t('wordEntries.maxEntriesWarning')}</p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive" data-testid="word-entries-errors">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">{t('wordEntries.validationErrors')}</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>
                        {error.entryIndex >= 0 ? (
                          <>
                            <strong>Entry {error.entryIndex + 1}</strong> - {error.field}:{' '}
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
              data-testid="word-entries-preview"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    {t('wordEntries.previewTitle')}
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('wordEntries.totalEntries')}
                      </p>
                      <p className="text-lg font-semibold">{previewSummary.totalEntries}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('wordEntries.partOfSpeechBreakdown')}
                      </p>
                      <p className="text-sm">
                        {previewSummary.partOfSpeechCounts.nouns > 0 && (
                          <span className="mr-2">
                            {t('wordEntries.partOfSpeechCounts.nouns')}:{' '}
                            {previewSummary.partOfSpeechCounts.nouns}
                          </span>
                        )}
                        {previewSummary.partOfSpeechCounts.verbs > 0 && (
                          <span className="mr-2">
                            {t('wordEntries.partOfSpeechCounts.verbs')}:{' '}
                            {previewSummary.partOfSpeechCounts.verbs}
                          </span>
                        )}
                        {previewSummary.partOfSpeechCounts.adjectives > 0 && (
                          <span className="mr-2">
                            {t('wordEntries.partOfSpeechCounts.adjectives')}:{' '}
                            {previewSummary.partOfSpeechCounts.adjectives}
                          </span>
                        )}
                        {previewSummary.partOfSpeechCounts.adverbs > 0 && (
                          <span>
                            {t('wordEntries.partOfSpeechCounts.adverbs')}:{' '}
                            {previewSummary.partOfSpeechCounts.adverbs}
                          </span>
                        )}
                        {Object.values(previewSummary.partOfSpeechCounts).every((c) => c === 0) &&
                          '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('wordEntries.withExamples')}
                      </p>
                      <p className="text-lg font-semibold">{previewSummary.entriesWithExamples}</p>
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
              data-testid="word-entries-progress"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('wordEntries.uploadingButton')}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={isUploading || !jsonInput.trim()}
              data-testid="word-entries-validate-button"
            >
              {t('wordEntries.validateButton')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!isValidated || isUploading}
              data-testid="word-entries-upload-button"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('wordEntries.uploadingButton')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('wordEntries.uploadButton')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
