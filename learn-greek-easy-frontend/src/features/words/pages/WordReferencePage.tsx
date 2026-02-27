// src/features/words/pages/WordReferencePage.tsx

/**
 * Word Reference Page - displays detailed linguistic data for a word entry.
 *
 * Includes:
 * - Gradient header with word, pronunciation, translations
 * - Grammar tables (conjugation for verbs, declension for nouns/adjectives)
 * - Usage examples
 * - Notes section (if available)
 * - Dynamic "Practice this word" button (navigates to practice page when cards available)
 */

import { useState } from 'react';

import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { ReportErrorButton, ReportErrorModal } from '@/components/card-errors';
import { GenderBadge, PartOfSpeechBadge } from '@/components/review/grammar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AudioSpeedToggle } from '@/components/ui/AudioSpeedToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trackWordAudioFailed, trackWordAudioPlayed } from '@/lib/analytics';
import { getLocalizedTranslation } from '@/lib/localeUtils';
import type { AdjectiveData, AdverbData, NounDataAny, NounGender, VerbData } from '@/types/grammar';

import {
  AdjectiveDeclensionTable,
  ConjugationTable,
  ExamplesSection,
  NounDeclensionTable,
} from '../components';
import { useWordEntry, useWordEntryCards } from '../hooks';

// ============================================
// Loading Skeleton Component
// ============================================

function WordReferencePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-4 h-10 w-48" />
        <Skeleton className="mt-2 h-5 w-32" />
        <Skeleton className="mt-2 h-6 w-64" />
      </div>

      {/* Grammar table skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      {/* Examples skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Error Component
// ============================================

function WordReferenceError({ message }: { message: string }) {
  const { t } = useTranslation('deck');
  const { deckId } = useParams<{ deckId: string }>();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <Alert variant="destructive" className="max-w-md text-center">
        <AlertTitle>{t('wordBrowser.errorTitle')}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button asChild variant="outline">
        <Link to={`/decks/${deckId}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('detail.goBack')}
        </Link>
      </Button>
    </div>
  );
}

// ============================================
// Not Found Component
// ============================================

function WordNotFound() {
  const { t } = useTranslation('deck');
  const { deckId } = useParams<{ deckId: string }>();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <Alert className="max-w-md text-center">
        <AlertTitle>{t('detail.notFound')}</AlertTitle>
        <AlertDescription>{t('detail.notFoundDescription')}</AlertDescription>
      </Alert>
      <Button asChild variant="outline">
        <Link to={`/decks/${deckId}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('detail.goBack')}
        </Link>
      </Button>
    </div>
  );
}

// ============================================
// Adverb Forms Component
// ============================================

interface AdverbFormsCardProps {
  grammarData: AdverbData;
}

function AdverbFormsCard({ grammarData }: AdverbFormsCardProps) {
  const { t } = useTranslation('review');
  const na = t('grammar.adverbForms.notAvailable');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('grammar.sections.forms')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t('grammar.adverbForms.comparative')}
            </p>
            <p className="mt-2 text-lg font-medium">{grammarData.comparative || na}</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t('grammar.adverbForms.superlative')}
            </p>
            <p className="mt-2 text-lg font-medium">{grammarData.superlative || na}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

const GENDER_ARTICLE_MAP: Record<string, string> = {
  masculine: 'ο',
  feminine: 'η',
  neuter: 'το',
};

export function WordReferencePage() {
  const { t, i18n } = useTranslation(['deck', 'review']);
  const { deckId, wordId } = useParams<{ deckId: string; wordId: string }>();

  const { wordEntry, isLoading, isError, error } = useWordEntry({
    wordId: wordId || '',
    enabled: !!wordId,
  });

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const { cards, isLoading: isCardsLoading } = useWordEntryCards({
    wordEntryId: wordId || '',
    enabled: !!wordId,
  });

  // Loading state
  if (isLoading) {
    return <WordReferencePageSkeleton />;
  }

  // Error state
  if (isError) {
    return <WordReferenceError message={error?.message || 'Unknown error'} />;
  }

  // Not found state
  if (!wordEntry) {
    return <WordNotFound />;
  }

  const displayTranslation = getLocalizedTranslation(
    wordEntry.translation_en,
    wordEntry.translation_ru,
    i18n.language
  );

  const grammarData = wordEntry.grammar_data;
  const partOfSpeech = wordEntry.part_of_speech;
  const article =
    partOfSpeech === 'noun' && grammarData && 'gender' in grammarData
      ? GENDER_ARTICLE_MAP[grammarData.gender as string]
      : undefined;

  // Render grammar section based on part of speech
  const renderGrammarSection = () => {
    if (!grammarData) {
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('review:grammar.sections.declension')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('deck:wordBrowser.emptyFilterDescription')}
            </p>
          </CardContent>
        </Card>
      );
    }

    switch (partOfSpeech) {
      case 'verb':
        return <ConjugationTable grammarData={grammarData as VerbData} />;
      case 'noun':
        return <NounDeclensionTable grammarData={grammarData as NounDataAny} />;
      case 'adjective':
        return <AdjectiveDeclensionTable grammarData={grammarData as AdjectiveData} />;
      case 'adverb':
        return <AdverbFormsCard grammarData={grammarData as AdverbData} />;
      default:
        return null;
    }
  };

  // Extract notes from grammar_data if present
  const notes = grammarData && 'notes' in grammarData ? (grammarData.notes as string) : null;

  return (
    <div className="space-y-6" data-testid="word-reference-page">
      {/* Gradient Header */}
      <div className="relative rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 pb-12">
        {/* Back navigation */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-4 hover:bg-transparent"
          data-testid="back-button"
        >
          <Link to={`/decks/${deckId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('deck:detail.goBack')}
          </Link>
        </Button>

        {/* Type badges */}
        <div className="mb-4 flex flex-wrap gap-2">
          <PartOfSpeechBadge partOfSpeech={partOfSpeech} />
          {partOfSpeech === 'verb' && grammarData && 'voice' in grammarData && (
            <Badge variant="outline" className="capitalize">
              {t(`review:grammar.verbConjugation.voice.${grammarData.voice as string}`)}
            </Badge>
          )}
          {partOfSpeech === 'noun' && grammarData && 'gender' in grammarData && article && (
            <GenderBadge gender={grammarData.gender as NounGender} />
          )}
        </div>

        {/* Greek word (lemma) */}
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
            {article && <span className="mr-2 font-normal text-muted-foreground">{article}</span>}
            {wordEntry.lemma}
          </h1>
          {wordEntry.audio_url && (
            <SpeakerButton
              audioUrl={wordEntry.audio_url}
              className="hover:bg-transparent [&_svg]:size-6"
              onPlay={() =>
                trackWordAudioPlayed({
                  word_entry_id: wordEntry.id,
                  lemma: wordEntry.lemma,
                  part_of_speech: wordEntry.part_of_speech ?? null,
                  context: 'reference',
                  deck_id: deckId ?? '',
                  playback_speed: 1,
                })
              }
              onError={(error) =>
                trackWordAudioFailed({
                  word_entry_id: wordEntry.id,
                  error,
                  audio_type: 'word',
                  context: 'reference',
                })
              }
            />
          )}
        </div>

        {/* Pronunciation */}
        {wordEntry.pronunciation && (
          <p className="mt-2 text-lg text-muted-foreground">{wordEntry.pronunciation}</p>
        )}

        {/* Translation - single locale-appropriate value */}
        <p className="mt-4 text-[1.15em] font-bold text-foreground">{displayTranslation}</p>

        {wordEntry.audio_url && (
          <div className="absolute bottom-3 left-3">
            <AudioSpeedToggle />
          </div>
        )}
      </div>

      {/* Grammar Section */}
      {renderGrammarSection()}

      {/* Examples Section */}
      <ExamplesSection examples={wordEntry.examples} wordEntryId={wordEntry.id} deckId={deckId} />

      {/* Notes Section (if available) */}
      {notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Practice Button + Report Error (same vertical level) */}
      <div className="relative pb-6 pt-4">
        {/* Report Error - absolute bottom-left */}
        <div className="absolute bottom-6 left-0">
          <ReportErrorButton
            onClick={() => setIsReportModalOpen(true)}
            data-testid="report-error-button"
          />
        </div>

        {/* Practice Button - centered */}
        <div className="flex justify-center">
          {isCardsLoading ? (
            <Button
              variant="default"
              size="lg"
              disabled
              className="min-w-[250px]"
              data-testid="practice-word-button"
            >
              {t('deck:wordReference.practiceWord')}
            </Button>
          ) : cards.length === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="default"
                    size="lg"
                    disabled
                    className="min-w-[250px] cursor-not-allowed"
                    data-testid="practice-word-button"
                  >
                    {t('deck:wordReference.practiceWord')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('deck:practice.noCards')}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              asChild
              variant="default"
              size="lg"
              className="min-w-[250px]"
              data-testid="practice-word-button"
            >
              <Link to={`/decks/${deckId}/words/${wordId}/practice`}>
                {t('deck:wordReference.practiceWord')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ReportErrorModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cardId={wordEntry.id}
        cardType="WORD"
      />
    </div>
  );
}
