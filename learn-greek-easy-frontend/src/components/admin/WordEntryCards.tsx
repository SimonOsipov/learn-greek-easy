import React from 'react';

import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGenerateCards } from '@/features/words/hooks/useGenerateCards';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { useWordEntryCards } from '@/features/words/hooks/useWordEntryCards';
import { getCardTypeEligibility } from '@/lib/cardTypeEligibility';
import { getVariantKeyLabel } from '@/lib/variantKeyLabels';
import type {
  AudioStatus,
  CardRecordResponse,
  CardRecordType,
  GenerateCardType,
  WordEntryResponse,
} from '@/services/wordEntryAPI';

import { AudioStatusBadge } from './AudioStatusBadge';
import { CardGenerateButton } from './CardGenerateButton';
import { NotSet } from './NotSet';

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

const AUDIO_CARD_TYPES = new Set<CardRecordType>([
  'meaning_el_to_en',
  'meaning_en_to_el',
  'sentence_translation',
]);

interface CardTypeGroup {
  type: CardRecordType;
  cards: CardRecordResponse[];
}

const CARD_TYPE_TO_GENERATOR: Partial<Record<CardRecordType, GenerateCardType>> = {
  meaning_el_to_en: 'meaning',
  meaning_en_to_el: 'meaning',
  plural_form: 'plural_form',
  article: 'article',
  sentence_translation: 'sentence_translation',
};

const GENERATOR_TYPE_DISPLAY_ORDER: GenerateCardType[] = [
  'meaning',
  'article',
  'plural_form',
  'sentence_translation',
];

const RU_CARD_TYPES = new Set<CardRecordType>([
  'meaning_el_to_en',
  'meaning_en_to_el',
  'sentence_translation',
  'plural_form',
]);

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

function getCardAudioStatus(
  card: CardRecordResponse,
  wordEntry: WordEntryResponse | null
): AudioStatus | null {
  if (!wordEntry) return null;
  if (card.card_type === 'meaning_el_to_en' || card.card_type === 'meaning_en_to_el') {
    return wordEntry.audio_status ?? 'missing';
  }
  if (card.card_type === 'sentence_translation') {
    const front = card.front_content as Record<string, unknown>;
    const exampleId = typeof front.example_id === 'string' ? front.example_id : undefined;
    if (!exampleId) return 'missing';
    const example = wordEntry.examples?.find((ex) => ex.id === exampleId);
    if (!example) return 'missing';
    return example.audio_status ?? 'missing';
  }
  return null;
}

function getCardRuTranslation(
  card: CardRecordResponse,
  wordEntry: WordEntryResponse | null
): string | null {
  if (!wordEntry) return null;
  if (card.card_type === 'meaning_el_to_en' || card.card_type === 'meaning_en_to_el') {
    return wordEntry.translation_ru ?? null;
  }
  if (card.card_type === 'sentence_translation') {
    const back = card.back_content as Record<string, unknown>;
    const direction = (card.front_content as Record<string, unknown>).direction;
    if (direction === 'target_to_el') return null;
    return typeof back.answer_ru === 'string' ? back.answer_ru : null;
  }
  if (card.card_type === 'plural_form') {
    const back = card.back_content as Record<string, unknown>;
    return typeof back.answer_sub_ru === 'string' ? back.answer_sub_ru : null;
  }
  return null;
}

function getIneligibilityReason(
  genType: GenerateCardType,
  wordEntry: WordEntryResponse
): string | null {
  const eligibility = getCardTypeEligibility(wordEntry);
  if (eligibility[genType]) return null;

  switch (genType) {
    case 'meaning':
      return 'wordEntryDetail.eligibility.meaningMissing';
    case 'plural_form':
      if (wordEntry.part_of_speech !== 'noun' && wordEntry.part_of_speech !== 'adjective') {
        return 'wordEntryDetail.eligibility.pluralFormWrongPos';
      }
      return 'wordEntryDetail.eligibility.pluralFormMissing';
    case 'article':
      if (wordEntry.part_of_speech !== 'noun') {
        return 'wordEntryDetail.eligibility.articleNotNoun';
      }
      return 'wordEntryDetail.eligibility.articleMissing';
    case 'sentence_translation':
      return 'wordEntryDetail.eligibility.sentenceMissing';
    default:
      return null;
  }
}

