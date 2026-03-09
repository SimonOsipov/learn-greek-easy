// src/components/culture/QuestionCard.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { STATUS_DOT_CLASS, STATUS_TO_MASTERY } from '@/components/shared/cardStatusColors';
import { MasteryDots } from '@/components/shared/MasteryDots';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CultureQuestionBrowseItem } from '@/types/culture';

// ============================================
// Types
// ============================================

export interface QuestionCardProps {
  question: CultureQuestionBrowseItem;
  /** Override language for question text display. Falls back to i18n.language when omitted. */
  language?: string;
  /** Callback when card is clicked. Receives the question ID. */
  onClick?: (questionId: string) => void;
}

// ============================================
// Helper: getLocalizedText (mirrors MCQComponent pattern)
// ============================================

function getLocalizedText(text: { el: string; en: string; ru: string }, language: string): string {
  const lang = language as 'el' | 'en' | 'ru';
  const localized = text[lang];
  if (!localized || localized.trim() === '') {
    return text.en || '';
  }
  return localized;
}

// ============================================
// QuestionCardSkeleton
// ============================================

export const QuestionCardSkeleton: React.FC = () => {
  return (
    <Card data-testid="question-card-skeleton" className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="absolute left-3 top-3">
          <Skeleton className="h-4 w-6" />
        </div>
        <div className="absolute right-3 top-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
        </div>
        <div className="flex flex-col items-center space-y-2 pt-6 text-center">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex w-full items-center justify-between pt-2">
            <Skeleton className="h-3 w-16" />
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-2 w-2 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

QuestionCardSkeleton.displayName = 'QuestionCardSkeleton';

// ============================================
// QuestionCard Component
// ============================================

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, language, onClick }) => {
  const { t, i18n } = useTranslation('culture');
  const lang = language ?? i18n.language;

  const questionText = getLocalizedText(question.question_text, lang);
  const questionNumber = question.order_index + 1;
  const filled = STATUS_TO_MASTERY[question.status];
  const dotClass = STATUS_DOT_CLASS[question.status];

  const isClickable = !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(question.id);
    }
  };

  return (
    <Card
      data-testid="question-card"
      className={cn(
        'relative overflow-hidden',
        isClickable && 'cursor-pointer hover:border-primary/30'
      )}
      onClick={isClickable ? () => onClick(question.id) : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? questionText : undefined}
    >
      <CardContent className="p-4">
        {/* Top-left: question number */}
        <span
          data-testid="question-card-number"
          className="absolute left-3 top-3 text-xs font-medium text-muted-foreground"
        >
          #{questionNumber}
        </span>

        {/* Top-right: status dot */}
        <div
          data-testid="question-card-status-dot"
          className={cn('absolute right-3 top-3 h-2.5 w-2.5 rounded-full', dotClass)}
          aria-label={`Status: ${question.status}`}
        />

        {/* Center: question text */}
        <p
          data-testid="question-card-text"
          className="line-clamp-2 pt-6 text-center text-sm text-foreground"
        >
          {questionText}
        </p>

        {/* Bottom row: option count + mastery dots */}
        <div className="mt-3 flex items-center justify-between">
          <span data-testid="question-card-options" className="text-xs text-muted-foreground">
            {t('deck.options', { count: question.option_count })}
          </span>
          <MasteryDots filled={filled} />
        </div>
      </CardContent>
    </Card>
  );
};

QuestionCard.displayName = 'QuestionCard';
