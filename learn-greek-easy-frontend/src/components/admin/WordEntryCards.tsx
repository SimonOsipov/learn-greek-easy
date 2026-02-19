import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWordEntryCards } from '@/features/words/hooks/useWordEntryCards';
import type { CardRecordResponse, CardRecordType } from '@/services/wordEntryAPI';

interface WordEntryCardsProps {
  entryId: string;
}

const CARD_TYPE_DISPLAY_ORDER: CardRecordType[] = [
  'meaning_el_to_en',
  'meaning_en_to_el',
  'article',
  'plural_form',
  'conjugation',
  'declension',
  'cloze',
  'sentence_translation',
];

interface CardTypeGroup {
  type: CardRecordType;
  cards: CardRecordResponse[];
}

function groupCardsByType(cards: CardRecordResponse[]): CardTypeGroup[] {
  const byType = new Map<CardRecordType, CardRecordResponse[]>();
  for (const card of cards) {
    const group = byType.get(card.card_type) ?? [];
    group.push(card);
    byType.set(card.card_type, group);
  }
  return CARD_TYPE_DISPLAY_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    cards: byType.get(type) ?? [],
  }));
}

export function WordEntryCards({ entryId }: WordEntryCardsProps) {
  const { t } = useTranslation('admin');
  const { cards, isLoading, isError, refetch } = useWordEntryCards({
    wordEntryId: entryId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="cards-tab-loading">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="cards-tab-error">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('wordEntryDetail.cardsError')}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-3">
          {t('wordEntryDetail.cardsRetry')}
        </Button>
      </div>
    );
  }

  const groups = groupCardsByType(cards ?? []);

  if (groups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" data-testid="cards-tab-empty">
        {t('wordEntryDetail.cardsEmpty')}
      </p>
    );
  }

  const totalCards = groups.reduce((sum, g) => sum + g.cards.length, 0);
  const typeCount = groups.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-testid="cards-tab-summary">
        {typeCount === 1
          ? t('wordEntryDetail.cardsSummarySingularType', { count: totalCards })
          : t('wordEntryDetail.cardsSummary', { count: totalCards, types: typeCount })}
      </p>
      {groups.map((group) => (
        <CardTypeSection key={group.type} group={group} />
      ))}
    </div>
  );
}

function CardTypeSection({ group }: { group: CardTypeGroup }) {
  const { t } = useTranslation('admin');
  const label = t(`wordEntryDetail.cardType.${group.type}`);

  return (
    <div data-testid={`card-type-group-${group.type}`}>
      <div
        className="mb-2 flex items-center gap-2"
        data-testid={`card-type-group-header-${group.type}`}
      >
        <h4 className="text-sm font-medium">{label}</h4>
        <span className="text-xs text-muted-foreground">({group.cards.length})</span>
      </div>
      <div className="space-y-2">
        {group.cards.map((card) => (
          <CardRecord key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function CardRecord({ card }: { card: CardRecordResponse }) {
  const { t } = useTranslation('admin');
  const front = card.front_content as Record<string, unknown>;
  const back = card.back_content as Record<string, unknown>;

  const frontPrompt = typeof front.prompt === 'string' ? front.prompt : undefined;
  const frontMain = typeof front.main === 'string' ? front.main : undefined;
  const backAnswer = typeof back.answer === 'string' ? back.answer : undefined;
  const backAnswerSub = typeof back.answer_sub === 'string' ? back.answer_sub : undefined;

  return (
    <div className="rounded-md border p-3 text-sm" data-testid={`card-record-${card.id}`}>
      <div className="space-y-1">
        {frontPrompt && <p className="text-xs text-muted-foreground">{frontPrompt}</p>}
        {frontMain && <p className="font-medium">{frontMain}</p>}
        {backAnswer && <p className="text-muted-foreground">{backAnswer}</p>}
        {backAnswerSub && <p className="text-xs text-muted-foreground">{backAnswerSub}</p>}
      </div>
      <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
        {card.tier !== null && (
          <span>
            {t('wordEntryDetail.cardTier')}: {card.tier}
          </span>
        )}
        <span>{card.variant_key}</span>
      </div>
    </div>
  );
}
