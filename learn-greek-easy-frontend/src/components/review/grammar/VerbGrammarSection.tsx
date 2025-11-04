import type { Card } from '@/types/review';
export type { Card };
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { PremiumGate } from '../shared/PremiumGate';
import { ConjugationTable } from './ConjugationTable';
import { TenseTabs } from './TenseTabs';

interface VerbGrammarSectionProps {
  verbData: Card['verbData'];
  selectedTense: 'present' | 'past' | 'future';
  onTenseChange: (tense: 'present' | 'past' | 'future') => void;
}

export function VerbGrammarSection({
  verbData,
  selectedTense,
  onTenseChange,
}: VerbGrammarSectionProps) {
  const isPremium = usePremiumAccess();

  if (!verbData) return null;

  const conjugation = verbData.conjugations[selectedTense];

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-6">
      <div className="flex items-center justify-between mb-5 min-h-[40px]">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">📚</span>
          <span className="text-base font-bold text-gray-900">Conjugation</span>
        </div>

        <TenseTabs
          selectedTense={selectedTense}
          onTenseChange={onTenseChange}
          disabled={!isPremium}
        />
      </div>

      <PremiumGate isLocked={!isPremium} badgeText="Pro">
        <ConjugationTable conjugation={conjugation} />
      </PremiumGate>
    </div>
  );
}
