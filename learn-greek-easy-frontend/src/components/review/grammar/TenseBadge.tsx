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
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
  },
  imperfect: {
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  past: {
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
  future: {
    bgClass: 'bg-sky-100 dark:bg-sky-900/30',
    textClass: 'text-sky-700 dark:text-sky-300',
  },
  perfect: {
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
    textClass: 'text-violet-700 dark:text-violet-300',
  },
  imperative: {
    bgClass: 'bg-rose-100 dark:bg-rose-900/30',
    textClass: 'text-rose-700 dark:text-rose-300',
  },
};

// Default styling for unknown tenses
const DEFAULT_CONFIG = {
  bgClass: 'bg-gray-100 dark:bg-gray-800',
  textClass: 'text-gray-600 dark:text-gray-300',
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
