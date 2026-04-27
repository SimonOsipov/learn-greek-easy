import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TenseBadgeProps {
  tense: string;
  className?: string;
}

// Known tense values with specific colors
const KNOWN_TENSES = ['present', 'imperfect', 'past', 'future', 'perfect', 'imperative'] as const;
type KnownTense = (typeof KNOWN_TENSES)[number];

const TENSE_CONFIG: Record<KnownTense, { bgClass: string; textClass: string }> = {
  present: {
    bgClass: 'bg-tense-1/15',
    textClass: 'text-tense-1',
  },
  imperfect: {
    bgClass: 'bg-tense-2/15',
    textClass: 'text-tense-2',
  },
  past: {
    bgClass: 'bg-tense-3/15',
    textClass: 'text-tense-3',
  },
  future: {
    bgClass: 'bg-tense-4/15',
    textClass: 'text-tense-4',
  },
  perfect: {
    bgClass: 'bg-tense-5/15',
    textClass: 'text-tense-5',
  },
  imperative: {
    bgClass: 'bg-tense-6/15',
    textClass: 'text-tense-6',
  },
};

// Default styling for unknown tenses
const DEFAULT_CONFIG = {
  bgClass: 'bg-muted',
  textClass: 'text-muted-foreground',
};

function isKnownTense(tense: string): tense is KnownTense {
  return KNOWN_TENSES.includes(tense as KnownTense);
}

export function TenseBadge({ tense, className }: TenseBadgeProps) {
  const { t } = useTranslation('review');

  const config = isKnownTense(tense) ? TENSE_CONFIG[tense] : DEFAULT_CONFIG;

  // Try to get translated label, fall back to raw tense value for unknown tenses
  const label = isKnownTense(tense) ? t(`grammar.verbConjugation.tenses.${tense}`) : tense;

  return (
    <Badge
      className={cn(
        // Override base badge styling for smaller/more muted appearance
        'px-1.5 py-0.5 text-[10px] font-medium',
        config.bgClass,
        config.textClass,
        className
      )}
      data-testid="tense-badge"
    >
      {label}
    </Badge>
  );
}
