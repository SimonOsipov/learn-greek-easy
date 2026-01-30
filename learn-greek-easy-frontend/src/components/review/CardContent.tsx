import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { CardReview } from '@/types/review';

import {
  NounDeclensionTable,
  VerbConjugationGrid,
  AdjectiveDeclensionTables,
  AdverbFormsTable,
  ExampleSentences,
} from './grammar';

interface CardContentProps {
  card: CardReview;
  isFlipped: boolean;
}

export function CardContent({ card, isFlipped }: CardContentProps) {
  const { t } = useTranslation('review');
  const partOfSpeech = card.part_of_speech;

  // Get grammar data from API (snake_case fields)
  const nounData = card.noun_data;
  const verbData = card.verb_data;
  const adjectiveData = card.adjective_data;
  const adverbData = card.adverb_data;
  const examples = card.examples;

  const renderGrammarTable = () => {
    switch (partOfSpeech) {
      case 'noun':
        return nounData ? <NounDeclensionTable nounData={nounData} /> : null;
      case 'verb':
        return verbData ? <VerbConjugationGrid verbData={verbData} /> : null;
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
      className={cn(
        'grid gap-6 transition-[filter] duration-200 md:grid-cols-2',
        !isFlipped && 'pointer-events-none select-none blur-md'
      )}
    >
      {/* Left column: Translations + Examples */}
      <div className="space-y-4">
        {/* Translations */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <p>
              <span className="text-sm font-medium text-muted-foreground">EN: </span>
              <span>{card.translation || card.back}</span>
            </p>
            {card.back_text_ru && (
              <p>
                <span className="text-sm font-medium text-muted-foreground">RU: </span>
                <span>{card.back_text_ru}</span>
              </p>
            )}
          </div>
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
