import { useTranslation } from 'react-i18next';

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
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
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableBody>
          {forms.map(({ key, value }) => (
            <TableRow key={key} className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                {t(`grammar.adverbForms.${key}`)}
              </TableCell>
              <TableCell className="px-4 py-2">{value || na}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
