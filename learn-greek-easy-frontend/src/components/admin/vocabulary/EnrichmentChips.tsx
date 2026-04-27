import React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { computeChipsFromCard, chipColorClasses } from '@/lib/completeness';
import type { AdminVocabularyCard } from '@/services/adminAPI';

interface ChipProps {
  label: string;
  color: 'green' | 'yellow' | 'gray';
  tooltip: string;
  testId?: string;
}

function EnrichmentChip({ label, color, tooltip, testId }: ChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-default ${chipColorClasses[color]}`} data-testid={testId}>
          {label}
        </span>
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
  const chips = computeChipsFromCard(card).filter((c) => c.visible);

  return (
    <div
      className="flex flex-wrap items-center gap-1 pt-1"
      data-testid={`enrichment-chips-${card.id}`}
    >
      {chips.map((chip) => (
        <EnrichmentChip
          key={chip.name}
          label={chip.label}
          color={chip.color}
          tooltip={chip.tooltip}
          testId={`enrichment-${chip.name}-${card.id}`}
        />
      ))}
    </div>
  );
}
