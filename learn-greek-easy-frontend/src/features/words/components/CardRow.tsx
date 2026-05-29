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

export interface CardRowProps {
  card: CardMasteryItem;
}

/**
 * CardRow — dense single-line card representation for list view.
 * Columns: mastery dot · type label · prompt · answer · due (always "—")
 */
export function CardRow({ card }: CardRowProps) {
  const { t } = useTranslation('deck');
  const dotState = masteryToState(card.mastery_status);

  // Determine if the answer side is Greek (el) or English (en)
  const front = card.front_content;
  const back = card.back_content;
  const prompt = typeof front.prompt === 'string' ? front.prompt : '';
  const answer = typeof back.answer === 'string' ? back.answer : '';

  // Greek-answer card types
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
