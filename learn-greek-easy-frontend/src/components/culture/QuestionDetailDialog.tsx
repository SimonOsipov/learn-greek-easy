import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { QuestionLanguageSelector } from '@/components/shared/QuestionLanguageSelector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureLanguage } from '@/types/culture';
import { getPersistedNewsLevel, setPersistedNewsLevel, type NewsLevel } from '@/utils/newsLevel';

import { CultureBadge } from './CultureBadge';
import { SourceImage } from './SourceImage';
import { WaveformPlayer } from './WaveformPlayer';

import type { CultureCategory } from './CultureBadge';

// ============================================
// Types
// ============================================

export interface QuestionDetailDialogProps {
  questionId: string | null;
  deckId: string;
  category?: CultureCategory;
  onClose: () => void;
}

// ============================================
// Helper
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
// QuestionDetailDialog Component
// ============================================

export const QuestionDetailDialog: React.FC<QuestionDetailDialogProps> = ({
  questionId,
  deckId,
  category,
  onClose,
}) => {
  const { t } = useTranslation(['culture', 'common']);
  const [lang, setLang] = useState<CultureLanguage>('en');
  const [newsLevel, setNewsLevelState] = useState<NewsLevel>(getPersistedNewsLevel);

  const handleLevelChange = (level: NewsLevel) => {
    setNewsLevelState(level);
    setPersistedNewsLevel(level);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cultureQuestionDetail', questionId],
    queryFn: () => cultureDeckAPI.getQuestionDetail(questionId ?? ''),
    enabled: !!questionId,
    staleTime: 5 * 60 * 1000,
  });

  // Analytics
  useEffect(() => {
    if (data && questionId) {
      track('culture_question_detail_viewed', {
        question_id: questionId,
        deck_id: deckId,
        question_status: data.status,
      });
    }
  }, [data, questionId, deckId]);

  return (
    <Dialog open={!!questionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[85vh] overflow-y-auto sm:max-w-lg',
          'max-sm:h-full max-sm:max-h-full max-sm:rounded-none max-sm:border-0'
        )}
      >
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-sm font-medium text-muted-foreground">
                #{data.order_index + 1}
              </span>
            )}
            {category && <CultureBadge category={category} showLabel />}
          </div>
          <DialogTitle>{t('questionDetail.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('questionDetail.title')}</DialogDescription>
        </DialogHeader>

        {/* Content */}
        {isLoading && (
          <div data-testid="question-detail-skeleton" className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p data-testid="question-detail-error" className="text-sm text-destructive">
              {t('questionDetail.loadError')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              data-testid="question-detail-retry"
            >
              {t('questionDetail.retry')}
            </Button>
          </div>
        )}

        {data &&
          (() => {
            const showLevelToggle = !!(data.audio_url || data.audio_a2_url);
            const effectiveAudioUrl =
              newsLevel === 'a2' && data.audio_a2_url
                ? data.audio_a2_url
                : (data.audio_url ?? data.audio_a2_url ?? null);
            return (
              <div className="space-y-4">
                {/* Toolbar: level toggle + language selector */}
                <div className="flex items-center gap-2">
                  {showLevelToggle && (
                    <>
                      <div
                        className="flex items-center gap-1"
                        aria-label={t('common:news.level.label', 'Content level')}
                      >
                        <Button
                          variant={newsLevel === 'a2' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleLevelChange('a2')}
                          data-testid="detail-level-toggle-a2"
                        >
                          A2
                        </Button>
                        <Button
                          variant={newsLevel === 'b2' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleLevelChange('b2')}
                          data-testid="detail-level-toggle-b2"
                        >
                          B2
                        </Button>
                      </div>
                      <div className="h-6 w-px bg-border" />
                    </>
                  )}
                  <QuestionLanguageSelector
                    value={lang}
                    onChange={setLang}
                    variant="pill"
                    size="sm"
                  />
                </div>

                {/* Question Text */}
                <p className="text-base font-medium" data-testid="question-detail-text">
                  {getLocalizedText(data.question_text, lang)}
                </p>

                {/* Image */}
                {data.image_url && (
                  <div data-testid="question-detail-image">
                    <SourceImage
                      imageUrl={data.image_url}
                      sourceUrl={data.original_article_url ?? undefined}
                    />
                  </div>
                )}

                {/* Audio */}
                {effectiveAudioUrl && (
                  <div data-testid="question-detail-audio">
                    <WaveformPlayer audioUrl={effectiveAudioUrl} />
                  </div>
                )}

                {/* Answer Options */}
                <div className="space-y-2">
                  {data.options.map((option, index) => {
                    const isCorrect = index === data.correct_option - 1;
                    const letter = String.fromCharCode(65 + index); // A, B, C, D

                    return (
                      <div
                        key={index}
                        data-testid={`option-${index}`}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-3 text-sm',
                          isCorrect
                            ? 'border-practice-correct bg-practice-correct-soft'
                            : 'border-border'
                        )}
                      >
                        <span className="flex-shrink-0 font-medium text-muted-foreground">
                          {letter}.
                        </span>
                        <span className="flex-1">{getLocalizedText(option, lang)}</span>
                        {isCorrect && (
                          <Check className="h-4 w-4 flex-shrink-0 text-practice-correct" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* News Source Link */}
                {data.original_article_url && (
                  <a
                    href={data.original_article_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="question-detail-news-link"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('questionDetail.newsSource')}
                  </a>
                )}

                {/* Also In Decks */}
                {data.also_in_decks.length > 0 && (
                  <div data-testid="question-detail-also-in-decks" className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('questionDetail.alsoInDecks')}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.also_in_decks.map((deck) => (
                        <Link
                          key={deck.id}
                          to={`/culture/decks/${deck.id}`}
                          className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {deck.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
};

QuestionDetailDialog.displayName = 'QuestionDetailDialog';
