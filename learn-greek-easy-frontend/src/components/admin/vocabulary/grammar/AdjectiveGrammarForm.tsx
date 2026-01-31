// src/components/admin/vocabulary/grammar/AdjectiveGrammarForm.tsx

/**
 * AdjectiveGrammarForm - Grammar form for adjective vocabulary cards.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() to access the shared form state.
 *
 * Fields:
 * - Gender tabs: Masculine, Feminine, Neuter
 * - Each gender: 4 cases x 2 numbers = 8 declension fields
 * - Total: 24 declension fields across all genders
 * - Comparison forms: comparative and superlative
 */

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
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
// Props Interface
// ============================================

export interface AdjectiveGrammarFormProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function AdjectiveGrammarForm({ isSubmitting = false }: AdjectiveGrammarFormProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  return (
    <div className="space-y-4" data-testid="adjective-grammar-form">
      {/* Gender Tabs with Declension Tables */}
      <ScrollArea className="max-h-[400px]">
        <Tabs defaultValue="masculine" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {GENDERS.map((gender) => (
              <TabsTrigger key={gender} value={gender}>
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
                      <TableHead className="h-auto bg-muted/50 px-3 py-2">
                        {t('vocabularyCard.grammar.adjective.singular')}
                      </TableHead>
                      <TableHead className="h-auto bg-muted/50 px-3 py-2">
                        {t('vocabularyCard.grammar.adjective.plural')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CASE_FIELDS.map(({ case: caseName, abbrev }) => (
                      <TableRow key={caseName} className="hover:bg-transparent">
                        {/* Case Label */}
                        <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                          {t(`vocabularyCard.grammar.adjective.cases.${caseName}`)}
                        </TableCell>

                        {/* Singular Input */}
                        <TableCell className="px-2 py-2">
                          <FormField
                            control={control}
                            name={`adjective_data.${gender}_${abbrev}_sg`}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    className="h-8 text-center"
                                    data-testid={`adjective-${gender}-${abbrev}-sg`}
                                    disabled={isSubmitting}
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>

                        {/* Plural Input */}
                        <TableCell className="px-2 py-2">
                          <FormField
                            control={control}
                            name={`adjective_data.${gender}_${abbrev}_pl`}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    className="h-8 text-center"
                                    data-testid={`adjective-${gender}-${abbrev}-pl`}
                                    disabled={isSubmitting}
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Comparison Forms Section */}
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium">
            {t('vocabularyCard.grammar.adjective.comparison.title')}
          </h4>

          {/* Comparative */}
          <FormField
            control={control}
            name="adjective_data.comparative"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('vocabularyCard.grammar.adjective.comparison.comparative')}
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="adjective-comparative"
                    placeholder={t(
                      'vocabularyCard.grammar.adjective.comparison.comparativePlaceholder'
                    )}
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Superlative */}
          <FormField
            control={control}
            name="adjective_data.superlative"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('vocabularyCard.grammar.adjective.comparison.superlative')}
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="adjective-superlative"
                    placeholder={t(
                      'vocabularyCard.grammar.adjective.comparison.superlativePlaceholder'
                    )}
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

export default AdjectiveGrammarForm;
