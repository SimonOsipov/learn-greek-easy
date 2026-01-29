import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { AdverbData } from '@/types/grammar';

export interface AdverbFormsTableProps {
  adverbData: AdverbData;
  positiveForm: string; // The base adverb from card front_text
}

export function AdverbFormsTable({ adverbData, positiveForm }: AdverbFormsTableProps) {
  const { t } = useTranslation('review');
  const na = t('grammar.adverbForms.notAvailable');

  const forms = [
    { key: 'positive', value: positiveForm },
    { key: 'comparative', value: adverbData.comparative },
    { key: 'superlative', value: adverbData.superlative },
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {forms.map(({ key, value }, index) => (
        <div
          key={key}
          className={cn('grid grid-cols-2', index < forms.length - 1 && 'border-b border-border')}
        >
          <div className="bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
            {t(`grammar.adverbForms.${key}`)}
          </div>
          <div className="px-4 py-2 text-sm">{value || na}</div>
        </div>
      ))}
    </div>
  );
}
