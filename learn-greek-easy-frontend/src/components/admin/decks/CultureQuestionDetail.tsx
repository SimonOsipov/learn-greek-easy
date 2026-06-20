// src/components/admin/decks/CultureQuestionDetail.tsx
//
// Pushed question editor inside the DeckDrawer "Questions" tab.
// Implements DKDR-13 (ADMIN2-09), migrated to the vocab *EditSection pattern
// (ADMIN2-38-05 / AC-4 b–f): ONE atomic "Question & Answers" Card that starts in
// a read view and flips to a Form-primitive edit form via a header Pencil. The
// only save path is the in-Card Save (CultureCardForm's submit → adminAPI
// .updateCultureQuestion); the old hand-rolled drawer footer + disabled
// Regenerate + duplicate save are gone (the drawer's SidePanel.Footer is
// structurally hidden while ?item= is present — DeckDrawer.tsx:353).
//
// Layout:
//   ← Back to all questions
//   <question text> (text-2xl identity heading)  ·  Status Badge (tone)
//   News cross-link block (only when original_article_url is set)
//   Card "Question & Answers": read view ↔ Pencil → CultureCardForm edit form

import { useEffect, useState, useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CultureCardForm } from '@/components/admin/CultureCardForm';
import { AnswerOption, type OptionLetter } from '@/components/culture/AnswerOption';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  adminAPI,
  type AdminCultureQuestion,
  type AdminCultureQuestionsResponse,
  type CultureQuestionCreatePayload,
  type CultureQuestionUpdatePayload,
  type MultilingualName,
  type UnifiedDeckItem,
} from '@/services/adminAPI';

import { DeckDrawerSkeleton } from './DeckDrawerSkeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CultureQuestionDetailProps {
  deck: UnifiedDeckItem;
  itemId: string;
}

type Language = 'ru' | 'el' | 'en';
// F4 (ADMIN2-39-03): the read-view language switcher shows ONE language at a time,
// ordered Greek → English → Russian (Greek-first per the Round-9 design).
const READ_LANGUAGES: Language[] = ['el', 'en', 'ru'];
const LANGUAGE_LABELS: Record<Language, string> = { ru: 'RU', el: 'EL', en: 'EN' };

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

/**
 * Returns the first non-empty (non-blank) value from the given candidates,
 * trimmed, or '—' if all are empty/null/undefined.
 * Using this instead of `??` prevents empty-string translations from blocking
 * fallback to the next language.
 */
function firstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.find((v) => v?.trim())?.trim() ?? '—';
}

/**
 * Resolve display text for a multilingual question_text record.
 * Fallback chain: en → el → ru → '—' (mirrors CultureDrawerBody.resolveQuestionText).
 */
function resolveQuestionText(question_text: Record<string, string>): string {
  return firstNonEmpty(question_text['en'], question_text['el'], question_text['ru']);
}

/**
 * MultilingualName ({ru,el,en}) → Record<string,string>. Structurally identical;
 * the named interface just lacks an index signature, so we widen it explicitly.
 */
function toRecord(m: MultilingualName | null | undefined): Record<string, string> | null {
  if (!m) return null;
  return { ...m };
}

