import type { Card } from '@/types/review';
export type { Card };
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { PremiumGate } from '../shared/PremiumGate';
import { CasesTable } from './CasesTable';

interface NounGrammarSectionProps {
  nounData: Card['nounData'];
}

export function NounGrammarSection({ nounData }: NounGrammarSectionProps) {
  const isPremium = usePremiumAccess();

  if (!nounData) return null;

  const cases = [
    { label: 'Singular', value: nounData.cases.nominativeSingular },
    { label: 'Plural', value: nounData.cases.nominativePlural },
    { label: 'Genitive Singular', value: nounData.cases.genitiveSingular },
    { label: 'Genitive Plural', value: nounData.cases.genitivePlural },
  ];

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-6">
      <div className="flex items-center gap-2 mb-5 min-h-[40px]">
        <span className="text-base font-bold text-gray-900">📝</span>
        <span className="text-base font-bold text-gray-900">Noun Forms & Cases</span>
      </div>

      <PremiumGate isLocked={!isPremium} badgeText="Pro">
        <CasesTable cases={cases} />
      </PremiumGate>
    </div>
  );
}
