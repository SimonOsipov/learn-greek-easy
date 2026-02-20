import React, { useState } from 'react';

import { AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateAudio } from '@/features/words/hooks';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import type { WordEntryExampleSentence, WordEntryResponse } from '@/services/wordEntryAPI';

import { AudioGenerateButton } from './AudioGenerateButton';
import { AudioStatusBadge } from './AudioStatusBadge';
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
  value: string;
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

function getGenderForNoun(wordEntry: WordEntryResponse): string | null {
  if (wordEntry.part_of_speech !== 'noun') return null;
  if (!wordEntry.grammar_data) return null;
  const gender = (wordEntry.grammar_data as Record<string, unknown>).gender;
  if (typeof gender !== 'string') return null;
  return gender;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  const gender = getGenderForNoun(wordEntry);

  return (
    <div data-testid="word-entry-content-fields">
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit} data-testid="word-entry-edit-btn">
          {t('wordEntryEdit.edit')}
        </Button>
      </div>
      <dl className="space-y-3">
        {wordEntry.pronunciation ? (
          <FieldRow
            label={t('wordEntryContent.pronunciation')}
            value={wordEntry.pronunciation}
            testId="word-entry-content-pronunciation"
            suffix={
              <div className="flex items-center gap-2">
                <AudioStatusBadge
                  status={wordEntry.audio_status}
                  data-testid="audio-status-badge-lemma"
                />
                <AudioGenerateButton
                  status={wordEntry.audio_status}
                  onClick={() => onGenerateClick('lemma')}
                  isLoading={
                    isPending && pendingVariables?.part === 'lemma' && !pendingVariables?.exampleId
                  }
                  data-testid="audio-generate-btn-lemma"
                />
              </div>
            }
          />
        ) : (
          <div data-testid="word-entry-content-pronunciation">
            <dt className="text-sm text-muted-foreground">{t('audioStatus.lemmaAudio')}</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <AudioStatusBadge
                status={wordEntry.audio_status}
                data-testid="audio-status-badge-lemma"
              />
              <AudioGenerateButton
                status={wordEntry.audio_status}
                onClick={() => onGenerateClick('lemma')}
                isLoading={
                  isPending && pendingVariables?.part === 'lemma' && !pendingVariables?.exampleId
                }
                data-testid="audio-generate-btn-lemma"
              />
            </dd>
          </div>
        )}
        {wordEntry.translation_en_plural && (
          <FieldRow
            label={t('wordEntryContent.translationEnPlural')}
            value={wordEntry.translation_en_plural}
            testId="word-entry-content-translation-en-plural"
          />
        )}
        {wordEntry.translation_ru && (
          <FieldRow
            label={t('wordEntryContent.translationRu')}
            value={wordEntry.translation_ru}
            testId="word-entry-content-translation-ru"
          />
        )}
        {gender && (
          <FieldRow
            label={t('wordEntryContent.gender')}
            value={t(`wordEntryContent.gender${capitalize(gender)}`)}
            testId="word-entry-content-gender"
          />
        )}
      </dl>
      <ExamplesSection
        examples={wordEntry.examples}
        onGenerateClick={onGenerateClick}
        isPending={isPending}
        pendingVariables={pendingVariables}
      />
    </div>
  );
}

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
    <div className="mt-4" data-testid="word-entry-content-examples">
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">
        {t('wordEntryContent.examples')}
      </h4>
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

  return (
    <div
      className="space-y-1.5 rounded-md border p-3"
      data-testid={`word-entry-content-example-${index}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t('wordEntryContent.exampleGreek')}</span>
        {example.audio_status && (
          <div className="flex items-center gap-2">
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
      </div>
      <p className="text-sm">{example.greek}</p>
      <div>
        <span className="text-xs text-muted-foreground">
          {t('wordEntryContent.exampleEnglish')}
        </span>
        <p className="text-sm">{example.english || t('wordEntryContent.notSet')}</p>
      </div>
      {example.russian && (
        <div>
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleRussian')}
          </span>
          <p className="text-sm">{example.russian}</p>
        </div>
      )}
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
