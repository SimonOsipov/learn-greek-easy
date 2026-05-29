import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

const LANG_OPTIONS: { code: CultureLanguage; label: string; ariaLabel: string }[] = [
  { code: 'el', label: 'EL', ariaLabel: 'Greek' },
  { code: 'en', label: 'EN', ariaLabel: 'English' },
  { code: 'ru', label: 'RU', ariaLabel: 'Russian' },
];

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
          'max-h-[85vh] overflow-y-auto sm:max-w-[580px]',
          'max-sm:h-full max-sm:max-h-full max-sm:rounded-none max-sm:border-0',
          'flex flex-col gap-[18px] p-[26px_28px]'
        )}
      >
        {/* ── Modal top: #id + category kicker ── */}
        <div className="cx-modal-top">
          {data && <span>#{data.order_index + 1}</span>}
          {category && <CultureBadge category={category} showLabel />}
        </div>

        {/* ── Title (DialogTitle for a11y) ── */}
        <DialogTitle className="cx-modal-h">{t('questionDetail.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('questionDetail.title')}</DialogDescription>

        {/* ── Loading skeleton ── */}
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

        {/* ── Error state ── */}
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

        {/* ── Loaded content ── */}
        {data &&
          (() => {
            const showLevelToggle = !!(data.audio_url || data.audio_a2_url);
            const effectiveAudioUrl =
              newsLevel === 'a2' && data.audio_a2_url
                ? data.audio_a2_url
                : (data.audio_url ?? data.audio_a2_url ?? null);

            return (
              <>
                {/* Tag row: A2/B2 toggles + separator + language pills */}
                <div className="cx-modal-tags">
                  {showLevelToggle && (
                    <>
                      {(['a2', 'b2'] as NewsLevel[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          className={cn('cx-modal-tag', newsLevel === lv && 'is-active')}
                          onClick={() => handleLevelChange(lv)}
                          data-testid={`detail-level-toggle-${lv}`}
                        >
                          {lv.toUpperCase()}
                        </button>
                      ))}
                      <span className="cx-modal-tags-sep" aria-hidden="true" />
                    </>
                  )}
                  {LANG_OPTIONS.map(({ code, label, ariaLabel }) => (
                    <button
                      key={code}
                      type="button"
                      className={cn('cx-modal-tag', lang === code && 'is-active')}
                      onClick={() => setLang(code)}
                      aria-pressed={lang === code}
                      aria-label={ariaLabel}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Question text */}
                <p
                  className="cx-modal-q"
                  lang={lang === 'el' ? 'el' : undefined}
                  data-testid="question-detail-text"
                >
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

                {/* Audio — real WaveformPlayer kept as-is */}
                {effectiveAudioUrl && (
                  <div data-testid="question-detail-audio">
                    <WaveformPlayer audioUrl={effectiveAudioUrl} />
                  </div>
                )}

                {/* Answer options */}
                <div className="cx-modal-options">
                  {data.options.map((option, index) => {
                    const isCorrect = index === data.correct_option - 1;
                    const letter = String.fromCharCode(65 + index); // A, B, C, D

                    return (
                      <div
                        key={index}
                        data-testid={`option-${index}`}
                        className={cn(
                          'cx-modal-option',
                          isCorrect
                            ? 'is-correct border-practice-correct bg-practice-correct-soft'
                            : ''
                        )}
                      >
                        <span className="cx-modal-option-k">{letter}.</span>
                        <span>{getLocalizedText(option, lang)}</span>
                        {isCorrect && (
                          <span className="cx-modal-option-check" aria-hidden="true">
                            <Check className="h-[18px] w-[18px]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* News source link */}
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

                {/* Also in decks */}
                {data.also_in_decks.length > 0 && (
                  <div data-testid="question-detail-also-in-decks" className="cx-modal-alsoin">
                    <span className="cx-modal-alsoin-l">{t('questionDetail.alsoInDecks')}:</span>
                    <span className="cx-modal-alsoin-chips">
                      {data.also_in_decks.map((deck) => (
                        <Link
                          key={deck.id}
                          to={`/culture/decks/${deck.id}`}
                          className="cx-modal-alsoin-chip"
                        >
                          {deck.name}
                        </Link>
                      ))}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
};

QuestionDetailDialog.displayName = 'QuestionDetailDialog';
