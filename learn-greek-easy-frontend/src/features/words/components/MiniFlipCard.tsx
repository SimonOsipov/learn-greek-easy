import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { CardMasteryItem, MasteryStatus } from '../hooks';

export interface MiniFlipCardProps {
  card: CardMasteryItem;
  onFlip?: (flipped: boolean) => void;
}

const MASTERY_DOT_COLOR: Record<MasteryStatus, string> = {
  none: 'bg-muted-foreground/30',
  studied: 'bg-blue-500',
  mastered: 'bg-green-500',
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function translatePrompt(englishPrompt: string, lang: string, cardType: string): string {
  if (lang !== 'ru') return englishPrompt;

  const cardTypePrompts: Record<string, string> = {
    meaning_el_to_en: 'Что это значит?',
    meaning_en_to_el: 'Как это сказать по-гречески?',
    article: 'Какой артикль?',
  };

  if (cardType in cardTypePrompts) return cardTypePrompts[cardType];

  const promptTranslations: Record<string, string> = {
    'What is the plural form?': 'Какая форма множественного числа?',
    'What is the singular form?': 'Какая форма единственного числа?',
    'What is the plural?': 'Какое множественное число?',
    'What is the singular?': 'Какое единственное число?',
    'Translate this sentence': 'Переведите это предложение',
    'Translate to Greek': 'Переведите на греческий',
    'What is the genitive singular?': 'Какой родительный падеж ед. числа?',
    'What is the genitive plural?': 'Какой родительный падеж мн. числа?',
    'What is the accusative singular?': 'Какой винительный падеж ед. числа?',
    'What is the accusative plural?': 'Какой винительный падеж мн. числа?',
    'What is the vocative singular?': 'Какое звательное ед. числа?',
    'What is the vocative plural?': 'Какое звательное мн. числа?',
  };

  return promptTranslations[englishPrompt] ?? englishPrompt;
}

function extractCardContent(card: CardMasteryItem, lang: string) {
  const isRu = lang === 'ru';
  const front = card.front_content;
  const back = card.back_content;
  return {
    frontPrompt: translatePrompt(asString(front.prompt), lang, card.card_type),
    frontMain: asString(front.main),
    backAnswer: isRu ? asString(back.answer_ru) || asString(back.answer) : asString(back.answer),
    backSub: isRu
      ? asString(back.answer_sub_ru) ||
        asString(back.gender_ru) ||
        asString(back.answer_sub) ||
        asString(back.gender)
      : asString(back.answer_sub) || asString(back.gender) || asString(back.answer_ru),
  };
}

export function MiniFlipCard({ card, onFlip }: MiniFlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const { t, i18n } = useTranslation('deck');
  const lang = i18n.language?.split('-')[0] ?? 'en';
  const { frontPrompt, frontMain, backAnswer, backSub } = extractCardContent(card, lang);
  const dotColor = MASTERY_DOT_COLOR[card.mastery_status];

  const handleFlip = () => {
    const newFlipped = !flipped;
    setFlipped(newFlipped);
    onFlip?.(newFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip();
    }
  };

  return (
    <div
      data-testid={`mini-flip-card-${card.id}`}
      className="h-32 cursor-pointer overflow-hidden [perspective:600px]"
      onClick={handleFlip}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
    >
      <div
        className={`relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        {/* Front face */}
        <div
          aria-hidden={flipped}
          className="absolute inset-0 flex flex-col justify-between rounded-lg border bg-card p-3 shadow-sm [backface-visibility:hidden]"
        >
          <span className="line-clamp-1 text-[10px] text-muted-foreground">{frontPrompt}</span>
          <span className="line-clamp-2 text-center text-sm font-bold">{frontMain}</span>
          <div className="flex items-end justify-between">
            <span className="text-[10px] text-muted-foreground">
              {t(`wordReference.cardType.${card.card_type}`, { defaultValue: card.card_type })}
            </span>
            <div className={`h-2 w-2 rounded-full ${dotColor}`} />
          </div>
        </div>
        {/* Back face */}
        <div
          aria-hidden={!flipped}
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-muted p-3 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <span className="line-clamp-2 text-center text-sm font-bold">{backAnswer}</span>
          {backSub && (
            <span className="mt-1 line-clamp-1 text-center text-xs text-muted-foreground">
              {backSub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
