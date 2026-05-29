// src/features/words/pages/WordReferencePage.tsx

/**
 * Word Reference Page - displays detailed linguistic data for a word entry.
 *
 * Includes:
 * - DX-09 WordHero: radial gradient header with word, pronunciation, translations,
 *   audio pulse, DonutRing mastery, WeekHeat placeholder
 * - DX-10 stacked .dx-section cards in the Word Info tab:
 *     1. Declension / Case forms (real, re-skinned)
 *     2. Examples (real, with derived tag + R5 amber dot)
 *     3. Collocations (R6 danger dot, placeholder)
 *     4. Note callout (real from grammar_data.notes, amber lightbulb)
 *     5. Related words (R7 danger dot, placeholder)
 * - Active tab trigger has a primary ring (.dx-tab-ring)
 * - Cards tab with word mastery summary
 */

import { useMemo, useState } from 'react';

import { Lightbulb, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { ReportErrorModal } from '@/components/card-errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { track } from '@/lib/analytics';
import { getLocalizedTranslation } from '@/lib/localeUtils';
import { cn } from '@/lib/utils';
import type { AdjectiveData, AdverbData, NounDataAny, VerbData } from '@/types/grammar';
import type { AudioSpeed } from '@/utils/audioSpeed';
import { getPersistedAudioSpeed, setPersistedAudioSpeed } from '@/utils/audioSpeed';

import {
  AdjectiveDeclensionTable,
  CardsSummaryBar,
  CardTypeGroup,
  CollocationsSection,
  ConjugationTable,
  ExamplesSection,
  NounDeclensionTable,
  RelatedWordsSection,
  WordHero,
} from '../components';
import { groupCards } from '../components/cardGrouping';
import { GENDER_ARTICLE_MAP } from '../components/WordHero';
import { useWordEntry, useWordMastery } from '../hooks';

import type { CardMasteryItem } from '../hooks';

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
    <div className="dx-section" data-testid="grammar-section">
      <div className="dx-section-head">
        <h3 className="dx-section-h">{t('grammar.sections.forms')}</h3>
      </div>
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
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function WordReferencePage() {
  const { t, i18n } = useTranslation(['deck', 'review']);
  const { deckId, wordId } = useParams<{ deckId: string; wordId: string }>();

  const { wordEntry, isLoading, isError, error } = useWordEntry({
    wordId: wordId || '',
    enabled: !!wordId,
  });

  const {
    cards: masteryCards,
    isLoading: isMasteryLoading,
    isError: isMasteryError,
    refetch: refetchMastery,
  } = useWordMastery({
    deckId: deckId ?? '',
    wordEntryId: wordId ?? '',
    enabled: !!deckId && !!wordId,
  });

  const groupedCards = useMemo(() => groupCards(masteryCards), [masteryCards]);
  const totalCards = masteryCards.length;
  const masteredCards = masteryCards.filter(
    (c: CardMasteryItem) => c.mastery_status === 'mastered'
  ).length;

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<AudioSpeed>(getPersistedAudioSpeed);
  const [activeTab, setActiveTab] = useState('word-info');
  const handleSpeedChange = (newSpeed: AudioSpeed) => {
    setAudioSpeed(newSpeed);
    setPersistedAudioSpeed(newSpeed);
  };

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

  // Extract notes from grammar_data if present
  const notes = grammarData && 'notes' in grammarData ? (grammarData.notes as string) : null;

  // Render grammar section based on part of speech — wrapped in .dx-section
  const renderGrammarSection = () => {
    if (!grammarData) {
      return (
        <div className="dx-section" data-testid="grammar-section">
          <div className="dx-section-head">
            <h3 className="dx-section-h">{t('review:grammar.sections.declension')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('deck:wordBrowser.emptyFilterDescription')}
          </p>
        </div>
      );
    }

    switch (partOfSpeech) {
      case 'verb':
        return (
          <div className="dx-section" data-testid="grammar-section">
            <ConjugationTable grammarData={grammarData as unknown as VerbData} />
          </div>
        );
      case 'noun':
        return (
          <div className="dx-section" data-testid="grammar-section">
            <NounDeclensionTable grammarData={grammarData as unknown as NounDataAny} />
          </div>
        );
      case 'adjective':
        return (
          <div className="dx-section" data-testid="grammar-section">
            <AdjectiveDeclensionTable grammarData={grammarData as unknown as AdjectiveData} />
          </div>
        );
      case 'adverb':
        return <AdverbFormsCard grammarData={grammarData as unknown as AdverbData} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="word-reference-page">
      {/* DX-09 Word Hero — radial panel header */}
      <WordHero
        wordEntry={wordEntry}
        deckId={deckId ?? ''}
        displayTranslation={displayTranslation}
        article={article}
        masteredCards={masteredCards}
        totalCards={totalCards}
        audioSpeed={audioSpeed}
        onSpeedChange={handleSpeedChange}
        onReportError={() => setIsReportModalOpen(true)}
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        data-testid="word-reference-tabs"
        onValueChange={(value) => {
          setActiveTab(value);
          track('word_reference_tab_switched', {
            tab: value === 'word-info' ? 'word_info' : 'cards',
            word_entry_id: wordId ?? '',
            deck_id: deckId ?? '',
          });
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger
            value="word-info"
            data-testid="word-reference-tab-word-info"
            className={cn('dx-tab-ring flex-1')}
          >
            {t('deck:wordReference.tabWordInfo')}
          </TabsTrigger>
          <TabsTrigger
            value="cards"
            data-testid="word-reference-tab-cards"
            className={cn('dx-tab-ring flex-1')}
          >
            {totalCards > 0
              ? t('deck:wordReference.tabCardsWithCount', {
                  mastered: masteredCards,
                  total: totalCards,
                })
              : t('deck:wordReference.tabCards')}
          </TabsTrigger>
        </TabsList>

        {/* ── Word Info Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="word-info" className="mt-4 space-y-4">
          {/* 1. Declension / Case forms — REAL, no dot */}
          {renderGrammarSection()}

          {/* 2. Examples — REAL, amber tag + R5 amber dot */}
          <ExamplesSection
            examples={wordEntry.examples}
            wordEntryId={wordEntry.id}
            deckId={deckId}
            speed={audioSpeed}
          />

          {/* 3. Collocations — placeholder, R6 danger dot */}
          <CollocationsSection lemma={wordEntry.lemma} />

          {/* 4. Note callout — REAL from grammar_data.notes, amber lightbulb, no dot */}
          {notes && (
            <div className="dx-section" data-testid="notes-section">
              <div className="dx-notes">
                <span className="dx-notes-mark" aria-hidden="true">
                  <Lightbulb />
                </span>
                <p>{notes}</p>
              </div>
            </div>
          )}

          {/* 5. Related words — placeholder, R7 danger dot */}
          <RelatedWordsSection lemma={wordEntry.lemma} />
        </TabsContent>

        {/* ── Cards Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="cards">
          {isMasteryLoading ? (
            <div className="space-y-3 p-4" data-testid="cards-tab-loading">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isMasteryError ? (
            <div className="space-y-3 py-8 text-center" data-testid="cards-tab-error">
              <p className="text-sm text-muted-foreground">{t('deck:wordReference.cardsError')}</p>
              <Button variant="outline" size="sm" onClick={refetchMastery}>
                {t('deck:wordReference.cardsRetry')}
              </Button>
            </div>
          ) : groupedCards.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground" data-testid="cards-tab-empty">
              <p className="text-sm">{t('deck:wordReference.cardsEmpty')}</p>
            </div>
          ) : (
            <div className="space-y-4 py-4" key={`cards-content-${activeTab}`}>
              <CardsSummaryBar mastered={masteredCards} total={totalCards} />
              {groupedCards.map((group) => (
                <CardTypeGroup
                  key={group.key}
                  groupKey={group.key}
                  i18nKey={group.i18nKey}
                  cards={group.cards}
                  masteredCount={group.masteredCount}
                  totalCount={group.totalCount}
                  wordEntryId={wordId ?? ''}
                  deckId={deckId ?? ''}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReportErrorModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cardId={wordEntry.id}
        cardType="WORD"
      />
    </div>
  );
}
