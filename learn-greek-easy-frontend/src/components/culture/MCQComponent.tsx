import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useMCQKeyboardShortcuts } from '@/hooks/useMCQKeyboardShortcuts';
import { trackNewsSourceLinkClicked } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type {
  CultureCategory,
  CultureLanguage,
  CultureQuestionResponse,
  MultilingualText,
} from '@/types/culture';

import { AnswerOption, type OptionLetter } from './AnswerOption';
import { CultureBadge } from './CultureBadge';
import { ExplanationCard } from './ExplanationCard';
import { SourceImage } from './SourceImage';
import { WaveformPlayer } from './WaveformPlayer';

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
  /** Deck category for CategoryBadge display */
  category?: CultureCategory;
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
  showFeedback = false,
  onNext,
  isLastQuestion,
  answerResult,
  category,
  hasAudio = false,
}) => {
  const { t } = useTranslation('culture');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const prevQuestionIdRef = useRef<string | null>(null);

  // Reset selection when question ID actually changes (not just object reference)
  useEffect(() => {
    if (prevQuestionIdRef.current !== null && prevQuestionIdRef.current !== question.id) {
      setSelectedOption(null);
      setIsSubmitted(false);
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
      if (!disabled && !isSubmitted && option >= 1 && option <= question.option_count) {
        setSelectedOption(option);
      }
    },
    [disabled, isSubmitted, question.option_count]
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (isSubmitted) return;
    if (selectedOption !== null && !disabled) {
      if (showFeedback) {
        setIsSubmitted(true);
      }
      onAnswer(selectedOption);
    }
  }, [selectedOption, disabled, isSubmitted, showFeedback, onAnswer]);

  // Handle next
  const handleNext = useCallback(() => {
    setSelectedOption(null);
    setIsSubmitted(false);
    onNext?.();
  }, [onNext]);

  // Keyboard shortcuts
  useMCQKeyboardShortcuts({
    onSelectOption: handleSelectOption,
    onSubmit: handleSubmit,
    canSubmit: selectedOption !== null && !isSubmitted,
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

  // Derive correctAnswer for ExplanationCard
  const correctAnswerForExplanation = answerResult
    ? {
        label: OPTION_LETTERS[answerResult.correctOption - 1],
        text: getLocalizedText(question.options[answerResult.correctOption - 1], language),
      }
    : undefined;

  return (
    <div
      className="w-full max-w-2xl"
      role="group"
      aria-labelledby={questionId}
      data-testid="mcq-component"
    >
      {/* Card shell - visual container */}
      <div className="rounded-[20px] border-[1.5px] border-slate-200 bg-white px-[22px] pt-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_20px_rgba(0,0,0,0.04)]">
        {/* Inner content area with vertical spacing */}
        <div className="flex flex-col space-y-4">
          {/* Badge row - category */}
          {category && (
            <div className="flex items-start" data-testid="mcq-badge-row">
              <CultureBadge category={category} />
            </div>
          )}

          {/* Progress indicator - KEEP EXACTLY AS-IS */}
          {questionNumber !== undefined && totalQuestions !== undefined && (
            <p className="text-sm font-medium text-muted-foreground" data-testid="mcq-progress">
              {t('mcq.questionOf', { current: questionNumber, total: totalQuestions })}
            </p>
          )}

          {/* Question image - KEEP EXACTLY AS-IS */}
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

          {/* Audio waveform player placeholder */}
          {hasAudio && <WaveformPlayer />}

          {/* Question text - KEEP EXACTLY AS-IS */}
          <h2
            id={questionId}
            className="mb-1 font-cult-serif text-[19px] font-semibold leading-[1.5] tracking-[-0.01em] text-slate-900"
            data-testid="mcq-question-text"
          >
            {questionText}
          </h2>
        </div>
      </div>

      {/* Options section - OUTSIDE the card */}
      <div className="mt-4 space-y-4">
        {/* Answer options - KEEP radiogroup structure EXACTLY */}
        <div
          className="space-y-[10px]"
          role="radiogroup"
          aria-label={t('mcq.selectAnswer')}
          data-testid="mcq-options"
        >
          {question.options.map((option, index) => {
            const optionNumber = index + 1;
            const letter = OPTION_LETTERS[index];
            const optionText = getLocalizedText(option, language);

            // Compute result props when in feedback mode and submitted
            const resultProps =
              showFeedback && answerResult && isSubmitted
                ? {
                    isCorrect: optionNumber === answerResult.correctOption,
                    isSelectedIncorrect:
                      optionNumber === selectedOption &&
                      optionNumber !== answerResult.correctOption,
                  }
                : {};

            return (
              <AnswerOption
                key={`option-${index}`}
                letter={letter}
                text={optionText}
                isSelected={selectedOption === optionNumber}
                onClick={() => handleSelectOption(optionNumber)}
                disabled={disabled}
                aria-describedby={keyboardHintId}
                submitted={isSubmitted}
                keyboardHintNumber={optionNumber}
                showKeyboardHint={!isSubmitted}
                {...resultProps}
              />
            );
          })}
        </div>

        {/* Explanation card (practice mode only) */}
        {showFeedback && isSubmitted && answerResult && (
          <ExplanationCard
            isCorrect={answerResult.isCorrect}
            explanationText={answerResult.explanationText}
            correctAnswer={correctAnswerForExplanation}
            sourceArticleUrl={question.original_article_url}
            cardId={question.id}
            className="mt-3"
          />
        )}

        {/* Keyboard hint - KEEP EXACTLY */}
        <p
          id={keyboardHintId}
          className="text-center text-sm text-muted-foreground"
          data-testid="mcq-keyboard-hint"
        >
          {t('mcq.keyboardHintDynamic', { max: question.option_count })}
        </p>

        {/* Submit / Next button */}
        <div className="flex justify-center pt-2">
          {showFeedback && isSubmitted ? (
            <button
              type="button"
              onClick={handleNext}
              className="w-full max-w-[280px] rounded-xl bg-indigo-500 px-6 py-2.5 font-medium text-white shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="mcq-next-button"
            >
              {isLastQuestion ? t('mcq.seeResults') : t('mcq.nextQuestion')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedOption === null || disabled}
              aria-disabled={selectedOption === null || disabled}
              className={cn(
                'w-full max-w-[280px] rounded-xl px-6 py-2.5 font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selectedOption !== null && !disabled
                  ? 'cursor-pointer bg-indigo-500 text-white shadow-[0_0_0_3px_rgba(99,102,241,0.15)] hover:bg-indigo-600'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              )}
              data-testid="mcq-submit-button"
            >
              {t('mcq.submitAnswer')}
            </button>
          )}
        </div>

        {/* Helper text - KEEP EXACTLY */}
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
      </div>
    </div>
  );
};