function AvailableCardTypes({
  types,
  wordEntry,
  onGenerate,
  pendingType,
}: {
  types: GenerateCardType[];
  wordEntry: WordEntryResponse;
  onGenerate: (type: GenerateCardType) => void;
  pendingType: GenerateCardType | undefined;
}) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="available-card-types">
      <h4 className="mb-2 text-sm font-medium">{t('wordEntryDetail.availableCardTypes')}</h4>
      <div className="space-y-2">
        {types.map((genType) => {
          const reason = getIneligibilityReason(genType, wordEntry);
          const isEligible = reason === null;
          const isPending = pendingType === genType;

          return (
            <div
              key={genType}
              className="flex items-center gap-2 rounded-md border p-2"
              data-testid={`available-type-${genType}`}
            >
              <span className="text-sm">{t(`wordEntryDetail.cardTypeGenerator.${genType}`)}</span>
              {isEligible ? (
                <CardGenerateButton
                  label={t('wordEntryDetail.generateCards')}
                  onClick={() => onGenerate(genType)}
                  isLoading={isPending}
                  disabled={pendingType !== undefined && !isPending}
                  data-testid={`generate-btn-${genType}`}
                />
              ) : (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid={`ineligible-reason-${genType}`}
                >
                  {t(reason)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WordEntryCards({ entryId }: WordEntryCardsProps) {
  const { t } = useTranslation('admin');
  const { cards, isLoading, isError, refetch } = useWordEntryCards({
    wordEntryId: entryId,
  });
  const { wordEntry } = useWordEntry({ wordId: entryId });
  const generateCards = useGenerateCards();

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
  const existingGeneratorTypes = new Set(
    groups.map((g) => CARD_TYPE_TO_GENERATOR[g.type]).filter(Boolean) as GenerateCardType[]
  );
  const availableGeneratorTypes = GENERATOR_TYPE_DISPLAY_ORDER.filter(
    (gt) => !existingGeneratorTypes.has(gt)
  );

  const totalCards = groups.reduce((sum, g) => sum + g.cards.length, 0);
  const typeCount = groups.length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {groups.length === 0 ? (
          <p
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="cards-tab-empty"
          >
            {t('wordEntryDetail.cardsEmpty')}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground" data-testid="cards-tab-summary">
              {typeCount === 1
                ? t('wordEntryDetail.cardsSummarySingularType', { count: totalCards })
                : t('wordEntryDetail.cardsSummary', { count: totalCards, types: typeCount })}
            </p>
            {groups.map((group) => {
              const genType = CARD_TYPE_TO_GENERATOR[group.type];
              return (
                <CardTypeSection
                  key={group.type}
                  group={group}
                  wordEntry={wordEntry ?? null}
                  onRegenerate={
                    genType
                      ? () => generateCards.mutate({ wordEntryId: entryId, cardType: genType })
                      : undefined
                  }
                  isRegenerating={
                    genType
                      ? generateCards.isPending && generateCards.variables?.cardType === genType
                      : false
                  }
                />
              );
            })}
          </>
        )}
        {availableGeneratorTypes.length > 0 && wordEntry && (
          <AvailableCardTypes
            types={availableGeneratorTypes}
            wordEntry={wordEntry}
            onGenerate={(genType) =>
              generateCards.mutate({ wordEntryId: entryId, cardType: genType })
            }
            pendingType={generateCards.isPending ? generateCards.variables?.cardType : undefined}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function CardTypeSection({
  group,
  wordEntry,
  onRegenerate,
  isRegenerating,
}: {
  group: CardTypeGroup;
  wordEntry: WordEntryResponse | null;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
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
        {onRegenerate && (
          <CardGenerateButton
            label={t('wordEntryDetail.regenerateCards')}
            onClick={onRegenerate}
            isLoading={isRegenerating}
            data-testid={`regenerate-btn-${group.type}`}
          />
        )}
      </div>
      <div className="space-y-2">
        {group.cards.map((card) => {
          const audioStatus = AUDIO_CARD_TYPES.has(card.card_type)
            ? getCardAudioStatus(card, wordEntry)
            : null;
          return (
            <CardRecord key={card.id} card={card} audioStatus={audioStatus} wordEntry={wordEntry} />
          );
        })}
      </div>
    </div>
  );
}

function CardRecord({
  card,
  audioStatus,
  wordEntry,
}: {
  card: CardRecordResponse;
  audioStatus: AudioStatus | null;
  wordEntry: WordEntryResponse | null;
}) {
  const { t } = useTranslation('admin');
  const front = card.front_content as Record<string, unknown>;
  const back = card.back_content as Record<string, unknown>;

  const frontPrompt = typeof front.prompt === 'string' ? front.prompt : undefined;
  const frontMain = typeof front.main === 'string' ? front.main : undefined;
  const backAnswer = typeof back.answer === 'string' ? back.answer : undefined;
  const backAnswerSub = typeof back.answer_sub === 'string' ? back.answer_sub : undefined;

  const ruTranslation = getCardRuTranslation(card, wordEntry);
  const showRuRow =
    RU_CARD_TYPES.has(card.card_type) &&
    !(
      card.card_type === 'sentence_translation' &&
      (front as Record<string, unknown>).direction === 'target_to_el'
    );

  return (
    <div className="rounded-md border p-3 text-sm" data-testid={`card-record-${card.id}`}>
      <div className="space-y-1.5">
        <div>
          {frontPrompt && <p className="text-xs text-muted-foreground">{frontPrompt}</p>}
          {frontMain && <p className="font-medium">{frontMain}</p>}
        </div>
        <Separator />
        <div>
          {backAnswer && <p className="text-muted-foreground">{backAnswer}</p>}
          {backAnswerSub && <p className="text-xs text-muted-foreground">{backAnswerSub}</p>}
          {showRuRow &&
            (ruTranslation ? (
              <p className="text-xs text-muted-foreground">{ruTranslation}</p>
            ) : (
              <NotSet />
            ))}
        </div>
      </div>
      {(() => {
        const footerItems: React.ReactNode[] = [];
        if (card.tier !== null) {
          footerItems.push(
            <Tooltip key="tier">
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  {t('wordEntryDetail.cardTier')}: {card.tier}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {t('wordEntryDetail.cards.tierTooltip')}
              </TooltipContent>
            </Tooltip>
          );
        }
        footerItems.push(
          <span key="variant" className="flex flex-col leading-tight">
            <span>{getVariantKeyLabel(card.variant_key)}</span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {card.variant_key}
            </span>
          </span>
        );
        if (audioStatus) {
          footerItems.push(
            <AudioStatusBadge
              key="audio"
              status={audioStatus}
              data-testid={`card-audio-badge-${card.id}`}
            />
          );
        }
        return (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            {footerItems.map((item, i) => (
              <React.Fragment key={String(i)}>
                {i > 0 && <Separator orientation="vertical" className="h-3" />}
                {item}
              </React.Fragment>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
