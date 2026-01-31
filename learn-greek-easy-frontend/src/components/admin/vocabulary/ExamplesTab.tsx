// src/components/admin/vocabulary/ExamplesTab.tsx

/**
 * ExamplesTab - Tab content component for managing structured example sentences.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext(), useFieldArray(), and useWatch() to manage
 * a dynamic array of example sentences.
 *
 * Features:
 * - Add/remove example rows dynamically
 * - Each example has: Greek (required), English, Russian, and optional Tense
 * - Tense field only visible when part_of_speech === 'verb'
 * - Empty state message when no examples
 * - Max 1000 chars per field
 */

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// Constants
// ============================================

const TENSE_OPTIONS = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;

const EMPTY_EXAMPLE = {
  greek: '',
  english: '',
  russian: '',
  tense: null as string | null,
};

// ============================================
// Props Interface
// ============================================

export interface ExamplesTabProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function ExamplesTab({ isSubmitting = false }: ExamplesTabProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  // Manage the examples array
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'examples',
  });

  // Watch part_of_speech to conditionally show tense field
  const partOfSpeech = useWatch({ control, name: 'part_of_speech' });
  const isVerb = partOfSpeech === 'verb';

  // Handler to add a new empty example
  const handleAddExample = () => {
    append(EMPTY_EXAMPLE);
  };

  // Handler to remove an example
  const handleRemoveExample = (index: number) => {
    remove(index);
  };

  return (
    <div className="space-y-4" data-testid="examples-tab">
      {/* Empty State */}
      {fields.length === 0 && (
        <div
          className="flex items-center justify-center py-8 text-center text-muted-foreground"
          data-testid="examples-tab-empty"
        >
          <p>{t('vocabularyCard.examplesTab.emptyState')}</p>
        </div>
      )}

      {/* Example Rows */}
      {fields.map((field, index) => (
        <Card key={field.id} data-testid={`examples-row-${index}`}>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {/* Greek (Required) */}
              <FormField
                control={control}
                name={`examples.${index}.greek`}
                render={({ field: inputField }) => (
                  <FormItem>
                    <FormLabel>{t('vocabularyCard.examplesTab.greekLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('vocabularyCard.examplesTab.greekPlaceholder')}
                        maxLength={1000}
                        data-testid={`examples-greek-${index}`}
                        disabled={isSubmitting}
                        {...inputField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* English */}
              <FormField
                control={control}
                name={`examples.${index}.english`}
                render={({ field: inputField }) => (
                  <FormItem>
                    <FormLabel>{t('vocabularyCard.examplesTab.englishLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('vocabularyCard.examplesTab.englishPlaceholder')}
                        maxLength={1000}
                        data-testid={`examples-english-${index}`}
                        disabled={isSubmitting}
                        {...inputField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Russian */}
              <FormField
                control={control}
                name={`examples.${index}.russian`}
                render={({ field: inputField }) => (
                  <FormItem>
                    <FormLabel>{t('vocabularyCard.examplesTab.russianLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('vocabularyCard.examplesTab.russianPlaceholder')}
                        maxLength={1000}
                        data-testid={`examples-russian-${index}`}
                        disabled={isSubmitting}
                        {...inputField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tense (Only for Verbs) */}
              {isVerb && (
                <FormField
                  control={control}
                  name={`examples.${index}.tense`}
                  render={({ field: selectField }) => (
                    <FormItem>
                      <FormLabel>{t('vocabularyCard.examplesTab.tenseLabel')}</FormLabel>
                      <Select
                        onValueChange={(value) => selectField.onChange(value === '' ? null : value)}
                        value={selectField.value || ''}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger data-testid={`examples-tense-${index}`}>
                            <SelectValue
                              placeholder={t('vocabularyCard.examplesTab.tensePlaceholder')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TENSE_OPTIONS.map((tense) => (
                            <SelectItem key={tense} value={tense}>
                              {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Remove Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveExample(index)}
                  disabled={isSubmitting}
                  data-testid={`examples-remove-${index}`}
                  aria-label={t('vocabularyCard.examplesTab.removeButton')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add Example Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddExample}
        disabled={isSubmitting}
        className="w-full"
        data-testid="examples-add-button"
      >
        <Plus className="mr-2 h-4 w-4" />
        {t('vocabularyCard.examplesTab.addButton')}
      </Button>
    </div>
  );
}

export default ExamplesTab;
