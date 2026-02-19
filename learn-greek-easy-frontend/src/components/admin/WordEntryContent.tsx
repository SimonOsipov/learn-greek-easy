import React from 'react';

import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import type { WordEntryExampleSentence, WordEntryResponse } from '@/services/wordEntryAPI';

import { AudioStatusBadge } from './AudioStatusBadge';

interface WordEntryContentProps {
  wordEntryId: string;
}

export function WordEntryContent({ wordEntryId }: WordEntryContentProps) {
  const { wordEntry, isLoading, isError, refetch } = useWordEntry({
    wordId: wordEntryId,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !wordEntry) return <ErrorState onRetry={refetch} />;
  return <ContentFields wordEntry={wordEntry} />;
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

function ContentFields({ wordEntry }: { wordEntry: WordEntryResponse }) {
  const { t } = useTranslation('admin');
  const gender = getGenderForNoun(wordEntry);

  return (
    <div data-testid="word-entry-content-fields">
      <dl className="space-y-3">
        {wordEntry.pronunciation ? (
          <FieldRow
            label={t('wordEntryContent.pronunciation')}
            value={wordEntry.pronunciation}
            testId="word-entry-content-pronunciation"
            suffix={
              <AudioStatusBadge
                status={wordEntry.audio_status}
                data-testid="audio-status-badge-lemma"
              />
            }
          />
        ) : (
          <div data-testid="word-entry-content-pronunciation">
            <dt className="text-sm text-muted-foreground">{t('audioStatus.lemmaAudio')}</dt>
            <dd className="mt-0.5">
              <AudioStatusBadge
                status={wordEntry.audio_status}
                data-testid="audio-status-badge-lemma"
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
      <ExamplesSection examples={wordEntry.examples} />
    </div>
  );
}

function ExamplesSection({ examples }: { examples: WordEntryExampleSentence[] | null }) {
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
            <ExampleCard key={example.id || index} example={example} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExampleCard({ example, index }: { example: WordEntryExampleSentence; index: number }) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="space-y-1.5 rounded-md border p-3"
      data-testid={`word-entry-content-example-${index}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t('wordEntryContent.exampleGreek')}</span>
        {example.audio_status && (
          <AudioStatusBadge
            status={example.audio_status}
            data-testid={`audio-status-badge-example-${index}`}
          />
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
