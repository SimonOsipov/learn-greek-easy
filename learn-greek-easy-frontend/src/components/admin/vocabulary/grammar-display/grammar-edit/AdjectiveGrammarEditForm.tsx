// src/components/admin/vocabulary/grammar-display/grammar-edit/AdjectiveGrammarEditForm.tsx

/**
 * AdjectiveGrammarEditForm - Editable form for adjective grammar data.
 *
 * Mirrors AdjectiveGrammarDisplay layout: 3 gender tabs with 4x2 declension
 * tables + comparative/superlative section, using Input fields.
 */

import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
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

export interface GrammarEditFormProps {
  formState: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// ============================================
// Component
// ============================================

export function AdjectiveGrammarEditForm({ formState, onChange }: GrammarEditFormProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="adjective-grammar-edit-form" className="space-y-3">
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
                      const sgKey = `${gender}_${abbrev}_sg`;
                      const plKey = `${gender}_${abbrev}_pl`;
                      return (
                        <TableRow key={caseName} className="hover:bg-transparent">
                          <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {t(`vocabularyCard.grammar.adjective.cases.${caseName}`)}
                          </TableCell>
                          <TableCell className="px-3 py-1.5">
                            <Input
                              className="h-7 text-sm"
                              maxLength={255}
                              data-testid={`grammar-field-${sgKey}`}
                              value={formState[sgKey] ?? ''}
                              onChange={(e) => onChange(sgKey, e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-1.5">
                            <Input
                              className="h-7 text-sm"
                              maxLength={255}
                              data-testid={`grammar-field-${plKey}`}
                              value={formState[plKey] ?? ''}
                              onChange={(e) => onChange(plKey, e.target.value)}
                            />
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
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid="grammar-field-comparative"
                      value={formState.comparative ?? ''}
                      onChange={(e) => onChange('comparative', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.adjective.comparison.superlative')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid="grammar-field-superlative"
                      value={formState.superlative ?? ''}
                      onChange={(e) => onChange('superlative', e.target.value)}
                    />
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
