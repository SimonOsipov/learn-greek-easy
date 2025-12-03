import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import type { Card } from '@/types/review';

import { CasesTable } from './CasesTable';
import { PremiumGate } from '../shared/PremiumGate';

export type { Card };

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
    <div className="border-t border-gray-200 bg-gray-50 px-6 py-6">
      <div className="mb-5 flex min-h-[40px] items-center gap-2">
        <span className="text-base font-bold text-gray-900">📝</span>
        <span className="text-base font-bold text-gray-900">Noun Forms & Cases</span>
      </div>

      <PremiumGate isLocked={!isPremium} badgeText="Pro">
        <CasesTable cases={cases} />
      </PremiumGate>
    </div>
  );
}
