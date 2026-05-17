// src/components/admin/decks/CultureQuestionDetail.tsx
//
// Pushed question editor inside the DeckDrawer "Questions" tab.
// Implements DKDR-13 (ADMIN2-09).
//
// Layout:
//   ← Back to all questions | Edit question (H3) | Status Badge
//   CultureCardForm (edit mode via initialData + onSubmit)
//   Footer: [Regenerate translations (disabled)] [Cancel] [Save]
//   News cross-link block (only when original_article_url is set)

import { useEffect, useState, useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CultureCardForm } from '@/components/admin/CultureCardForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { computeCultureChips, isTranslationComplete } from '@/lib/cultureCompleteness';
import {
  adminAPI,
  type AdminCultureQuestion,
  type AdminCultureQuestionsResponse,
  type CultureQuestionCreatePayload,
  type CultureQuestionUpdatePayload,
  type UnifiedDeckItem,
} from '@/services/adminAPI';

import { DeckDrawerSkeleton } from './DeckDrawerSkeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CultureQuestionDetailProps {
  deck: UnifiedDeckItem;
  itemId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Inline domain extraction — per QA #7, extractDomain stays module-private
 * in cultureCompleteness.ts. We duplicate it here rather than export it.
 */
function extractDomainInline(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CultureQuestionDetail({ deck, itemId }: CultureQuestionDetailProps) {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [question, setQuestion] = useState<AdminCultureQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Data lookup ────────────────────────────────────────────────────────────
  //
  // Strategy:
  //   1. Try TanStack Query cache (all cached pages for this deck).
  //   2. On cache miss (e.g. deep-link refresh), fall back to a direct API call.

  useEffect(() => {
    // 1) Scan all cached query entries whose key starts with ['deck-culture', deck.id]
    const cached = queryClient.getQueriesData<AdminCultureQuestionsResponse>({
      queryKey: ['deck-culture', deck.id],
    });

    for (const [, data] of cached) {
      if (!data?.questions) continue;
      const found = data.questions.find((q) => q.id === itemId);
      if (found) {
        setQuestion(found);
        setIsLoading(false);
        return;
      }
    }

    // 2) Fallback fetch — not in cache (deep-link or hard refresh)
    adminAPI
      .listCultureQuestions(deck.id, 1, 50)
      .then((resp) => {
        const found = resp.questions.find((q) => q.id === itemId) ?? null;
        setQuestion(found);
      })
      .finally(() => setIsLoading(false));
  }, [deck.id, itemId, queryClient]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const popToList = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('item');
      p.delete('subtab');
      return p;
    });
  }, [setSearchParams]);

  // ── Save handler ───────────────────────────────────────────────────────────
  //
  // CultureCardForm.onSubmit expects CultureQuestionCreatePayload (create shape).
  // Both create and update payloads share the same field names — correct_option,
  // question_text, option_a/b/c/d — so we map directly.
  // We omit deck_id (update payload doesn't support changing it) and image_key
  // (the form doesn't return it).

  const handleSave = useCallback(
    async (data: CultureQuestionCreatePayload) => {
      setIsSaving(true);
      try {
        const updatePayload: CultureQuestionUpdatePayload = {
          question_text: data.question_text,
          option_a: data.option_a,
          option_b: data.option_b,
          option_c: data.option_c ?? null,
          option_d: data.option_d ?? null,
          correct_option: data.correct_option,
        };
        await adminAPI.updateCultureQuestion(itemId, updatePayload);
        await queryClient.invalidateQueries({ queryKey: ['deck-culture', deck.id] });
      } finally {
        setIsSaving(false);
      }
    },
    [itemId, deck.id, queryClient]
  );

  // ── Derived state ──────────────────────────────────────────────────────────

  const ready = question
    ? (() => {
        const chips = computeCultureChips(question);
        const allOptionsFilled = chips.find((c) => c.name === 'opts')?.color === 'green';
        return isTranslationComplete(question) && allOptionsFilled;
      })()
    : false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4" data-testid="culture-question-detail">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={popToList}
          data-testid="culture-question-detail-back"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('decks.backToAllQuestions')}
        </button>

        <h3 className="text-lg font-medium" data-testid="culture-question-detail-title">
          {t('decks.editQuestion')}
        </h3>

        <Badge
          variant="outline"
          data-testid="culture-question-detail-status"
          className={
            ready
              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }
        >
          {ready ? t('decks.statusReady') : t('decks.statusDraft')}
        </Badge>
      </div>

      {/* ── Form body ── */}
      {isLoading && <DeckDrawerSkeleton variant="detail" />}

      {!isLoading && !question && (
        <div
          data-testid="culture-question-not-found"
          className="flex items-center justify-center p-8 text-muted-foreground"
        >
          Not found
        </div>
      )}

      {!isLoading && question && (
        <>
          {/* News cross-link block */}
          {question.original_article_url && (
            <div className="text-sm" data-testid="culture-question-detail-source">
              <span className="text-muted-foreground">{t('decks.sourcePrefix')}:</span>{' '}
              <span data-testid="culture-question-detail-source-domain">
                {extractDomainInline(question.original_article_url)}
              </span>
              {question.news_item_id && (
                <button
                  type="button"
                  data-testid="culture-question-detail-open-in-news"
                  className="ml-2 underline hover:no-underline"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const p = new URLSearchParams(prev);
                      p.set('tab', 'news');
                      p.set('edit', question.news_item_id!);
                      p.delete('item');
                      p.delete('subtab');
                      return p;
                    });
                  }}
                >
                  → {t('decks.openInNews')}
                </button>
              )}
            </div>
          )}

          <CultureCardForm
            initialData={question}
            onSubmit={handleSave}
            deckId={deck.id}
            isSubmitting={isSaving}
          />

          {/* ── Detail footer (drawer footer-primary is hidden while ?item= present) ── */}
          <div
            className="mt-4 flex items-center justify-end gap-2 border-t pt-4"
            data-testid="culture-question-detail-footer"
          >
            <button
              type="button"
              disabled
              aria-label={t('decks.regenerateTranslations')}
              data-testid="culture-question-detail-regenerate"
              className="cursor-not-allowed text-sm text-muted-foreground opacity-50"
            >
              {t('decks.regenerateTranslations')}
            </button>

            <Button
              type="button"
              variant="outline"
              onClick={popToList}
              data-testid="culture-question-detail-cancel"
            >
              {t('deckEdit.cancel')}
            </Button>

            <Button
              type="submit"
              form="culture-card-form"
              disabled={isSaving}
              data-testid="culture-question-detail-save"
            >
              {t('deckEdit.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
