import { useEffect, useRef } from 'react';

import { useTranslation } from 'react-i18next';

import { trackGrammarCardViewed } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useReviewStore } from '@/stores/reviewStore';
import type { CardReview } from '@/types/review';

import {
  NounDeclensionTable,
  TenseTabs,
  AdjectiveDeclensionTables,
  AdverbFormsTable,
  ExampleSentences,
} from './grammar';
import { SectionHeader } from './SectionHeader';

interface CardContentProps {
  card: CardReview;
  isFlipped: boolean;
}

export function CardContent({ card, isFlipped }: CardContentProps) {
  const { t, i18n } = useTranslation('review');
  const { flipCard, activeSession } = useReviewStore();
  const partOfSpeech = card.part_of_speech;

  // Track ref to avoid duplicate tracking for the same card flip
  const hasTrackedRef = useRef<string | null>(null);

  // Get session context for analytics
  const sessionId = activeSession?.sessionId;
  const deckId = activeSession?.deckId;

  // Get grammar data from API (snake_case fields)
  const nounData = card.noun_data;
  const verbData = card.verb_data;
  const adjectiveData = card.adjective_data;
  const adverbData = card.adverb_data;
  const examples = card.examples;

  // Get translation based on UI language with fallback
  const getTranslation = (): string => {
    const english = card.translation || card.back;
    const russian = card.back_text_ru;

    if (i18n.language === 'ru') {
      return russian || english || '';
    }
    return english || russian || '';
  };

  const translation = getTranslation();

  // Get section header title based on part of speech
  const getGrammarSectionTitle = (): string | null => {
    switch (partOfSpeech) {
      case 'noun':
        return t('grammar.sections.caseForms');
      case 'adjective':
        return t('grammar.sections.declension');
      case 'verb':
        return t('grammar.sections.conjugation');
      case 'adverb':
        return t('grammar.sections.forms');
      default:
        return null;
    }
  };

  const grammarSectionTitle = getGrammarSectionTitle();

  // Determine if this card has grammar data
  const hasGrammarData = !!(nounData || verbData || adjectiveData || adverbData);

  // Track grammar_card_viewed when card is flipped and has grammar data
  useEffect(() => {
    if (isFlipped && partOfSpeech && sessionId && deckId && hasTrackedRef.current !== card.id) {
      trackGrammarCardViewed({
        card_id: card.id,
        part_of_speech: partOfSpeech,
        deck_id: deckId,
        session_id: sessionId,
        has_grammar_data: hasGrammarData,
      });
      hasTrackedRef.current = card.id;
    }
  }, [isFlipped, card.id, partOfSpeech, sessionId, deckId, hasGrammarData]);

  // Reset tracking ref when card changes
  useEffect(() => {
    hasTrackedRef.current = null;
  }, [card.id]);

  const renderGrammarTable = () => {
    switch (partOfSpeech) {
      case 'noun':
        return nounData ? <NounDeclensionTable nounData={nounData} isFlipped={isFlipped} /> : null;
      case 'verb':
        return verbData ? (
          <TenseTabs
            key={card.id}
            verbData={verbData}
            cardId={card.id}
            sessionId={sessionId}
            isFlipped={isFlipped}
          />
        ) : null;
      case 'adjective':
        return adjectiveData ? (
          <AdjectiveDeclensionTables
            key={card.id}
            adjectiveData={adjectiveData}
            cardId={card.id}
            sessionId={sessionId}
            isFlipped={isFlipped}
          />
        ) : null;
      case 'adverb':
        return adverbData ? (
          <AdverbFormsTable
            adverbData={adverbData}
            positiveForm={card.word || card.front}
            isFlipped={isFlipped}
          />
        ) : null;
      default:
        return null;
    }
  };

  const grammarTable = renderGrammarTable();

  return (
    <div
      role={!isFlipped ? 'button' : undefined}
      tabIndex={!isFlipped ? 0 : undefined}
      onClick={!isFlipped ? flipCard : undefined}
      onKeyDown={
        !isFlipped
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                flipCard();
              }
            }
          : undefined
      }
      aria-label={!isFlipped ? t('session.clickToReveal') : undefined}
      className={cn('flex flex-col gap-6', !isFlipped && 'cursor-pointer select-none')}
    >
      {/* Translation */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('grammar.sections.translation')} />
        {translation && (
          <p
            className={cn(
              'text-base text-foreground transition-[filter] duration-200',
              !isFlipped && 'select-none blur-md'
            )}
          >
            {translation}
          </p>
        )}
      </div>

      {/* Grammar table */}
      {grammarTable && (
        <div className="flex flex-col gap-2">
          {grammarSectionTitle && <SectionHeader title={grammarSectionTitle} />}
          {grammarTable}
        </div>
      )}

      {/* Examples */}
      {examples && examples.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeader title={t('grammar.examples.title')} />
          <ExampleSentences key={card.id} examples={examples} isFlipped={isFlipped} />
        </div>
      )}
    </div>
  );
}
