// src/components/admin/vocabulary/grammar-display/VerbGrammarDisplay.tsx

/**
 * VerbGrammarDisplay - Read-only display of verb grammar data.
 *
 * Shows voice + 5 tense tabs with 6-person conjugation tables + imperative section.
 * All fields always render; missing values show "Not set".
 */

import { useTranslation } from 'react-i18next';

import { NotSet } from '@/components/admin/NotSet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Constants
// ============================================

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;

const PERSONS = [
  { key: '1s', labelKey: 'firstSingular' },
  { key: '2s', labelKey: 'secondSingular' },
  { key: '3s', labelKey: 'thirdSingular' },
  { key: '1p', labelKey: 'firstPlural' },
  { key: '2p', labelKey: 'secondPlural' },
  { key: '3p', labelKey: 'thirdPlural' },
] as const;

// ============================================
// Props
// ============================================

interface VerbGrammarDisplayProps {
  fields: Record<string, string | null>;
}

// ============================================
// Component
// ============================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function VerbGrammarDisplay({ fields }: VerbGrammarDisplayProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3" data-testid="verb-grammar-display">
      {/* Voice */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('vocabularyCard.grammar.verb.voiceLabel')}:
        </span>
        <span className="font-medium">{fields.voice ? capitalize(fields.voice) : <NotSet />}</span>
      </div>

      {/* Conjugation Tabs */}
      <ScrollArea className="max-h-[400px]">
        <Tabs defaultValue="present" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {TENSES.map((tense) => (
              <TabsTrigger key={tense} value={tense} className="text-xs">
                {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {TENSES.map((tense) => (
            <TabsContent key={tense} value={tense}>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                        {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
                      </TableHead>
                      <TableHead className="h-auto bg-muted/50 px-3 py-2" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERSONS.map(({ key: personKey, labelKey }) => {
                      const val = fields[`${tense}_${personKey}`];
                      return (
                        <TableRow key={personKey} className="hover:bg-transparent">
                          <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {t(`vocabularyCard.grammar.verb.persons.${labelKey}`)}
                          </TableCell>
                          <TableCell className="px-3 py-1.5 text-sm">{val ?? <NotSet />}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Imperative Section */}
        <div className="mt-3 space-y-2">
          <h4 className="text-sm font-medium">
            {t('vocabularyCard.grammar.verb.imperative.title')}
          </h4>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableBody>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.singular')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">
                    {fields.imperative_2s ?? <NotSet />}
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.plural')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">
                    {fields.imperative_2p ?? <NotSet />}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
