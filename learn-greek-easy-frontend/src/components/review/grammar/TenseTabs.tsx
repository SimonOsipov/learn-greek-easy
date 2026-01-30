import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VerbData } from '@/types/grammar';

import { VerbConjugationGrid } from './VerbConjugationGrid';

const VERB_TENSES = ['present', 'imperfect', 'past', 'future', 'perfect', 'imperative'] as const;
type VerbTense = (typeof VERB_TENSES)[number];

export interface TenseTabsProps {
  verbData: VerbData;
}

function tenseHasData(verbData: VerbData, tense: VerbTense): boolean {
  if (tense === 'imperative') {
    return !!(verbData.imperative_2s || verbData.imperative_2p);
  }
  const persons = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
  return persons.some((person) => {
    const key = `${tense}_${person}` as keyof VerbData;
    const value = verbData[key];
    return typeof value === 'string' && value.trim() !== '';
  });
}

export function TenseTabs({ verbData }: TenseTabsProps) {
  const { t } = useTranslation('review');
  const [selectedTense, setSelectedTense] = useState<VerbTense>('present');

  return (
    <div className="space-y-4">
      <Tabs value={selectedTense} onValueChange={(v) => setSelectedTense(v as VerbTense)}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-full min-w-max">
            {VERB_TENSES.map((tense) => (
              <TabsTrigger
                key={tense}
                value={tense}
                disabled={!tenseHasData(verbData, tense)}
                variant="gradient"
                className="flex-1"
              >
                {t(`grammar.verbConjugation.tenses.${tense}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {VERB_TENSES.map((tense) => (
          <TabsContent key={tense} value={tense} className="mt-4">
            <VerbConjugationGrid verbData={verbData} selectedTense={tense} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
