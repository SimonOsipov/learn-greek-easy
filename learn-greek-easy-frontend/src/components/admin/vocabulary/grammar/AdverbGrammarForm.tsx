// src/components/admin/vocabulary/grammar/AdverbGrammarForm.tsx

/**
 * AdverbGrammarForm - Grammar form for adverb vocabulary cards.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() to access the shared form state.
 *
 * Fields:
 * - comparative: Comparison form (e.g., "more quickly")
 * - superlative: Highest degree form (e.g., "most quickly")
 *
 * This is the simplest grammar form with just 2 optional fields.
 */

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

// ============================================
// Props Interface
// ============================================

export interface AdverbGrammarFormProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function AdverbGrammarForm({ isSubmitting = false }: AdverbGrammarFormProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  return (
    <div className="space-y-4" data-testid="adverb-grammar-form">
      {/* Section Title */}
      <h4 className="text-sm font-medium">{t('vocabularyCard.grammar.adverb.title')}</h4>

      {/* Comparative */}
      <FormField
        control={control}
        name="adverb_data.comparative"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vocabularyCard.grammar.adverb.comparative')}</FormLabel>
            <FormControl>
              <Input
                data-testid="adverb-comparative"
                placeholder={t('vocabularyCard.grammar.adverb.comparativePlaceholder')}
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
        name="adverb_data.superlative"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vocabularyCard.grammar.adverb.superlative')}</FormLabel>
            <FormControl>
              <Input
                data-testid="adverb-superlative"
                placeholder={t('vocabularyCard.grammar.adverb.superlativePlaceholder')}
                disabled={isSubmitting}
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

export default AdverbGrammarForm;
