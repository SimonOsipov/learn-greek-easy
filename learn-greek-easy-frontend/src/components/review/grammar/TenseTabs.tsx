import { cn } from '@/lib/utils';

interface TenseTabsProps {
  selectedTense: 'present' | 'past' | 'future';
  onTenseChange: (tense: 'present' | 'past' | 'future') => void;
  disabled?: boolean;
}

export function TenseTabs({ selectedTense, onTenseChange, disabled }: TenseTabsProps) {
  const tenses = ['present', 'past', 'future'] as const;

  return (
    <div className="flex gap-2 rounded-lg bg-card p-1">
      {tenses.map((tense) => (
        <button
          key={tense}
          onClick={() => !disabled && onTenseChange(tense)}
          disabled={disabled}
          className={cn(
            'rounded-md px-4 py-2 text-xs font-semibold transition-all',
            selectedTense === tense
              ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white'
              : 'text-muted-foreground hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          aria-pressed={selectedTense === tense}
          type="button"
        >
          {tense.charAt(0).toUpperCase() + tense.slice(1)}
        </button>
      ))}
    </div>
  );
}
