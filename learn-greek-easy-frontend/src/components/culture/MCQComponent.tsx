import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useMCQKeyboardShortcuts } from '@/hooks/useMCQKeyboardShortcuts';
import { trackNewsSourceLinkClicked } from '@/lib/analytics';
import type { CultureLanguage, CultureQuestionResponse, MultilingualText } from '@/types/culture';

import { AnswerOption, type OptionLetter } from './AnswerOption';
import { SourceImage } from './SourceImage';

export interface MCQComponentProps {
  /** The question data to display */
  question: CultureQuestionResponse;
  /** Current language for display */
  language: CultureLanguage;
  /** Callback when user submits an answer (1-4) */
  onAnswer: (selectedOption: number) => void;
  /** Current question number (1-indexed) */
  questionNumber?: number;
  /** Total number of questions in the session */
  totalQuestions?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether to display inline feedback after answer submission @default false */
  showFeedback?: boolean;
  /** Callback to advance to next question (used when showFeedback is true) */
  onNext?: () => void;
  /** Whether this is the last question - changes next-button label */
  isLastQuestion?: boolean;
  /** Answer result data for inline feedback display */
  answerResult?: {
    isCorrect: boolean;
    correctOption: number;
    explanationText?: string;
  };
  /** Whether the question has associated audio content */
  hasAudio?: boolean;
}

/** Maps option index (0-3) to letter (A-D) */
const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D'];

/**
 * Gets text in the specified language with fallback to English
 */
function getLocalizedText(text: MultilingualText, language: CultureLanguage): string {
  const localizedText = text[language];
  // Fallback to English if the localized text is empty or undefined
  if (!localizedText || localizedText.trim() === '') {
    return text.en || '';
  }
  return localizedText;
}

/**
 * Multiple Choice Question Component for culture exam practice.
 *
 * Features:
 * - Display question text in selected language with fallback to English
 * - Render 4 answer options (A, B, C, D)
 * - Lazy load image when image_url is provided
 * - Submit button disabled until option selected
 * - Keyboard shortcuts via useMCQKeyboardShortcuts hook
 * - Progress indicator (Question X of Y)
 * - Accessible with ARIA labels and keyboard navigation
 */
export const MCQComponent: React.FC<MCQComponentProps> = ({
  question,
  language,
  onAnswer,
  questionNumber,
  totalQuestions,
  disabled = false,
}) => {
  const { t } = useTranslation('culture');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const prevQuestionIdRef = useRef<string | null>(null);

  // Reset selection when question ID actually changes (not just object reference)
  useEffect(() => {
    if (prevQuestionIdRef.current !== null && prevQuestionIdRef.current !== question.id) {
      setSelectedOption(null);
    }
    prevQuestionIdRef.current = question.id;
  }, [question.id]);

  // Get localized question text
  const questionText = getLocalizedText(question.question_text, language);

  // Generate unique ID for accessibility
  const questionId = `mcq-question-${question.id}`;
  const keyboardHintId = `mcq-keyboard-hint-${question.id}`;

  // Handle option selection (1 to option_count)
  const handleSelectOption = useCallback(
    (option: number) => {
      if (!disabled && option >= 1 && option <= question.option_count) {
        setSelectedOption(option);
      }
    },
    [disabled, question.option_count]
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (selectedOption !== null && !disabled) {
      onAnswer(selectedOption);
    }
  }, [selectedOption, disabled, onAnswer]);

  // Keyboard shortcuts
  useMCQKeyboardShortcuts({
    onSelectOption: handleSelectOption,
    onSubmit: handleSubmit,
    canSubmit: selectedOption !== null,
    disabled,
    optionCount: question.option_count,
  });

  // Handle source article link click - track analytics
  const handleSourceLinkClick = useCallback(() => {
    const sourceUrl = question.original_article_url;
    if (!sourceUrl) return;

    let domain = 'unknown';
    try {
      domain = new URL(sourceUrl).hostname;
    } catch {
      // URL parsing failed, use fallback
    }

    trackNewsSourceLinkClicked({
      card_id: question.id,
      article_domain: domain,
    });
  }, [question.id, question.original_article_url]);

  return (
    <Card
      className="w-full max-w-2xl"
      role="group"
      aria-labelledby={questionId}
      data-testid="mcq-component"
    >
      <CardHeader className="space-y-4">
        {/* Progress indicator */}
        {questionNumber !== undefined && totalQuestions !== undefined && (
          <p className="text-sm font-medium text-muted-foreground" data-testid="mcq-progress">
            {t('mcq.questionOf', { current: questionNumber, total: totalQuestions })}
          </p>
        )}

        {/* Question image with source attribution */}
        {question.image_url && (
          <SourceImage
            imageUrl={question.image_url}
            sourceUrl={
              question.original_article_url?.startsWith('http')
                ? question.original_article_url
                : undefined
            }
            onSourceClick={handleSourceLinkClick}
          />
        )}

        {/* Question text */}
        <h2
          id={questionId}
          className="text-xl font-semibold text-foreground"
          data-testid="mcq-question-text"
        >
          {questionText}
        </h2>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Answer options */}
        <div
          className="space-y-3"
          role="radiogroup"
          aria-label={t('mcq.selectAnswer')}
          data-testid="mcq-options"
        >
          {question.options.map((option, index) => {
            const optionNumber = index + 1;
            const letter = OPTION_LETTERS[index];
            const optionText = getLocalizedText(option, language);

            return (
              <AnswerOption
                key={`option-${index}`}
                letter={letter}
                text={optionText}
                isSelected={selectedOption === optionNumber}
                onClick={() => handleSelectOption(optionNumber)}
                disabled={disabled}
                aria-describedby={keyboardHintId}
                keyboardHintNumber={index + 1}
              />
            );
          })}
        </div>

        {/* Keyboard hint */}
        <p
          id={keyboardHintId}
          className="text-center text-sm text-muted-foreground"
          data-testid="mcq-keyboard-hint"
        >
          {t('mcq.keyboardHintDynamic', { max: question.option_count })}
        </p>

        {/* Submit button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={handleSubmit}
            disabled={selectedOption === null || disabled}
            aria-disabled={selectedOption === null || disabled}
            className="min-w-[200px]"
            data-testid="mcq-submit-button"
          >
            {t('mcq.submitAnswer')}
          </Button>
        </div>

        {/* Helper text when no option selected */}
        {selectedOption === null && !disabled && (
          <p
            className="text-center text-sm text-warning"
            role="status"
            aria-live="polite"
            data-testid="mcq-select-hint"
          >
            {t('mcq.selectAnswer')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