/** Active option records, in order, skipping unset C/D. */
function activeOptions(question: AdminCultureQuestion): Record<string, string>[] {
  const opts: Record<string, string>[] = [question.option_a, question.option_b];
  if (question.option_c) opts.push(question.option_c);
  if (question.option_d) opts.push(question.option_d);
  return opts;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CultureQuestionDetail({ deck, itemId }: CultureQuestionDetailProps) {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [question, setQuestion] = useState<AdminCultureQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // F4 (ADMIN2-39-03): the read view shows one language at a time; default to Greek.
  const [readLang, setReadLang] = useState<Language>('el');

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

  // ── Read ↔ edit toggle ───────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => setIsEditing(true), []);
  const exitEditMode = useCallback(() => setIsEditing(false), []);

  // ── Save handler ───────────────────────────────────────────────────────────
  //
  // CultureCardForm.onSubmit expects CultureQuestionCreatePayload (create shape).
  // Both create and update payloads share the same field names — correct_option,
  // question_text, option_a/b/c/d — so we map directly.
  // We omit deck_id (update payload doesn't support changing it) and image_key
  // (the form doesn't return it). On success we exit edit mode (back to read).

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
        // Reflect the edit locally so the read view shows the new values.
        // The create-payload fields are MultilingualName (structurally compatible
        // with the question's Record<string,string> shape, just lacking the index
        // signature) — coerce when merging.
        setQuestion((prev) =>
          prev
            ? {
                ...prev,
                question_text: toRecord(data.question_text) ?? prev.question_text,
                option_a: toRecord(data.option_a) ?? prev.option_a,
                option_b: toRecord(data.option_b) ?? prev.option_b,
                option_c: toRecord(data.option_c),
                option_d: toRecord(data.option_d),
                correct_option: data.correct_option,
              }
            : prev
        );
        await queryClient.invalidateQueries({ queryKey: ['deck-culture', deck.id] });
        exitEditMode();
      } finally {
        setIsSaving(false);
      }
    },
    [itemId, deck.id, queryClient, exitEditMode]
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  //
  // F3 (ADMIN2-39-02): the status badge reflects the real backend visibility flag
  // (is_pending_review), NOT a frontend completeness heuristic. Learners see a
  // question only when is_pending_review === false (culture_question_service.py:458,474).

  const isPendingReview = question?.is_pending_review ?? false;

  const headingText = question ? resolveQuestionText(question.question_text) : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4" data-testid="culture-question-detail">
      {/* ── Header (vocab sibling scale) ── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={popToList}
          data-testid="culture-question-detail-back"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('decks.backToAllQuestions')}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="text-2xl font-medium leading-tight"
            data-testid="culture-question-detail-title"
          >
            {headingText}
          </h3>

          <Badge
            tone={isPendingReview ? 'amber' : 'green'}
            data-testid="culture-question-detail-status"
          >
            {isPendingReview ? t('decks.statusPendingReview') : t('decks.statusVisible')}
          </Badge>
        </div>
      </div>

      {/* ── Body ── */}
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

          {/* ── "Question & Answers" Card (read ↔ edit) ── */}
          <Card data-testid="culture-question-edit-card">
            <CardHeader className="px-4 pb-2 pt-4">
              <div className="group flex items-center justify-between">
                <div className="text-sm font-semibold">{t('decks.culture.read.sectionTitle')}</div>
                {!isEditing && (
                  <Button
                    variant="chrome-ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                    onClick={enterEditMode}
                    data-testid="culture-question-edit-btn"
                    aria-label={t('decks.culture.editQuestionLabel')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isEditing ? (
                <div data-testid="culture-question-edit-form">
                  <CultureCardForm
                    initialData={question}
                    onSubmit={handleSave}
                    onCancel={exitEditMode}
                    deckId={deck.id}
                    isSubmitting={isSaving}
                  />
                </div>
              ) : (
                <div className="space-y-4" data-testid="culture-question-read-view">
                  {/* F4: one-language-at-a-time switcher (EL · EN · RU) */}
                  <div
                    className="drawer-tab-group"
                    role="tablist"
                    data-testid="culture-read-lang-tabs"
                  >
                    {READ_LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        role="tab"
                        aria-selected={readLang === lang}
                        className={readLang === lang ? 'drawer-tab is-active' : 'drawer-tab'}
                        onClick={() => setReadLang(lang)}
                        data-testid={`culture-read-lang-${lang}`}
                      >
                        {LANGUAGE_LABELS[lang]}
                      </button>
                    ))}
                  </div>

                  {/* Question text in the selected language */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('decks.culture.read.questionLabel')}
                    </p>
                    <p className="text-sm font-medium" data-testid="culture-question-read-text">
                      {question.question_text[readLang]?.trim() || '—'}
                    </p>
                  </div>

                  {/* F5: answers in the selected language with Situations correct treatment */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('decks.culture.read.answersLabel')}
                    </p>
                    <div className="space-y-2">
                      {activeOptions(question).map((opt, index) => {
                        const isCorrect = question.correct_option === index + 1;
                        const label = (['A', 'B', 'C', 'D'] as OptionLetter[])[index];
                        const text = firstNonEmpty(opt[readLang], opt['el'], opt['en'], opt['ru']);
                        return (
                          <div key={label} data-testid={`culture-question-read-answer-${label}`}>
                            <AnswerOption
                              letter={label}
                              text={text}
                              isSelected={false}
                              onClick={() => {}}
                              disabled
                              state={isCorrect ? 'correct' : 'default'}
                            />
                            {/* Behavioral testid contract: marks the correct row. The
                                green "Correct" pill was dropped in favour of AnswerOption's
                                state="correct" treatment; this non-visual node preserves the
                                testid asserted by the adversarial tests. */}
                            {isCorrect && (
                              <span hidden data-testid="culture-question-read-correct" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
