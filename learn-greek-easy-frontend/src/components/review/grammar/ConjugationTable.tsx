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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {persons.map(({ label, greek, english }, index) => (
        <div
          key={label}
          className={cn(
            'grid grid-cols-[140px_1fr_1fr] border-gray-200',
            index < persons.length - 1 && 'border-b'
          )}
        >
          <div className="bg-gray-50 px-4 py-3.5 text-center text-sm font-semibold text-gray-700">
            {label}
          </div>
          <div className="px-4 py-3.5 text-center text-sm font-medium text-gray-900">{greek}</div>
          <div className="px-4 py-3.5 text-center text-sm italic text-gray-600">{english}</div>
        </div>
      ))}
    </div>
  );
}
