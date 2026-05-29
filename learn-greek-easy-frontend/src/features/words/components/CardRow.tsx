import { useTranslation } from 'react-i18next';

import type { CardMasteryItem, MasteryStatus } from '../hooks';

/**
 * Maps mastery_status to the data-state value expected by dx-card-mast-dot CSS.
 * none     → '' (grey)
 * studied  → 'learning' (primary/blue)
 * mastered → 'mastered' (green)
 */
function masteryToState(status: MasteryStatus): '' | 'learning' | 'mastered' {
  if (status === 'mastered') return 'mastered';
  if (status === 'studied') return 'learning';
  return '';
}

/**
 * Prompt translation map for RU locale — mirrors MiniFlipCard.translatePrompt logic.
 */
const PROMPT_TRANSLATIONS_RU: Record<string, string> = {
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

const CARD_TYPE_PROMPTS_RU: Record<string, string> = {
  meaning_el_to_en: 'Что это значит?',
  meaning_en_to_el: 'Как это сказать по-гречески?',
  article: 'Какой артикль?',
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function resolvePrompt(front: Record<string, unknown>, cardType: string, lang: string): string {
  const englishPrompt = asString(front.prompt);
  if (lang !== 'ru') return englishPrompt;
  // Card-type-level overrides first
  if (cardType in CARD_TYPE_PROMPTS_RU) return CARD_TYPE_PROMPTS_RU[cardType];
  // Fall back to word-level translation map
  return PROMPT_TRANSLATIONS_RU[englishPrompt] ?? englishPrompt;
}

function resolveAnswer(back: Record<string, unknown>, lang: string): string {
  if (lang === 'ru') {
    return asString(back.answer_ru) || asString(back.answer);
  }
  return asString(back.answer);
}

export interface CardRowProps {
  card: CardMasteryItem;
}

/**
 * CardRow — dense single-line card representation for list view.
 * Columns: mastery dot · type label · prompt · answer · due (always "—")
 *
 * Locale-aware: when i18n language is "ru", uses answer_ru (fallback answer)
 * and translates the English prompt via the same map as MiniFlipCard.
 */
export function CardRow({ card }: CardRowProps) {
  const { t, i18n } = useTranslation('deck');
  const dotState = masteryToState(card.mastery_status);
  const lang = i18n.language?.split('-')[0] ?? 'en';

  const front = card.front_content;
  const back = card.back_content;
  const prompt = resolvePrompt(front, card.card_type, lang);
  const answer = resolveAnswer(back, lang);

  // Determine if the answer side is Greek (el) or English (en)
  const elAnswerTypes = new Set([
    'meaning_en_to_el',
    'plural_form',
    'article',
    'declension',
    'conjugation',
    'cloze',
  ]);
  const answerLang = elAnswerTypes.has(card.card_type) ? 'el' : 'en';

  const typeLabel = t(`wordReference.cardType.${card.card_type}`, {
    defaultValue: card.card_type,
  });

  return (
    <div className="dx-card-row" data-side={answerLang} data-testid={`card-row-${card.id}`}>
      {/* 1. Mastery dot */}
      <span
        className="dx-card-mast-dot"
        data-state={dotState || undefined}
        data-testid="card-row-mastery-dot"
        aria-hidden="true"
      />
      {/* 2. Type label */}
      <span className="dx-card-row-type" data-testid="card-row-type">
        {typeLabel}
      </span>
      {/* 3. Prompt */}
      <span className="dx-card-row-prompt" data-testid="card-row-prompt">
        {prompt}
      </span>
      {/* 4. Answer */}
      <span className="dx-card-row-answer" lang={answerLang} data-testid="card-row-answer">
        {answer}
      </span>
      {/* 5. Due — always inert "—" (no due date field on CardMasteryItem) */}
      <span className="dx-card-row-due" data-testid="card-row-due">
        —
      </span>
    </div>
  );
}
