import { useTranslation } from 'react-i18next';

import { type GeneratedNounCases } from '@/services/adminAPI';

interface DeclensionTableProps {
  cases: GeneratedNounCases;
}

const CASE_KEYS = ['nominative', 'genitive', 'accusative', 'vocative'] as const;

export function DeclensionTable({ cases }: DeclensionTableProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="declension-table" className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left font-medium">
            <th className="pb-1 pr-2" />
            <th scope="col" className="pb-1 pr-2">
              {t('generateNoun.generation.singular')}
            </th>
            <th scope="col" className="pb-1">
              {t('generateNoun.generation.plural')}
            </th>
          </tr>
        </thead>
        <tbody>
          {CASE_KEYS.map((caseKey) => (
            <tr key={caseKey} className="border-b last:border-0">
              <th scope="row" className="py-1 pr-2 font-medium">
                {t(
                  `generateNoun.generation.case${caseKey.charAt(0).toUpperCase() + caseKey.slice(1)}`
                )}
              </th>
              <td className="py-1 pr-2">{cases.singular[caseKey]}</td>
              <td className="py-1">{cases.plural[caseKey]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
