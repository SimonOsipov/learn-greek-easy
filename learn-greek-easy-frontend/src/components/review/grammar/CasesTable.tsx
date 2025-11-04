import { cn } from '@/lib/utils';

interface CasesTableProps {
  cases: Array<{ label: string; value: string }>;
}

export function CasesTable({ cases }: CasesTableProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
      {cases.map(({ label, value }, index) => (
        <div
          key={label}
          className={cn(
            'grid grid-cols-[140px_1fr] border-gray-200',
            index < cases.length - 1 && 'border-b'
          )}
        >
          <div className="px-4 py-3.5 text-sm font-semibold text-gray-700 bg-gray-50 text-center">
            {label}
          </div>
          <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-center">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
