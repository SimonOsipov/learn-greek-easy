import { useTranslation } from 'react-i18next';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { NounData } from '@/types/grammar';

export interface NounDeclensionTableProps {
  nounData: NounData;
  isFlipped?: boolean;
}

export function NounDeclensionTable({ nounData, isFlipped = true }: NounDeclensionTableProps) {
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
    <div className="overflow-hidden rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-auto w-[35%] bg-muted/50 px-3 py-2" />
            <TableHead className="h-auto bg-muted/50 px-3 py-2 text-center">
              {t('grammar.nounDeclension.singular')}
            </TableHead>
            <TableHead className="h-auto bg-muted/50 px-3 py-2 text-center">
              {t('grammar.nounDeclension.plural')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map(({ key, singular, plural }) => (
            <TableRow key={key} className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                {t(`grammar.nounDeclension.cases.${key}`)}
              </TableCell>
              <TableCell
                className={cn(
                  'px-3 py-2 text-center text-foreground transition-[filter] duration-200',
                  !isFlipped && 'select-none blur-md'
                )}
              >
                {singular || na}
              </TableCell>
              <TableCell
                className={cn(
                  'px-3 py-2 text-center text-foreground transition-[filter] duration-200',
                  !isFlipped && 'select-none blur-md'
                )}
              >
                {plural || na}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
