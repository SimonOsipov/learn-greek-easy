import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
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
      <div className="overflow-x-auto">
        <div className="min-w-[500px] overflow-hidden rounded-lg border border-border bg-card">
          {/* Header row */}
          <div className="grid grid-cols-6 border-b border-border bg-muted/50">
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground" />
            {TENSES.map((tense) => (
              <div
                key={tense}
                className="px-3 py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {t(`grammar.verbConjugation.tenses.${tense}`)}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {PERSONS.map((person, index) => (
            <div
              key={person}
              className={cn(
                'grid grid-cols-6',
                index < PERSONS.length - 1 && 'border-b border-border'
              )}
            >
              <div className="bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">
                {personLabels[person]}
              </div>
              {TENSES.map((tense) => {
                const value = getConjugation(verbData, tense, person);
                return (
                  <div key={tense} className="px-3 py-2 text-center text-sm">
                    {value || na}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Imperative section */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">
          {t('grammar.verbConjugation.imperative.title')}
        </div>
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
      </div>
    </div>
  );
}
