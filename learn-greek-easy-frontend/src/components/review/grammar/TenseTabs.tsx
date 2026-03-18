import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VerbData, VerbVoice } from '@/types/grammar';

import { VerbConjugationGrid } from './VerbConjugationGrid';
import { VoiceToggle } from './VoiceToggle';

const VERB_TENSES = ['present', 'imperfect', 'past', 'future', 'perfect', 'imperative'] as const;
type VerbTense = (typeof VERB_TENSES)[number];

export interface TenseTabsProps {
  verbData: VerbData;
  /** Whether the card is flipped (controls blur state) */
  isFlipped?: boolean;
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

export function TenseTabs({ verbData, isFlipped = true }: TenseTabsProps) {
  const { t } = useTranslation('review');
  const [selectedTense, setSelectedTense] = useState<VerbTense>('present');
  const [selectedVoice, setSelectedVoice] = useState<VerbVoice>(verbData.voice);

  // TODO: Set to true when passive voice data is available for this verb
  const hasPassive = false;

  const handleTenseChange = (newTense: string) => {
    const tense = newTense as VerbTense;
    setSelectedTense(tense);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <VoiceToggle
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          disabled={!hasPassive}
        />
      </div>
      <Tabs value={selectedTense} onValueChange={handleTenseChange}>
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
            <VerbConjugationGrid verbData={verbData} selectedTense={tense} isFlipped={isFlipped} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
