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
import { cn } from '@/lib/utils';
import type { VerbData } from '@/types/grammar';

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;
type Tense = (typeof TENSES)[number];

const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
type Person = (typeof PERSONS)[number];

export interface VerbConjugationGridProps {
  verbData: VerbData;
  selectedTense?: 'present' | 'imperfect' | 'past' | 'future' | 'perfect' | 'imperative';
  /** Whether the card is flipped (controls blur state) */
  isFlipped?: boolean;
}

function getConjugation(verbData: VerbData, tense: Tense, person: Person): string {
  const key = `${tense}_${person}` as keyof VerbData;
  const value = verbData[key];
  return typeof value === 'string' ? value : '';
}

export function VerbConjugationGrid({
  verbData,
  selectedTense,
  isFlipped = true,
}: VerbConjugationGridProps) {
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

  // If selectedTense is 'imperative', render only the imperative section
  if (selectedTense === 'imperative') {
    return (
      <Card>
        <CardHeader className="bg-muted/50 px-3 py-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('grammar.verbConjugation.imperative.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm">
                  {t('grammar.verbConjugation.imperative.singular')}
                </TableHead>
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm">
                  {t('grammar.verbConjugation.imperative.plural')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className={cn(
                    'min-w-[150px] whitespace-nowrap px-2 py-2 text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
                  {verbData.imperative_2s || na}
                </TableCell>
                <TableCell
                  className={cn(
                    'min-w-[150px] whitespace-nowrap px-2 py-2 text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
                  {verbData.imperative_2p || na}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  // If selectedTense is provided (and not imperative), show single-tense table
  if (selectedTense) {
    const tense = selectedTense as Tense;
    return (
      <ScrollableTable>
        <div className="min-w-[200px] overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm" />
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-center text-xs font-bold sm:px-3 sm:text-sm">
                  {t(`grammar.verbConjugation.tenses.${tense}`)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERSONS.map((person) => {
                const value = getConjugation(verbData, tense, person);
                return (
                  <TableRow key={person} className="hover:bg-transparent">
                    <TableCell className="whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold text-muted-foreground sm:px-3 sm:text-sm">
                      {personLabels[person]}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'min-w-[150px] whitespace-nowrap px-2 py-2 text-center text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                        !isFlipped && 'select-none blur-md'
                      )}
                    >
                      {value || na}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ScrollableTable>
    );
  }

  // No selectedTense: show all 5 tenses in a grid (backward compatibility)
  return (
    <div className="space-y-4">
      {/* Main conjugation grid */}
      <ScrollableTable>
        <div className="min-w-[500px] overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm" />
                {TENSES.map((tense) => (
                  <TableHead
                    key={tense}
                    className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-center text-xs font-bold sm:px-3 sm:text-sm"
                  >
                    {t(`grammar.verbConjugation.tenses.${tense}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERSONS.map((person) => (
                <TableRow key={person} className="hover:bg-transparent">
                  <TableCell className="whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold text-muted-foreground sm:px-3 sm:text-sm">
                    {personLabels[person]}
                  </TableCell>
                  {TENSES.map((tense) => {
                    const value = getConjugation(verbData, tense, person);
                    return (
                      <TableCell
                        key={tense}
                        className={cn(
                          'min-w-[150px] whitespace-nowrap px-2 py-2 text-center text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                          !isFlipped && 'select-none blur-md'
                        )}
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
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm">
                  {t('grammar.verbConjugation.imperative.singular')}
                </TableHead>
                <TableHead className="h-auto whitespace-nowrap bg-muted/50 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm">
                  {t('grammar.verbConjugation.imperative.plural')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className={cn(
                    'min-w-[150px] whitespace-nowrap px-2 py-2 text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
                  {verbData.imperative_2s || na}
                </TableCell>
                <TableCell
                  className={cn(
                    'min-w-[150px] whitespace-nowrap px-2 py-2 text-xs transition-[filter] duration-200 sm:px-3 sm:text-sm',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
                  {verbData.imperative_2p || na}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
