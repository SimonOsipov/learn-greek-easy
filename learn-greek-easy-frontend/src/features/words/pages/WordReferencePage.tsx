// src/features/words/pages/WordReferencePage.tsx

/**
 * Word Reference Page - displays detailed linguistic data for a word entry.
 *
 * Includes:
 * - Gradient header with word, pronunciation, translations
 * - Grammar tables (conjugation for verbs, declension for nouns/adjectives)
 * - Usage examples
 * - Notes section (if available)
 * - Disabled "Practice this word" button (future feature)
 */

import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AdjectiveData, AdverbData, NounData, VerbData } from '@/types/grammar';

import {
  AdjectiveDeclensionTable,
  ConjugationTable,
  ExamplesSection,
  NounDeclensionTable,
} from '../components';
import { useWordEntry } from '../hooks';

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

export function WordReferencePage() {
  const { t } = useTranslation(['deck', 'review']);
  const { deckId, wordId } = useParams<{ deckId: string; wordId: string }>();

  const { wordEntry, isLoading, isError, error } = useWordEntry({
    wordId: wordId || '',
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

  const grammarData = wordEntry.grammar_data;
  const partOfSpeech = wordEntry.part_of_speech;

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
        return <NounDeclensionTable grammarData={grammarData as NounData} />;
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
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        {/* Back navigation */}
        <Button asChild variant="ghost" size="sm" className="mb-4" data-testid="back-button">
          <Link to={`/decks/${deckId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('deck:detail.goBack')}
          </Link>
        </Button>

        {/* Type badges */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            {t(`review:grammar.partOfSpeech.${partOfSpeech}`)}
          </Badge>
          {partOfSpeech === 'verb' && grammarData && 'voice' in grammarData && (
            <Badge variant="outline" className="capitalize">
              {t(`review:grammar.verbConjugation.voice.${grammarData.voice as string}`)}
            </Badge>
          )}
          {partOfSpeech === 'noun' && grammarData && 'gender' in grammarData && (
            <Badge variant="outline" className="capitalize">
              {t(`review:grammar.nounDeclension.genders.${grammarData.gender as string}`)}
            </Badge>
          )}
          {wordEntry.cefr_level && <Badge variant="outline">{wordEntry.cefr_level}</Badge>}
        </div>

        {/* Greek word (lemma) */}
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{wordEntry.lemma}</h1>

        {/* Pronunciation */}
        {wordEntry.pronunciation && (
          <p className="mt-2 text-lg text-muted-foreground">{wordEntry.pronunciation}</p>
        )}

        {/* Translations */}
        <div className="mt-4 space-y-1">
          <p className="text-xl text-foreground">{wordEntry.translation_en}</p>
          {wordEntry.translation_ru && (
            <p className="text-lg italic text-muted-foreground">{wordEntry.translation_ru}</p>
          )}
        </div>
      </div>

      {/* Grammar Section */}
      {renderGrammarSection()}

      {/* Examples Section */}
      <ExamplesSection examples={wordEntry.examples} />

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

      {/* Practice Button (disabled for MVP) */}
      <div className="flex justify-center pb-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="default"
                size="lg"
                disabled
                className="cursor-not-allowed"
                data-testid="practice-word-button"
              >
                Practice this word
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('deck:v2.comingSoon')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
