// src/components/admin/WordEntryEditForm.tsx

import { useCallback, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateWordEntry } from '@/features/words/hooks/useUpdateWordEntry';
import {
  trackAdminWordEntryAutoAudioRegen,
  trackAdminWordEntryEditCancelled,
  trackAdminWordEntryEditSaved,
} from '@/lib/analytics/adminAnalytics';
import { wordEntryAPI, type WordEntryResponse } from '@/services/wordEntryAPI';

import { AlertDialog } from '../dialogs/AlertDialog';

// ============================================
// Schema
// ============================================

const exampleSchema = z.object({
  id: z.string(),
  greek: z.string().min(1),
  english: z.string().optional().or(z.literal('')),
  russian: z.string().optional().or(z.literal('')),
  context: z.string().optional().or(z.literal('')),
});

const wordEntryEditSchema = z.object({
  translation_en: z.string().min(1),
  translation_en_plural: z.string().optional().or(z.literal('')),
  translation_ru: z.string().optional().or(z.literal('')),
  translation_ru_plural: z.string().optional().or(z.literal('')),
  pronunciation: z.string().optional().or(z.literal('')),
  gender: z.string().optional().nullable(),
  examples: z.array(exampleSchema).optional(),
});

type WordEntryEditFormData = z.infer<typeof wordEntryEditSchema>;

// ============================================
// Props
// ============================================

interface WordEntryEditFormProps {
  wordEntry: WordEntryResponse;
  onSaveSuccess: (updated: WordEntryResponse) => void;
  onCancel: () => void;
}

// ============================================
// Helper
// ============================================

function getGenderFromEntry(wordEntry: WordEntryResponse): string | null {
  if (!wordEntry.grammar_data) return null;
  const g = (wordEntry.grammar_data as Record<string, unknown>).gender;
  return typeof g === 'string' ? g : null;
}

function showGenderField(wordEntry: WordEntryResponse): boolean {
  return wordEntry.part_of_speech === 'noun' || wordEntry.part_of_speech === 'adjective';
}

// ============================================
// Component
// ============================================

