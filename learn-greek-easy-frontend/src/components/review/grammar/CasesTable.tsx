import { cn } from '@/lib/utils';

interface CasesTableProps {
  cases: Array<{ label: string; value: string }>;
}

export function CasesTable({ cases }: CasesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {cases.map(({ label, value }, index) => (
        <div
          key={label}
          className={cn(
            'grid grid-cols-[140px_1fr] border-gray-200',
            index < cases.length - 1 && 'border-b'
          )}
        >
          <div className="bg-gray-50 px-4 py-3.5 text-center text-sm font-semibold text-gray-700">
            {label}
          </div>
          <div className="px-4 py-3.5 text-center text-sm font-medium text-gray-900">{value}</div>
        </div>
      ))}
    </div>
  );
}
