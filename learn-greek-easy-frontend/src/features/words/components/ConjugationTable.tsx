// src/features/words/components/ConjugationTable.tsx

/**
 * Conjugation table for verb word entries.
 * Displays verb forms in a tabbed interface organized by tense.
 */

import { useState } from 'react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VerbData } from '@/types/grammar';

// ============================================
// Types
// ============================================

export interface ConjugationTableProps {
  /** Verb grammar data with conjugations */
  grammarData: VerbData;
}

// ============================================
// Constants
// ============================================

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect', 'imperative'] as const;
type Tense = (typeof TENSES)[number];

const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
type Person = (typeof PERSONS)[number];

// ============================================
// Helper Functions
// ============================================

function getConjugation(
  verbData: VerbData,
  tense: Exclude<Tense, 'imperative'>,
  person: Person
): string {
  const key = `${tense}_${person}` as keyof VerbData;
  const value = verbData[key];
  return typeof value === 'string' ? value : '';
}

// ============================================
// Component
// ============================================

export function ConjugationTable({ grammarData }: ConjugationTableProps) {
  const { t } = useTranslation('review');
  const [selectedTense, setSelectedTense] = useState<Tense>('present');
  const na = t('grammar.verbConjugation.notAvailable');

  const personLabels: Record<Person, string> = {
    '1s': t('grammar.verbConjugation.persons.firstSingular'),
    '2s': t('grammar.verbConjugation.persons.secondSingular'),
    '3s': t('grammar.verbConjugation.persons.thirdSingular'),
    '1p': t('grammar.verbConjugation.persons.firstPlural'),
    '2p': t('grammar.verbConjugation.persons.secondPlural'),
    '3p': t('grammar.verbConjugation.persons.thirdPlural'),
  };

  const renderImperativeTable = () => (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 px-4 py-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('grammar.verbConjugation.imperative.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center font-bold">
                {t('grammar.verbConjugation.imperative.singular')}
              </TableHead>
              <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center font-bold">
                {t('grammar.verbConjugation.imperative.plural')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-4 py-3 text-center text-foreground">
                {grammarData.imperative_2s || na}
              </TableCell>
              <TableCell className="px-4 py-3 text-center text-foreground">
                {grammarData.imperative_2p || na}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderTenseTable = (tense: Exclude<Tense, 'imperative'>) => (
    <ScrollableTable>
      <div className="min-w-[300px] overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto bg-muted/50 px-4 py-2 font-bold" />
              <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center font-bold">
                {t(`grammar.verbConjugation.tenses.${tense}`)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERSONS.map((person) => {
              const value = getConjugation(grammarData, tense, person);
              return (
                <TableRow key={person} className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                    {personLabels[person]}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center text-foreground">
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('grammar.sections.conjugation')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTense} onValueChange={(v) => setSelectedTense(v as Tense)}>
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-full min-w-max">
              {TENSES.map((tense) => (
                <TabsTrigger key={tense} value={tense} variant="gradient" className="flex-1">
                  {t(`grammar.verbConjugation.tenses.${tense}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TENSES.filter((t): t is Exclude<Tense, 'imperative'> => t !== 'imperative').map(
            (tense) => (
              <TabsContent key={tense} value={tense} className="mt-4">
                {renderTenseTable(tense)}
              </TabsContent>
            )
          )}
          <TabsContent value="imperative" className="mt-4">
            {renderImperativeTable()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