export function WordEntryEditForm({ wordEntry, onSaveSuccess, onCancel }: WordEntryEditFormProps) {
  const { t } = useTranslation('admin');
  const [showDiscard, setShowDiscard] = useState(false);

  const defaultValues: WordEntryEditFormData = {
    translation_en: wordEntry.translation_en,
    translation_en_plural: wordEntry.translation_en_plural ?? '',
    translation_ru: wordEntry.translation_ru ?? '',
    translation_ru_plural: wordEntry.translation_ru_plural ?? '',
    pronunciation: wordEntry.pronunciation ?? '',
    gender: getGenderFromEntry(wordEntry),
    examples: (wordEntry.examples ?? []).map((ex) => ({
      id: ex.id ?? '',
      greek: ex.greek,
      english: ex.english ?? '',
      russian: ex.russian ?? '',
      context: ex.context ?? '',
    })),
  };

  const form = useForm<WordEntryEditFormData>({
    resolver: zodResolver(wordEntryEditSchema),
    mode: 'onBlur',
    defaultValues,
  });

  const {
    formState: { isDirty, isValid },
    handleSubmit,
    getValues,
  } = form;

  const updateWordEntry = useUpdateWordEntry();

  const onSubmit = useCallback(
    async (data: WordEntryEditFormData) => {
      // Build payload with only changed fields
      const dirtyFields = form.formState.dirtyFields;
      const payload: Parameters<typeof wordEntryAPI.updateInline>[1] = {};

      if (dirtyFields.translation_en) {
        payload.translation_en = data.translation_en;
      }
      if (dirtyFields.translation_en_plural !== undefined) {
        payload.translation_en_plural = data.translation_en_plural || null;
      }
      if (dirtyFields.translation_ru !== undefined) {
        payload.translation_ru = data.translation_ru || null;
      }
      if (dirtyFields.translation_ru_plural !== undefined) {
        payload.translation_ru_plural = data.translation_ru_plural || null;
      }
      if (dirtyFields.pronunciation !== undefined) {
        payload.pronunciation = data.pronunciation || null;
      }
      if (dirtyFields.gender !== undefined) {
        payload.gender = data.gender || null;
      }
      if (dirtyFields.examples) {
        payload.examples = (data.examples ?? []).map((ex) => ({
          id: ex.id,
          greek: ex.greek,
          english: ex.english || null,
          russian: ex.russian || null,
          context: ex.context || null,
        }));
      }

      // Track fields changed
      const fieldsChanged = Object.keys(dirtyFields);

      try {
        const updated = await updateWordEntry.mutateAsync({
          wordEntryId: wordEntry.id,
          payload,
        });

        trackAdminWordEntryEditSaved({
          word_entry_id: wordEntry.id,
          lemma: wordEntry.lemma,
          fields_changed: fieldsChanged,
        });

        // Trigger audio regen for changed example greek text
        const audioParts: string[] = [];
        if (dirtyFields.examples && data.examples) {
          const originalExamples = wordEntry.examples ?? [];
          const originalById = Object.fromEntries(
            originalExamples.map((ex) => [ex.id ?? '', ex.greek])
          );
          for (const ex of data.examples) {
            if (ex.id && originalById[ex.id] !== undefined && originalById[ex.id] !== ex.greek) {
              try {
                await wordEntryAPI.generatePartAudio(wordEntry.id, 'example', ex.id);
                audioParts.push(`example:${ex.id}`);
              } catch {
                // Audio regen failure is non-fatal - entry was already saved
              }
            }
          }
        }

        if (audioParts.length > 0) {
          trackAdminWordEntryAutoAudioRegen({
            word_entry_id: wordEntry.id,
            parts: audioParts,
          });
        }

        onSaveSuccess(updated);
      } catch {
        // Error toast is shown by the mutation hook
      }
    },
    [form, updateWordEntry, wordEntry, onSaveSuccess]
  );

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      trackAdminWordEntryEditCancelled({
        word_entry_id: wordEntry.id,
        lemma: wordEntry.lemma,
        had_unsaved_changes: false,
      });
      onCancel();
    }
  }, [isDirty, wordEntry, onCancel]);

  const handleDiscard = useCallback(() => {
    setShowDiscard(false);
    trackAdminWordEntryEditCancelled({
      word_entry_id: wordEntry.id,
      lemma: wordEntry.lemma,
      had_unsaved_changes: true,
    });
    onCancel();
  }, [wordEntry, onCancel]);

  const examples = getValues('examples') ?? [];
  const showGender = showGenderField(wordEntry);

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          data-testid="word-entry-edit-form"
        >
          {/* Read-only fields */}
          <div className="space-y-2">
            <div data-testid="word-entry-field-lemma">
              <p className="text-sm text-muted-foreground">{t('wordEntryEdit.lemmaReadOnly')}</p>
              <p className="text-sm font-medium">{wordEntry.lemma}</p>
            </div>
            <div data-testid="word-entry-field-part-of-speech">
              <p className="text-sm text-muted-foreground">
                {t('wordEntryEdit.partOfSpeechReadOnly')}
              </p>
              <p className="text-sm font-medium">{wordEntry.part_of_speech}</p>
            </div>
          </div>

          {/* translation_en (required) */}
          <FormField
            control={form.control}
            name="translation_en"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wordEntryEdit.fieldTranslationEn')}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="word-entry-field-translation-en" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* translation_en_plural */}
          <FormField
            control={form.control}
            name="translation_en_plural"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wordEntryEdit.fieldTranslationEnPlural')}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="word-entry-field-translation-en-plural" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* translation_ru */}
          <FormField
            control={form.control}
            name="translation_ru"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wordEntryEdit.fieldTranslationRu')}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="word-entry-field-translation-ru" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* translation_ru_plural */}
          <FormField
            control={form.control}
            name="translation_ru_plural"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wordEntryEdit.fieldTranslationRuPlural')}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="word-entry-field-translation-ru-plural" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* pronunciation */}
          <FormField
            control={form.control}
            name="pronunciation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wordEntryEdit.fieldPronunciation')}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="word-entry-field-pronunciation" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* gender (conditional) */}
          {showGender && (
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wordEntryEdit.fieldGender')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger data-testid="word-entry-field-gender">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="masculine">
                        {t('wordEntryEdit.genderMasculine')}
                      </SelectItem>
                      <SelectItem value="feminine">{t('wordEntryEdit.genderFeminine')}</SelectItem>
                      <SelectItem value="neuter">{t('wordEntryEdit.genderNeuter')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Examples */}
          {examples.length > 0 && (
            <div className="space-y-3">
              {examples.map((_, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-md border p-3"
                  data-testid={`word-entry-example-${index}`}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('wordEntryEdit.exampleHeader', { index: index + 1 })}
                  </p>

                  <FormField
                    control={form.control}
                    name={`examples.${index}.greek`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('wordEntryEdit.fieldExampleGreek')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid={`word-entry-example-${index}-greek`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`examples.${index}.english`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('wordEntryEdit.fieldExampleEnglish')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid={`word-entry-example-${index}-english`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`examples.${index}.russian`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('wordEntryEdit.fieldExampleRussian')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid={`word-entry-example-${index}-russian`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`examples.${index}.context`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('wordEntryEdit.fieldExampleContext')}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid={`word-entry-example-${index}-context`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateWordEntry.isPending}
              data-testid="word-entry-cancel-btn"
            >
              {t('wordEntryEdit.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateWordEntry.isPending || !isValid}
              data-testid="word-entry-save-btn"
            >
              {updateWordEntry.isPending ? t('wordEntryEdit.saving') : t('wordEntryEdit.save')}
            </Button>
          </div>
        </form>
      </Form>

      {/* Discard changes dialog */}
      <div data-testid="word-entry-discard-dialog">
        <AlertDialog
          open={showDiscard}
          onOpenChange={setShowDiscard}
          title={t('wordEntryEdit.discardTitle')}
          description={t('wordEntryEdit.discardMessage')}
          variant="warning"
          dismissible={false}
          actions={[
            {
              label: t('wordEntryEdit.discardCancel'),
              onClick: () => setShowDiscard(false),
              variant: 'outline',
            },
            {
              label: t('wordEntryEdit.discardConfirm'),
              onClick: handleDiscard,
              variant: 'destructive',
            },
          ]}
        />
      </div>
    </>
  );
}
