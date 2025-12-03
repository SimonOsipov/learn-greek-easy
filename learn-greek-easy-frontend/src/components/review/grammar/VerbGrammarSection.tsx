import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import type { Card } from '@/types/review';

import { ConjugationTable } from './ConjugationTable';
import { TenseTabs } from './TenseTabs';
import { PremiumGate } from '../shared/PremiumGate';

export type { Card };

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
    <div className="border-t border-gray-200 bg-gray-50 px-6 py-6">
      <div className="mb-5 flex min-h-[40px] items-center justify-between">
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
