// src/components/admin/vocabulary/grammar/NounGrammarForm.tsx

/**
 * NounGrammarForm - Grammar form for noun vocabulary cards.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() to access the shared form state.
 *
 * Fields:
 * - Gender (masculine/feminine/neuter) - required when noun
 * - Declension table: 4 cases x 2 numbers = 8 fields
 *   - nominative_singular/plural
 *   - genitive_singular/plural
 *   - accusative_singular/plural
 *   - vocative_singular/plural
 */

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ============================================
// Constants
// ============================================

const GENDER_OPTIONS = ['masculine', 'feminine', 'neuter'] as const;

const CASE_FIELDS = [
  { case: 'nominative', singular: 'nominative_singular', plural: 'nominative_plural' },
  { case: 'genitive', singular: 'genitive_singular', plural: 'genitive_plural' },
  { case: 'accusative', singular: 'accusative_singular', plural: 'accusative_plural' },
  { case: 'vocative', singular: 'vocative_singular', plural: 'vocative_plural' },
] as const;

// ============================================
// Props Interface
// ============================================

export interface NounGrammarFormProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function NounGrammarForm({ isSubmitting = false }: NounGrammarFormProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  return (
    <div className="space-y-4" data-testid="noun-grammar-form">
      {/* Gender Selector */}
      <FormField
        control={control}
        name="noun_data.gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vocabularyCard.grammar.noun.genderLabel')}</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || ''}
              disabled={isSubmitting}
            >
              <FormControl>
                <SelectTrigger data-testid="noun-gender-select">
                  <SelectValue placeholder={t('vocabularyCard.grammar.noun.genderPlaceholder')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {GENDER_OPTIONS.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {t(`vocabularyCard.grammar.noun.genders.${gender}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Declension Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto bg-muted/50 px-3 py-2" />
              <TableHead className="h-auto bg-muted/50 px-3 py-2">
                {t('vocabularyCard.grammar.noun.singular')}
              </TableHead>
              <TableHead className="h-auto bg-muted/50 px-3 py-2">
                {t('vocabularyCard.grammar.noun.plural')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CASE_FIELDS.map(({ case: caseName, singular, plural }) => (
              <TableRow key={caseName} className="hover:bg-transparent">
                {/* Case Label */}
                <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                  {t(`vocabularyCard.grammar.noun.cases.${caseName}`)}
                </TableCell>

                {/* Singular Input */}
                <TableCell className="px-2 py-2">
                  <FormField
                    control={control}
                    name={`noun_data.${singular}`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="h-8 text-center"
                            data-testid={`noun-${singular.replace('_', '-')}`}
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
                    name={`noun_data.${plural}`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="h-8 text-center"
                            data-testid={`noun-${plural.replace('_', '-')}`}
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
    </div>
  );
}

export default NounGrammarForm;
