import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { NounData } from '@/types/grammar';

export interface NounDeclensionTableProps {
  nounData: NounData;
}

export function NounDeclensionTable({ nounData }: NounDeclensionTableProps) {
  const { t } = useTranslation('review');

  const cases = [
    {
      key: 'nominative',
      singular: nounData.nominative_singular,
      plural: nounData.nominative_plural,
    },
    { key: 'genitive', singular: nounData.genitive_singular, plural: nounData.genitive_plural },
    {
      key: 'accusative',
      singular: nounData.accusative_singular,
      plural: nounData.accusative_plural,
    },
    { key: 'vocative', singular: nounData.vocative_singular, plural: nounData.vocative_plural },
  ] as const;

  const na = t('grammar.nounDeclension.notAvailable');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header row */}
      <div className="grid grid-cols-3 border-b border-border bg-muted/50">
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground" />
        <div className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
          {t('grammar.nounDeclension.singular')}
        </div>
        <div className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
          {t('grammar.nounDeclension.plural')}
        </div>
      </div>

      {/* Data rows */}
      {cases.map(({ key, singular, plural }, index) => (
        <div
          key={key}
          className={cn('grid grid-cols-3', index < cases.length - 1 && 'border-b border-border')}
        >
          <div className="bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
            {t(`grammar.nounDeclension.cases.${key}`)}
          </div>
          <div className="px-4 py-2 text-center text-sm">{singular || na}</div>
          <div className="px-4 py-2 text-center text-sm">{plural || na}</div>
        </div>
      ))}
    </div>
  );
}
