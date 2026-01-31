// src/components/admin/vocabulary/grammar/VerbGrammarForm.tsx

/**
 * VerbGrammarForm - Grammar form for verb vocabulary cards.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() to access the shared form state.
 *
 * Fields:
 * - Voice (active/passive) - required when verb
 * - Tense tabs: Present, Imperfect, Past (Aorist), Future, Perfect
 * - Each tense: 6 conjugation fields (1s/2s/3s/1p/2p/3p)
 * - Imperative: 2s/2p fields
 */

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Constants
// ============================================

const VOICE_OPTIONS = ['active', 'passive'] as const;

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
// Props Interface
// ============================================

export interface VerbGrammarFormProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function VerbGrammarForm({ isSubmitting = false }: VerbGrammarFormProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  return (
    <div className="space-y-4" data-testid="verb-grammar-form">
      {/* Voice Selector */}
      <FormField
        control={control}
        name="verb_data.voice"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vocabularyCard.grammar.verb.voiceLabel')}</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || ''}
              disabled={isSubmitting}
            >
              <FormControl>
                <SelectTrigger data-testid="verb-voice-select">
                  <SelectValue placeholder={t('vocabularyCard.grammar.verb.voicePlaceholder')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {t(`vocabularyCard.grammar.verb.voices.${voice}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Conjugation Tabs with ScrollArea */}
      <ScrollArea className="max-h-[400px]">
        <Tabs defaultValue="present" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {TENSES.map((tense) => (
              <TabsTrigger key={tense} value={tense}>
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
                      <TableHead className="h-auto bg-muted/50 px-3 py-2">
                        {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
                      </TableHead>
                      <TableHead className="h-auto bg-muted/50 px-3 py-2">
                        {/* Empty header for input column */}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERSONS.map(({ key: personKey, labelKey }) => (
                      <TableRow key={personKey} className="hover:bg-transparent">
                        {/* Person Label */}
                        <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                          {t(`vocabularyCard.grammar.verb.persons.${labelKey}`)}
                        </TableCell>

                        {/* Conjugation Input */}
                        <TableCell className="px-2 py-2">
                          <FormField
                            control={control}
                            name={`verb_data.${tense}_${personKey}`}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    className="h-8 text-center"
                                    data-testid={`verb-${tense}-${personKey}`}
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

        {/* Imperative Section */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">
            {t('vocabularyCard.grammar.verb.imperative.title')}
          </h4>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableBody>
                {/* Imperative 2s */}
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.singular')}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <FormField
                      control={control}
                      name="verb_data.imperative_2s"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-center"
                              data-testid="verb-imperative-2s"
                              disabled={isSubmitting}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                </TableRow>

                {/* Imperative 2p */}
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.plural')}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <FormField
                      control={control}
                      name="verb_data.imperative_2p"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              className="h-8 text-center"
                              data-testid="verb-imperative-2p"
                              disabled={isSubmitting}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
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

export default VerbGrammarForm;
