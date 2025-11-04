import { cn } from '@/lib/utils';
import type { ConjugationSet } from '@/types/review';

interface ConjugationTableProps {
  conjugation: ConjugationSet;
}

export function ConjugationTable({ conjugation }: ConjugationTableProps) {
  const persons = [
    { label: 'I', greek: conjugation.firstSingular, english: 'I ...' },
    { label: 'You', greek: conjugation.secondSingular, english: 'You ...' },
    {
      label: 'He / She / It',
      greek: conjugation.thirdSingular,
      english: 'He / she / it ...',
    },
    { label: 'We', greek: conjugation.firstPlural, english: 'We ...' },
    { label: 'You (plural)', greek: conjugation.secondPlural, english: 'You ...' },
    { label: 'They', greek: conjugation.thirdPlural, english: 'They ...' },
  ];

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
      {persons.map(({ label, greek, english }, index) => (
        <div
          key={label}
          className={cn(
            'grid grid-cols-[140px_1fr_1fr] border-gray-200',
            index < persons.length - 1 && 'border-b'
          )}
        >
          <div className="px-4 py-3.5 text-sm font-semibold text-gray-700 bg-gray-50 text-center">
            {label}
          </div>
          <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-center">
            {greek}
          </div>
          <div className="px-4 py-3.5 text-sm italic text-gray-600 text-center">
            {english}
          </div>
        </div>
      ))}
    </div>
  );
}
