import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AdminVocabularyCard } from '@/services/adminAPI';

type ChipColor = 'green' | 'yellow' | 'gray';

const chipColorClasses: Record<ChipColor, string> = {
  green:
    'border-green-600/50 bg-green-50 text-green-700 dark:border-green-500/50 dark:bg-green-950/30 dark:text-green-400',
  yellow:
    'border-yellow-600/50 bg-yellow-50 text-yellow-700 dark:border-yellow-500/50 dark:bg-yellow-950/30 dark:text-yellow-400',
  gray: 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
};

interface ChipProps {
  label: string;
  color: ChipColor;
  tooltip: string;
  testId?: string;
}

function EnrichmentChip({ label, color, tooltip, testId }: ChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn('cursor-default px-1.5 py-0 text-[10px]', chipColorClasses[color])}
          data-testid={testId}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface EnrichmentChipsProps {
  card: AdminVocabularyCard;
}

export function EnrichmentChips({ card }: EnrichmentChipsProps) {
  // EN chip: back_text_en (singular, always present) + translation_en_plural
  const enCount = (card.back_text_en ? 1 : 0) + (card.translation_en_plural ? 1 : 0);
  const enColor: ChipColor = enCount === 2 ? 'green' : 'yellow'; // never gray per AC #9

  // RU chip: back_text_ru + translation_ru_plural
  const ruCount = (card.back_text_ru ? 1 : 0) + (card.translation_ru_plural ? 1 : 0);
  const ruColor: ChipColor = ruCount === 2 ? 'green' : ruCount === 1 ? 'yellow' : 'gray';

  // Pronunciation chip
  const hasPron = !!card.pronunciation;
  const pronColor: ChipColor = hasPron ? 'green' : 'gray';

  // Audio chip
  let audioColor: ChipColor = 'gray';
  let audioLabel = 'Audio ✗';
  if (card.audio_status === 'ready') {
    audioColor = 'green';
    audioLabel = 'Audio ✓';
  } else if (card.audio_status === 'generating') {
    audioColor = 'yellow';
    audioLabel = 'Audio …';
  }

  // Grammar chip (only when grammar_total > 0)
  const showGram = card.grammar_total > 0;
  let gramColor: ChipColor = 'gray';
  if (card.grammar_filled === card.grammar_total) gramColor = 'green';
  else if (card.grammar_filled > 0) gramColor = 'yellow';

  // Example chip
  const exColor: ChipColor =
    card.example_count === 0
      ? 'gray'
      : card.examples_with_en === card.example_count &&
          card.examples_with_ru === card.example_count &&
          card.examples_with_audio === card.example_count
        ? 'green'
        : 'yellow';

  return (
    <div
      className="flex flex-wrap items-center gap-1 pt-1"
      data-testid={`enrichment-chips-${card.id}`}
    >
      <EnrichmentChip
        label={`EN ${enCount}/2`}
        color={enColor}
        tooltip={`English: singular (${card.back_text_en ? 'present' : 'missing'}), plural (${card.translation_en_plural ? 'present' : 'missing'})`}
        testId={`enrichment-en-${card.id}`}
      />
      <EnrichmentChip
        label={`RU ${ruCount}/2`}
        color={ruColor}
        tooltip={`Russian: singular (${card.back_text_ru ? 'present' : 'missing'}), plural (${card.translation_ru_plural ? 'present' : 'missing'})`}
        testId={`enrichment-ru-${card.id}`}
      />
      <EnrichmentChip
        label={hasPron ? 'Pron ✓' : 'Pron ✗'}
        color={pronColor}
        tooltip={hasPron ? `Pronunciation: ${card.pronunciation}` : 'Pronunciation: missing'}
        testId={`enrichment-pron-${card.id}`}
      />
      <EnrichmentChip
        label={audioLabel}
        color={audioColor}
        tooltip={`Audio: ${card.audio_status}`}
        testId={`enrichment-audio-${card.id}`}
      />
      {showGram && (
        <EnrichmentChip
          label={`Gram ${card.grammar_filled}/${card.grammar_total}`}
          color={gramColor}
          tooltip={`Grammar: ${card.grammar_filled} of ${card.grammar_total} fields filled`}
          testId={`enrichment-gram-${card.id}`}
        />
      )}
      <EnrichmentChip
        label={`Ex ${card.example_count}`}
        color={exColor}
        tooltip={`Examples: ${card.example_count} total, ${card.examples_with_en} with EN, ${card.examples_with_ru} with RU, ${card.examples_with_audio} with audio`}
        testId={`enrichment-ex-${card.id}`}
      />
    </div>
  );
}
