import { cn } from '@/lib/utils';

interface TenseTabsProps {
  selectedTense: 'present' | 'past' | 'future';
  onTenseChange: (tense: 'present' | 'past' | 'future') => void;
  disabled?: boolean;
}

export function TenseTabs({ selectedTense, onTenseChange, disabled }: TenseTabsProps) {
  const tenses = ['present', 'past', 'future'] as const;

  return (
    <div className="flex gap-2 bg-white p-1 rounded-lg">
      {tenses.map((tense) => (
        <button
          key={tense}
          onClick={() => !disabled && onTenseChange(tense)}
          disabled={disabled}
          className={cn(
            'px-4 py-2 rounded-md text-xs font-semibold transition-all',
            selectedTense === tense
              ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white'
              : 'text-gray-600 hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed'
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
