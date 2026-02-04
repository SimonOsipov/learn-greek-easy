import { useTranslation } from 'react-i18next';

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { AdverbData } from '@/types/grammar';

export interface AdverbFormsTableProps {
  adverbData: AdverbData;
  positiveForm: string; // The base adverb from card front_text
  /** Whether the card is flipped (controls blur state) */
  isFlipped?: boolean;
}

export function AdverbFormsTable({
  adverbData,
  positiveForm,
  isFlipped = true,
}: AdverbFormsTableProps) {
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
              <TableCell
                className={cn(
                  'px-4 py-2 text-foreground transition-[filter] duration-200',
                  !isFlipped && 'select-none blur-md'
                )}
              >
                {value || na}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
