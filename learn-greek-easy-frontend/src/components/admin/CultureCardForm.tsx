/**
 * CultureCardForm - Shared form for creating/editing culture questions.
 *
 * Features:
 * - Language tabs (RU | EL | EN) with red dot indicators for incomplete tabs
 * - Question textarea per language
 * - 2-4 answer fields with correct answer radio selection
 * - Delete buttons for removing answers (min 2 required)
 * - Dirty state tracking via onDirtyChange callback
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  AdminCultureQuestion,
  CultureQuestionCreatePayload,
  MultilingualName,
} from '@/services/adminAPI';

// ============================================
// Types and Constants
// ============================================

type Language = 'ru' | 'el' | 'en';
type AnswerKey = 'A' | 'B' | 'C' | 'D';

const LANGUAGES: Language[] = ['ru', 'el', 'en'];
const LANGUAGE_LABELS: Record<Language, string> = {
  ru: 'RU',
  el: 'EL',
  en: 'EN',
};

const ANSWER_KEYS: AnswerKey[] = ['A', 'B', 'C', 'D'];
const MIN_ANSWERS = 2;
const MAX_ANSWERS = 4;

// ============================================
// Form Schema
// ============================================

const multilingualSchema = z.object({
  ru: z.string().min(1, 'Russian text is required'),
  el: z.string().min(1, 'Greek text is required'),
  en: z.string().min(1, 'English text is required'),
});

const optionalMultilingualSchema = z
  .object({
    ru: z.string(),
    el: z.string(),
    en: z.string(),
  })
  .nullable();

const formSchema = z
  .object({
    question: multilingualSchema,
    option_a: multilingualSchema,
    option_b: multilingualSchema,
    option_c: optionalMultilingualSchema,
    option_d: optionalMultilingualSchema,
    correct_option: z.number().min(1).max(4),
    answer_count: z.number().min(MIN_ANSWERS).max(MAX_ANSWERS),
  })
  .superRefine((data, ctx) => {
    // Validate that all active answers are filled
    const activeAnswers = ANSWER_KEYS.slice(0, data.answer_count);

    for (const key of activeAnswers) {
      const optionKey = `option_${key.toLowerCase()}` as keyof typeof data;
      const option = data[optionKey] as MultilingualName | null;

      if (!option) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Answer ${key} is required`,
          path: [optionKey],
        });
        continue;
      }

      for (const lang of LANGUAGES) {
        if (!option[lang]?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${LANGUAGE_LABELS[lang]} text is required for answer ${key}`,
            path: [optionKey, lang],
          });
        }
      }
    }

    // Validate correct_option is within range
    if (data.correct_option > data.answer_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct answer must be within available options',
        path: ['correct_option'],
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

// ============================================
// Props Interface
// ============================================

export interface CultureCardFormProps {
  initialData?: AdminCultureQuestion;
  onSubmit: (data: CultureQuestionCreatePayload) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  deckId?: string;
  isSubmitting?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function createEmptyMultilingual(): MultilingualName {
  return { ru: '', el: '', en: '' };
}

function recordToMultilingual(record: Record<string, string> | null): MultilingualName | null {
  if (!record) return null;
  return {
    ru: record.ru || '',
    el: record.el || '',
    en: record.en || '',
  };
}

function getInitialFormData(initialData?: AdminCultureQuestion): FormData {
  if (!initialData) {
    return {
      question: createEmptyMultilingual(),
      option_a: createEmptyMultilingual(),
      option_b: createEmptyMultilingual(),
      option_c: null,
      option_d: null,
      correct_option: 1,
      answer_count: 2,
    };
  }

  // Count active answers
  let answerCount = 2;
  if (initialData.option_c) answerCount = 3;
  if (initialData.option_d) answerCount = 4;

  return {
    question: recordToMultilingual(initialData.question_text) || createEmptyMultilingual(),
    option_a: recordToMultilingual(initialData.option_a) || createEmptyMultilingual(),
    option_b: recordToMultilingual(initialData.option_b) || createEmptyMultilingual(),
    option_c: recordToMultilingual(initialData.option_c),
    option_d: recordToMultilingual(initialData.option_d),
    correct_option: initialData.correct_option,
    answer_count: answerCount,
  };
}

// ============================================
// Component
// ============================================

export function CultureCardForm({
  initialData,
  onSubmit,
  onDirtyChange,
  deckId,
  isSubmitting = false,
}: CultureCardFormProps) {
  const [activeTab, setActiveTab] = useState<Language>('ru');

  const defaultValues = useMemo(() => getInitialFormData(initialData), [initialData]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Watch form values for validation indicators
  const watchedValues = useWatch({ control });
  const answerCount = watchedValues.answer_count ?? defaultValues.answer_count;
  const correctOption = watchedValues.correct_option ?? defaultValues.correct_option;

  // Reset form when initialData changes
  useEffect(() => {
    reset(getInitialFormData(initialData));
  }, [initialData, reset]);

  // Track dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Check if a language tab has incomplete fields
  const isTabIncomplete = useCallback(
    (lang: Language): boolean => {
      const question = watchedValues.question;
      if (!question?.[lang]?.trim()) return true;

      const activeAnswers = ANSWER_KEYS.slice(0, answerCount);
      for (const key of activeAnswers) {
        const optionKey = `option_${key.toLowerCase()}` as keyof FormData;
        const option = watchedValues[optionKey] as MultilingualName | null;
        if (!option?.[lang]?.trim()) return true;
      }

      return false;
    },
    [watchedValues, answerCount]
  );

  // Add answer handler
  const handleAddAnswer = useCallback(() => {
    if (answerCount >= MAX_ANSWERS) return;

    const newCount = answerCount + 1;
    setValue('answer_count', newCount, { shouldDirty: true });

    // Initialize the new answer option
    const newKey = ANSWER_KEYS[newCount - 1];
    const optionKey = `option_${newKey.toLowerCase()}` as 'option_c' | 'option_d';
    setValue(optionKey, createEmptyMultilingual(), { shouldDirty: true });
  }, [answerCount, setValue]);

  // Delete answer handler
  const handleDeleteAnswer = useCallback(
    (index: number) => {
      if (answerCount <= MIN_ANSWERS) return;

      const deletedKey = ANSWER_KEYS[index];
      const deletedOptionNum = index + 1;

      // If we're deleting C and D exists, shift D to C
      if (deletedKey === 'C' && answerCount === 4) {
        const optionD = watchedValues.option_d;
        setValue('option_c', optionD, { shouldDirty: true });
        setValue('option_d', null, { shouldDirty: true });

        // Adjust correct option if needed
        if (correctOption === 4) {
          setValue('correct_option', 3, { shouldDirty: true });
        }
      } else {
        // Clear the deleted option
        const optionKey = `option_${deletedKey.toLowerCase()}` as 'option_c' | 'option_d';
        setValue(optionKey, null, { shouldDirty: true });
      }

      // Clear correct option if it was the deleted answer
      if (correctOption === deletedOptionNum) {
        setValue('correct_option', 0 as 1 | 2 | 3 | 4, { shouldDirty: true });
      } else if (correctOption > deletedOptionNum && deletedKey === 'C' && answerCount === 4) {
        // If we shifted D to C, adjust correct option
        setValue('correct_option', (correctOption - 1) as 1 | 2 | 3 | 4, { shouldDirty: true });
      }

      setValue('answer_count', answerCount - 1, { shouldDirty: true });
    },
    [answerCount, correctOption, watchedValues.option_d, setValue]
  );

  // Form submission handler
  const handleFormSubmit = async (data: FormData) => {
    if (!deckId && !initialData) {
      // Silently return - this should be prevented by the parent component
      return;
    }

    const payload: CultureQuestionCreatePayload = {
      deck_id: deckId || initialData?.id || '',
      question_text: data.question,
      option_a: data.option_a,
      option_b: data.option_b,
      option_c: data.answer_count >= 3 ? data.option_c : null,
      option_d: data.answer_count >= 4 ? data.option_d : null,
      correct_option: data.correct_option as 1 | 2 | 3 | 4,
    };

    await onSubmit(payload);
  };

  // Get option value for rendering
  const getOptionValue = (key: AnswerKey, lang: Language): string => {
    const optionKey = `option_${key.toLowerCase()}` as keyof FormData;
    const option = watchedValues[optionKey] as MultilingualName | null;
    return option?.[lang] || '';
  };

  // Check if option has error
  const hasOptionError = (key: AnswerKey, lang: Language): boolean => {
    const optionKey = `option_${key.toLowerCase()}` as keyof typeof errors;
    const optionErrors = errors[optionKey];
    if (!optionErrors) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(optionErrors as any)?.[lang];
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      data-testid="culture-card-form"
    >
      {/* Language Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActiveTab(lang)}
            data-testid={`lang-tab-${lang}`}
            className={cn(
              'relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === lang ? 'bg-background shadow' : 'hover:bg-background/50'
            )}
          >
            {LANGUAGE_LABELS[lang]}
            {isTabIncomplete(lang) && (
              <span
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"
                data-testid={`lang-tab-${lang}-incomplete`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {LANGUAGES.map((lang) => (
        <div key={lang} className={cn('space-y-6', activeTab !== lang && 'hidden')}>
          {/* Question Field */}
          <div className="space-y-2">
            <Label htmlFor={`question-${lang}`}>Question ({LANGUAGE_LABELS[lang]})</Label>
            <Textarea
              id={`question-${lang}`}
              {...register(`question.${lang}`)}
              placeholder={`Enter question in ${LANGUAGE_LABELS[lang]}`}
              rows={3}
              data-testid={`question-input-${lang}`}
              className={cn(errors.question?.[lang] && 'border-destructive')}
            />
            {errors.question?.[lang] && (
              <p className="text-sm text-destructive">Question is required</p>
            )}
          </div>

          {/* Answer Fields */}
          <div className="space-y-4">
            <Label>Answers ({LANGUAGE_LABELS[lang]})</Label>

            {ANSWER_KEYS.slice(0, answerCount).map((key, index) => {
              const optionNum = index + 1;
              const canDelete = answerCount > MIN_ANSWERS;

              return (
                <div key={key} className="flex items-start gap-3">
                  {/* Radio for correct answer */}
                  <div className="flex items-center pt-2">
                    <input
                      type="radio"
                      name={`correct-answer-${lang}`}
                      value={optionNum}
                      checked={correctOption === optionNum}
                      onChange={() => {
                        setValue('correct_option', optionNum as 1 | 2 | 3 | 4, {
                          shouldDirty: true,
                        });
                      }}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      data-testid={`correct-radio-${key}-${lang}`}
                      aria-label={`Mark answer ${key} as correct`}
                    />
                  </div>

                  {/* Answer label */}
                  <span className="w-6 pt-2 text-sm font-medium text-muted-foreground">{key}.</span>

                  {/* Answer input */}
                  <div className="flex-1">
                    <Input
                      {...register(`option_${key.toLowerCase()}.${lang}` as keyof FormData)}
                      placeholder={`Answer ${key}`}
                      data-testid={`answer-input-${key}-${lang}`}
                      className={cn(hasOptionError(key, lang) && 'border-destructive')}
                      value={getOptionValue(key, lang)}
                      onChange={(e) => {
                        type OptionKey = 'option_a' | 'option_b' | 'option_c' | 'option_d';
                        const optKey = `option_${key.toLowerCase()}` as OptionKey;
                        const currentOption = watchedValues[optKey] as MultilingualName | null;
                        setValue(
                          optKey,
                          {
                            ...(currentOption || createEmptyMultilingual()),
                            [lang]: e.target.value,
                          },
                          { shouldDirty: true, shouldValidate: true }
                        );
                      }}
                    />
                  </div>

                  {/* Delete button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAnswer(index)}
                    disabled={!canDelete}
                    className={cn(
                      'h-10 w-10 shrink-0',
                      !canDelete && 'cursor-not-allowed opacity-50'
                    )}
                    data-testid={`delete-answer-${key}`}
                    aria-label={`Delete answer ${key}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {/* Add Answer Button */}
            {answerCount < MAX_ANSWERS && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAnswer}
                className="w-full"
                data-testid="add-answer-btn"
              >
                Add Answer {ANSWER_KEYS[answerCount]}
              </Button>
            )}

            {/* Correct answer validation error */}
            {errors.correct_option && (
              <p className="text-sm text-destructive">Please select a correct answer</p>
            )}
          </div>
        </div>
      ))}

      {/* Submit Button - only shown if not controlled externally */}
      {!isSubmitting && deckId && (
        <Button type="submit" className="w-full" data-testid="submit-btn">
          Save Question
        </Button>
      )}
    </form>
  );
}

export default CultureCardForm;
