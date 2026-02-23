// src/components/admin/vocabulary/grammar-display/AdjectiveGrammarDisplay.tsx

/**
 * AdjectiveGrammarDisplay - Read-only display of adjective grammar data.
 *
 * Shows 3 gender tabs (Masculine/Feminine/Neuter), each with 4x2 declension table,
 * plus comparative and superlative below tabs.
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

const GENDERS = ['masculine', 'feminine', 'neuter'] as const;

const CASE_FIELDS = [
  { case: 'nominative', abbrev: 'nom' },
  { case: 'genitive', abbrev: 'gen' },
  { case: 'accusative', abbrev: 'acc' },
  { case: 'vocative', abbrev: 'voc' },
] as const;

// ============================================
// Props
// ============================================

interface AdjectiveGrammarDisplayProps {
  fields: Record<string, string | null>;
}

// ============================================
// Component
// ============================================

export function AdjectiveGrammarDisplay({ fields }: AdjectiveGrammarDisplayProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3" data-testid="adjective-grammar-display">
      <ScrollArea className="max-h-[400px]">
        {/* Gender Tabs */}
        <Tabs defaultValue="masculine" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {GENDERS.map((gender) => (
              <TabsTrigger key={gender} value={gender} className="text-xs">
                {t(`vocabularyCard.grammar.adjective.genders.${gender}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {GENDERS.map((gender) => (
            <TabsContent key={gender} value={gender}>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-auto bg-muted/50 px-3 py-2" />
                      <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                        {t('vocabularyCard.grammar.adjective.singular')}
                      </TableHead>
                      <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                        {t('vocabularyCard.grammar.adjective.plural')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CASE_FIELDS.map(({ case: caseName, abbrev }) => {
                      const sgVal = fields[`${gender}_${abbrev}_sg`];
                      const plVal = fields[`${gender}_${abbrev}_pl`];
                      return (
                        <TableRow key={caseName} className="hover:bg-transparent">
                          <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {t(`vocabularyCard.grammar.adjective.cases.${caseName}`)}
                          </TableCell>
                          <TableCell className="px-3 py-1.5 text-sm">
                            {sgVal ?? <NotSet />}
                          </TableCell>
                          <TableCell className="px-3 py-1.5 text-sm">
                            {plVal ?? <NotSet />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Comparison Forms */}
        <div className="mt-3 space-y-2">
          <h4 className="text-sm font-medium">
            {t('vocabularyCard.grammar.adjective.comparison.title')}
          </h4>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableBody>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.adjective.comparison.comparative')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">
                    {fields.comparative ?? <NotSet />}
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.adjective.comparison.superlative')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">
                    {fields.superlative ?? <NotSet />}
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
