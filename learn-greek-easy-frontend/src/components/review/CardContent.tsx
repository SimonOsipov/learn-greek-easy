import { useTranslation } from 'react-i18next';

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

interface CardContentProps {
  card: CardReview;
  isFlipped: boolean;
}

export function CardContent({ card, isFlipped }: CardContentProps) {
  const { t, i18n } = useTranslation('review');
  const { flipCard } = useReviewStore();
  const partOfSpeech = card.part_of_speech;

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

  const renderGrammarTable = () => {
    switch (partOfSpeech) {
      case 'noun':
        return nounData ? <NounDeclensionTable nounData={nounData} /> : null;
      case 'verb':
        return verbData ? <TenseTabs verbData={verbData} /> : null;
      case 'adjective':
        return adjectiveData ? <AdjectiveDeclensionTables adjectiveData={adjectiveData} /> : null;
      case 'adverb':
        return adverbData ? (
          <AdverbFormsTable adverbData={adverbData} positiveForm={card.word || card.front} />
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
      className={cn(
        'grid gap-6 transition-[filter] duration-200 md:grid-cols-2',
        !isFlipped && 'cursor-pointer select-none blur-md'
      )}
    >
      {/* Left column: Translations + Examples */}
      <div className="space-y-4">
        {/* Translation */}
        <div className="rounded-lg border border-border bg-card p-4">
          {translation && <p className="text-base">{translation}</p>}
        </div>

        {/* Examples */}
        {examples && examples.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {t('grammar.examples.title')}
            </h3>
            <ExampleSentences examples={examples} />
          </div>
        )}
      </div>

      {/* Right column: Grammar tables */}
      <div>{grammarTable}</div>
    </div>
  );
}
