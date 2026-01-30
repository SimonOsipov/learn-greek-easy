import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { VerbData } from '@/types/grammar';

export interface VerbConjugationGridProps {
  verbData: VerbData;
}

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;
type Tense = (typeof TENSES)[number];

const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
type Person = (typeof PERSONS)[number];

function getConjugation(verbData: VerbData, tense: Tense, person: Person): string {
  const key = `${tense}_${person}` as keyof VerbData;
  const value = verbData[key];
  return typeof value === 'string' ? value : '';
}

export function VerbConjugationGrid({ verbData }: VerbConjugationGridProps) {
  const { t } = useTranslation('review');
  const na = t('grammar.verbConjugation.notAvailable');

  const personLabels: Record<Person, string> = {
    '1s': t('grammar.verbConjugation.persons.firstSingular'),
    '2s': t('grammar.verbConjugation.persons.secondSingular'),
    '3s': t('grammar.verbConjugation.persons.thirdSingular'),
    '1p': t('grammar.verbConjugation.persons.firstPlural'),
    '2p': t('grammar.verbConjugation.persons.secondPlural'),
    '3p': t('grammar.verbConjugation.persons.thirdPlural'),
  };

  return (
    <div className="space-y-4">
      {/* Main conjugation grid */}
      <ScrollableTable>
        <div className="min-w-[500px] overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs sm:px-3 sm:text-sm" />
                {TENSES.map((tense) => (
                  <TableHead
                    key={tense}
                    className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-center text-xs sm:px-3 sm:text-sm"
                  >
                    {t(`grammar.verbConjugation.tenses.${tense}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERSONS.map((person) => (
                <TableRow key={person} className="hover:bg-transparent">
                  <TableCell className="whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground sm:px-3 sm:text-sm">
                    {personLabels[person]}
                  </TableCell>
                  {TENSES.map((tense) => {
                    const value = getConjugation(verbData, tense, person);
                    return (
                      <TableCell
                        key={tense}
                        className="whitespace-nowrap px-2 py-2 text-center text-xs sm:px-3 sm:text-sm"
                      >
                        {value || na}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollableTable>

      {/* Imperative section */}
      <Card>
        <CardHeader className="bg-muted/50 px-3 py-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('grammar.verbConjugation.imperative.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2">
            <div className="border-r border-border px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {t('grammar.verbConjugation.imperative.singular')}:{' '}
              </span>
              <span className="text-sm font-medium">{verbData.imperative_2s || na}</span>
            </div>
            <div className="px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {t('grammar.verbConjugation.imperative.plural')}:{' '}
              </span>
              <span className="text-sm font-medium">{verbData.imperative_2p || na}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
