import React, { useState } from 'react';

import { AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateAudio } from '@/features/words/hooks';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { chipColorClasses, type ChipColor } from '@/lib/completeness';
import type { WordEntryExampleSentence, WordEntryResponse } from '@/services/wordEntryAPI';

import { AudioGenerateButton } from './AudioGenerateButton';
import { AudioStatusBadge } from './AudioStatusBadge';
import { NotSet } from './NotSet';
import { GrammarDisplaySection } from './vocabulary/grammar-display/GrammarDisplaySection';
import {
  normalizeGrammarData,
  GRAMMAR_FIELD_COUNTS,
} from './vocabulary/grammar-display/grammarNormalizer';
import { WordEntryEditForm } from './WordEntryEditForm';

interface WordEntryContentProps {
  wordEntryId: string;
}

export function WordEntryContent({ wordEntryId }: WordEntryContentProps) {
  const { wordEntry, isLoading, isError, refetch } = useWordEntry({
    wordId: wordEntryId,
  });
  const [isEditing, setIsEditing] = useState(false);

  const generateAudioMutation = useGenerateAudio();
  const { isPending, variables: pendingVariables } = generateAudioMutation;

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !wordEntry) return <ErrorState onRetry={refetch} />;

  if (isEditing) {
    return (
      <WordEntryEditForm
        wordEntry={wordEntry}
        onSaveSuccess={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const handleGenerateClick = (part: 'lemma' | 'example', exampleId?: string) => {
    if (typeof posthog?.capture === 'function') {
      posthog.capture('admin_audio_generation_triggered', {
        word_entry_id: wordEntry.id,
        deck_id: wordEntry.deck_id,
        part_type: part,
        example_id: exampleId ?? null,
        action:
          part === 'lemma'
            ? wordEntry.audio_status === 'failed'
              ? 'retry'
              : 'generate'
            : wordEntry.examples?.find((e) => e.id === exampleId)?.audio_status === 'failed'
              ? 'retry'
              : 'generate',
        lemma: wordEntry.lemma,
      });
    }
    generateAudioMutation.mutate({ wordEntryId: wordEntry.id, part, exampleId });
  };

  return (
    <ContentFields
      wordEntry={wordEntry}
      onEdit={() => setIsEditing(true)}
      onGenerateClick={handleGenerateClick}
      isPending={isPending}
      pendingVariables={pendingVariables}
    />
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

function countGrammarFields(wordEntry: WordEntryResponse): { filled: number; total: number } {
  const pos = wordEntry.part_of_speech;
  const total = GRAMMAR_FIELD_COUNTS[pos] ?? 0;
  if (total === 0 || !wordEntry.grammar_data) return { filled: 0, total };
  const normalized = normalizeGrammarData(wordEntry.grammar_data, pos);
  const filled = Object.values(normalized).filter((v) => v !== null).length;
  return { filled, total };
}

// ============================================
// ContentFields
// ============================================

function ContentFields({
  wordEntry,
  onEdit,
  onGenerateClick,
  isPending,
  pendingVariables,
}: {
  wordEntry: WordEntryResponse;
  onEdit: () => void;
  onGenerateClick: (part: 'lemma' | 'example', exampleId?: string) => void;
  isPending: boolean;
  pendingVariables:
    | { wordEntryId: string; part: 'lemma' | 'example'; exampleId?: string }
    | undefined;
}) {
  const { t } = useTranslation('admin');

  const identityCompl = countIdentityFields(wordEntry);
  const translationsCompl = countTranslationFields(wordEntry);
  const grammarCompl = countGrammarFields(wordEntry);
  const examplesCount = wordEntry.examples?.length ?? 0;

  return (
    <div className="space-y-3" data-testid="word-entry-content-fields">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit} data-testid="word-entry-edit-btn">
          {t('wordEntryEdit.edit')}
        </Button>
      </div>

      {/* ── Identity Card ── */}
      <Card id="section-identity">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center text-sm font-semibold">
            {t('wordEntryContent.sectionIdentity')}
            <SectionBadge filled={identityCompl.filled} total={identityCompl.total} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <dl className="space-y-3">
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
                    onClick={() => onGenerateClick('lemma')}
                    isLoading={
                      isPending &&
                      pendingVariables?.part === 'lemma' &&
                      !pendingVariables?.exampleId
                    }
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
            <FieldRow
              label={t('wordEntryContent.translationEn')}
              value={wordEntry.translation_en || <NotSet />}
              testId="word-entry-content-translation-en"
            />
            <FieldRow
              label={t('wordEntryContent.translationEnPlural')}
              value={wordEntry.translation_en_plural || <NotSet />}
              testId="word-entry-content-translation-en-plural"
            />
            <div id="section-ru">
              <FieldRow
                label={t('wordEntryContent.translationRu')}
                value={wordEntry.translation_ru || <NotSet />}
                testId="word-entry-content-translation-ru"
              />
            </div>
            <FieldRow
              label={t('wordEntryContent.translationRuPlural')}
              value={wordEntry.translation_ru_plural || <NotSet />}
              testId="word-entry-content-translation-ru-plural"
            />
          </dl>
        </CardContent>
      </Card>

      {/* ── Grammar Card (not for phrases) ── */}
      {wordEntry.part_of_speech !== 'phrase' && (
        <Card id="section-grammar">
          <CardHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center text-sm font-semibold">
              {t('wordEntryContent.sectionGrammar')}
              {grammarCompl.total > 0 && (
                <SectionBadge filled={grammarCompl.filled} total={grammarCompl.total} />
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4" id="section-gram">
            <GrammarDisplaySection
              partOfSpeech={wordEntry.part_of_speech}
              grammarData={wordEntry.grammar_data}
            />
          </CardContent>
        </Card>
      )}

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
          <ExamplesSection
            examples={wordEntry.examples}
            onGenerateClick={onGenerateClick}
            isPending={isPending}
            pendingVariables={pendingVariables}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ExamplesSection
// ============================================

function ExamplesSection({
  examples,
  onGenerateClick,
  isPending,
  pendingVariables,
}: {
  examples: WordEntryExampleSentence[] | null;
  onGenerateClick: (part: 'lemma' | 'example', exampleId?: string) => void;
  isPending: boolean;
  pendingVariables:
    | { wordEntryId: string; part: 'lemma' | 'example'; exampleId?: string }
    | undefined;
}) {
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
            <ExampleCard
              key={example.id || index}
              example={example}
              index={index}
              onGenerateClick={onGenerateClick}
              isPending={isPending}
              pendingVariables={pendingVariables}
            />
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
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${filled ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
    />
  );
}

function ExampleCard({
  example,
  index,
  onGenerateClick,
  isPending,
  pendingVariables,
}: {
  example: WordEntryExampleSentence;
  index: number;
  onGenerateClick: (part: 'lemma' | 'example', exampleId?: string) => void;
  isPending: boolean;
  pendingVariables:
    | { wordEntryId: string; part: 'lemma' | 'example'; exampleId?: string }
    | undefined;
}) {
  const { t } = useTranslation('admin');

  const hasEnglish = Boolean(example.english);
  const hasRussian = Boolean(example.russian);
  const hasAudio = example.audio_status === 'ready' || example.audio_status === 'generating';

  return (
    <div
      className="space-y-1.5 rounded-md border p-3"
      data-testid={`word-entry-content-example-${index}`}
    >
      {/* Example number header */}
      <div className="mb-1 text-xs font-medium text-muted-foreground">#{index + 1}</div>

      {/* Greek — always green dot */}
      <div className="flex items-start gap-2">
        <CompletionDot filled={true} />
        <div className="min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleGreek')}
          </span>
          <p className="text-sm">{example.greek}</p>
        </div>
      </div>

      {/* English — green if present, gray if absent */}
      <div className="flex items-start gap-2">
        <CompletionDot filled={hasEnglish} />
        <div className="min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleEnglish')}
          </span>
          <p className="text-sm">{example.english || <NotSet />}</p>
        </div>
      </div>

      {/* Russian — always shown, green/gray dot */}
      <div className="flex items-start gap-2">
        <CompletionDot filled={hasRussian} />
        <div className="min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleRussian')}
          </span>
          {hasRussian ? (
            <p className="text-sm">{example.russian}</p>
          ) : (
            <p className="text-sm">
              <NotSet />
            </p>
          )}
        </div>
      </div>

      {/* Audio — green/gray dot + badge + button */}
      {example.audio_status && (
        <div className="flex items-center gap-2">
          <CompletionDot filled={hasAudio} />
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleAudio')}
          </span>
          <AudioStatusBadge
            status={example.audio_status}
            data-testid={`audio-status-badge-example-${index}`}
          />
          <AudioGenerateButton
            status={example.audio_status}
            onClick={() => onGenerateClick('example', example.id)}
            isLoading={isPending && pendingVariables?.exampleId === example.id}
            data-testid={`audio-generate-btn-example-${index}`}
          />
        </div>
      )}

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
