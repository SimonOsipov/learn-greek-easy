import React, { useCallback, useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateAudio } from '@/features/words/hooks';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { toast } from '@/hooks/use-toast';
import { chipColorClasses, type ChipColor } from '@/lib/completeness';
import { adminAPI } from '@/services/adminAPI';
import type { WordEntryExampleSentence, WordEntryResponse } from '@/services/wordEntryAPI';

import { AudioGenerateButton } from './AudioGenerateButton';
import { AudioStatusBadge } from './AudioStatusBadge';
import { NotSet } from './NotSet';
import { GrammarEditSection } from './vocabulary/grammar-display/GrammarEditSection';
import { WordEntryEditForm } from './WordEntryEditForm';

interface WordEntryContentProps {
  wordEntryId: string;
  deckId?: string;
  onUnlinked?: () => void;
}

export function WordEntryContent({ wordEntryId, deckId, onUnlinked }: WordEntryContentProps) {
  const { wordEntry, isLoading, isError, refetch } = useWordEntry({
    wordId: wordEntryId,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isGrammarEditing, setIsGrammarEditing] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [autoGenerateAfterEdit, setAutoGenerateAfterEdit] = useState(false);
  const { t } = useTranslation('admin');

  const { triggerGeneration, isGenerating } = useGenerateAudio({
    wordEntryId,
  });

  useEffect(() => {
    if (autoGenerateAfterEdit) {
      triggerGeneration();
      setAutoGenerateAfterEdit(false);
    }
  }, [autoGenerateAfterEdit, triggerGeneration]);

  const unlinkMutation = useMutation({
    mutationFn: () => {
      if (!deckId || !wordEntry) throw new Error('Missing deckId or wordEntry');
      return adminAPI.unlinkWordEntry(deckId, wordEntry.id);
    },
    onSuccess: () => {
      setShowUnlinkConfirm(false);
      toast({ description: t('wordEntry.unlinkSuccess') });
      onUnlinked?.();
    },
    onError: (error: unknown) => {
      const apiErr = error as { detail?: string };
      toast({
        description: apiErr.detail ?? 'Failed to unlink word entry',
        variant: 'destructive',
      });
    },
  });

  const handleGenerateAllClick = useCallback(() => {
    if (!wordEntry) return;
    if (typeof posthog?.capture === 'function') {
      posthog.capture('admin_audio_generation_triggered', {
        word_entry_id: wordEntry.id,
        deck_id: wordEntry.deck_id,
        action: 'generate_all',
        lemma: wordEntry.lemma,
      });
    }
    triggerGeneration();
  }, [wordEntry, triggerGeneration]);

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !wordEntry) return <ErrorState onRetry={refetch} />;

  if (isEditing) {
    return (
      <WordEntryEditForm
        wordEntry={wordEntry}
        onSaveSuccess={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
        onAudioRegenNeeded={() => setAutoGenerateAfterEdit(true)}
      />
    );
  }

  return (
    <>
      <ContentFields
        wordEntry={wordEntry}
        onEdit={() => setIsEditing(true)}
        onGenerateClick={handleGenerateAllClick}
        isGenerating={isGenerating}
        isGrammarEditing={isGrammarEditing}
        onGrammarEditingChange={setIsGrammarEditing}
        showUnlinkButton={Boolean(deckId)}
        onUnlinkClick={() => setShowUnlinkConfirm(true)}
      />
      {deckId && (
        <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('wordEntry.unlinkTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('wordEntry.unlinkConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="word-entry-content-loading">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('admin');
  return (
    <div data-testid="word-entry-content-error">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('wordEntryContent.errorTitle')}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-3"
        data-testid="word-entry-content-retry"
      >
        {t('wordEntryContent.errorRetry')}
      </Button>
    </div>
  );
}

function FieldRow({
  label,
  value,
  testId,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 text-sm font-medium">
        {value}
        {suffix}
      </dd>
    </div>
  );
}

function SectionBadge({ filled, total }: { filled: number; total: number }) {
  const color: ChipColor = filled === total ? 'green' : filled > 0 ? 'yellow' : 'gray';
  return (
    <span className={`ml-2 rounded-sm border px-1.5 py-0.5 text-xs ${chipColorClasses[color]}`}>
      {filled}/{total}
    </span>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================
// Section completeness helpers
// ============================================

function countIdentityFields(wordEntry: WordEntryResponse): { filled: number; total: number } {
  let filled = 0;
  if (wordEntry.pronunciation) filled++;
  if (wordEntry.audio_status === 'ready') filled++;
  return { filled, total: 2 };
}

function countTranslationFields(wordEntry: WordEntryResponse): { filled: number; total: number } {
  let filled = 0;
  if (wordEntry.translation_en) filled++;
  if (wordEntry.translation_en_plural) filled++;
  if (wordEntry.translation_ru) filled++;
  if (wordEntry.translation_ru_plural) filled++;
  return { filled, total: 4 };
}

// ============================================
// ContentFields
// ============================================

function ContentFields({
  wordEntry,
  onEdit,
  onGenerateClick,
  isGenerating,
  isGrammarEditing,
  onGrammarEditingChange,
  showUnlinkButton,
  onUnlinkClick,
}: {
  wordEntry: WordEntryResponse;
  onEdit: () => void;
  onGenerateClick: () => void;
  isGenerating: boolean;
  isGrammarEditing: boolean;
  onGrammarEditingChange: (isEditing: boolean) => void;
  showUnlinkButton: boolean;
  onUnlinkClick: () => void;
}) {
  const { t } = useTranslation('admin');

  const identityCompl = countIdentityFields(wordEntry);
  const translationsCompl = countTranslationFields(wordEntry);
  const examplesCount = wordEntry.examples?.length ?? 0;

  return (
    <div className="space-y-3" data-testid="word-entry-content-fields">
      {/* ── Identity Card ── */}
      <Card id="section-identity">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm font-semibold">
              {t('wordEntryContent.sectionIdentity')}
              <SectionBadge filled={identityCompl.filled} total={identityCompl.total} />
            </div>
            <div className="flex gap-2">
              {showUnlinkButton && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={onUnlinkClick}
                  data-testid="word-entry-unlink-btn"
                >
                  {t('wordEntry.unlinkButton')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={isGrammarEditing}
                data-testid="word-entry-edit-btn"
              >
                {t('wordEntryEdit.edit')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Part of Speech */}
            <FieldRow
              label={t('wordEntryContent.partOfSpeech')}
              value={wordEntry.part_of_speech ? capitalize(wordEntry.part_of_speech) : <NotSet />}
              testId="word-entry-content-pos"
            />

            {/* Pronunciation + Audio */}
            <div id="section-pron" data-testid="word-entry-content-pronunciation">
              <dt className="text-sm text-muted-foreground">
                {t('wordEntryContent.pronunciation')}
              </dt>
              <dd className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                {wordEntry.pronunciation ? wordEntry.pronunciation : <NotSet />}
                <div className="flex items-center gap-2">
                  <AudioStatusBadge
                    status={wordEntry.audio_status}
                    data-testid="audio-status-badge-lemma"
                  />
                  <AudioGenerateButton
                    status={wordEntry.audio_status}
                    onClick={onGenerateClick}
                    isLoading={isGenerating}
                    data-testid="audio-generate-btn-lemma"
                  />
                </div>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ── Translations Card ── */}
      <Card id="section-translations">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center text-sm font-semibold">
            {t('wordEntryContent.sectionTranslations')}
            <SectionBadge filled={translationsCompl.filled} total={translationsCompl.total} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <dl className="space-y-3" id="section-en">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldRow
                label={t('wordEntryContent.translationEn')}
                value={wordEntry.translation_en || <NotSet />}
                testId="word-entry-content-translation-en"
              />
              <div id="section-ru">
                <FieldRow
                  label={t('wordEntryContent.translationRu')}
                  value={wordEntry.translation_ru || <NotSet />}
                  testId="word-entry-content-translation-ru"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldRow
                label={t('wordEntryContent.translationEnPlural')}
                value={wordEntry.translation_en_plural || <NotSet />}
                testId="word-entry-content-translation-en-plural"
              />
              <FieldRow
                label={t('wordEntryContent.translationRuPlural')}
                value={wordEntry.translation_ru_plural || <NotSet />}
                testId="word-entry-content-translation-ru-plural"
              />
            </div>
          </dl>
        </CardContent>
      </Card>

      <GrammarEditSection wordEntry={wordEntry} onEditingChange={onGrammarEditingChange} />

      {/* ── Examples Card ── */}
      <Card id="section-examples">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center text-sm font-semibold">
            {t('wordEntryContent.sectionExamples')}
            <span className="ml-2 rounded-sm border border-muted-foreground/30 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
              {examplesCount}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4" id="section-ex">
          <ExamplesSection examples={wordEntry.examples} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ExamplesSection
// ============================================

function ExamplesSection({ examples }: { examples: WordEntryExampleSentence[] | null }) {
  const { t } = useTranslation('admin');
  const hasExamples = examples && examples.length > 0;

  return (
    <div data-testid="word-entry-content-examples">
      {!hasExamples && (
        <p className="text-sm text-muted-foreground" data-testid="word-entry-content-no-examples">
          {t('wordEntryContent.noExamples')}
        </p>
      )}
      {hasExamples && (
        <div className="space-y-3">
          {examples.map((example, index) => (
            <ExampleCard key={example.id || index} example={example} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ExampleCard
// ============================================

function CompletionDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${filled ? 'bg-success' : 'bg-muted-foreground/30'}`}
    />
  );
}

function ExampleCard({ example, index }: { example: WordEntryExampleSentence; index: number }) {
  const { t } = useTranslation('admin');

  const hasEnglish = Boolean(example.english);
  const hasRussian = Boolean(example.russian);
  const hasAudio = example.audio_status === 'ready' || example.audio_status === 'generating';

  return (
    <div
      className="space-y-1.5 rounded-md border p-3"
      data-testid={`word-entry-content-example-${index}`}
    >
      {/* Example number header with audio inline */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        {example.audio_status && (
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasAudio} />
            <AudioStatusBadge
              status={example.audio_status}
              data-testid={`audio-status-badge-example-${index}`}
            />
          </div>
        )}
      </div>

      {/* Greek — always green dot */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CompletionDot filled={true} />
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleGreek')}
          </span>
        </div>
        <p className="mt-0.5 pl-3.5 text-sm">{example.greek}</p>
      </div>

      {/* English and Russian side by side */}
      <div className="grid grid-cols-2 gap-x-6">
        {/* English — green if present, gray if absent */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasEnglish} />
            <span className="text-xs text-muted-foreground">
              {t('wordEntryContent.exampleEnglish')}
            </span>
          </div>
          <p className="mt-0.5 pl-3.5 text-sm">{example.english || <NotSet />}</p>
        </div>

        {/* Russian — always shown, green/gray dot */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasRussian} />
            <span className="text-xs text-muted-foreground">
              {t('wordEntryContent.exampleRussian')}
            </span>
          </div>
          <p className="mt-0.5 pl-3.5 text-sm">{hasRussian ? example.russian : <NotSet />}</p>
        </div>
      </div>

      {/* Context — only shown when present */}
      {example.context && (
        <div>
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleContext')}
          </span>
          <p className="text-sm">{example.context}</p>
        </div>
      )}
    </div>
  );
}
