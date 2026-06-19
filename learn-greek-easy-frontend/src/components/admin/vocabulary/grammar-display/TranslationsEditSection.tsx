// src/components/admin/vocabulary/grammar-display/TranslationsEditSection.tsx

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUpdateWordEntry } from '@/features/words/hooks/useUpdateWordEntry';
import { chipColorClasses, type ChipColor } from '@/lib/completeness';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { NotSet } from '../../NotSet';

// ============================================
// Local helpers
// ============================================

function SectionBadge({ filled, total }: { filled: number; total: number }) {
  const color: ChipColor = filled === total ? 'green' : filled > 0 ? 'yellow' : 'gray';
  return (
    <span className={`ml-2 rounded-sm border px-1.5 py-0.5 text-xs ${chipColorClasses[color]}`}>
      {filled}/{total}
    </span>
  );
}

function FieldRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function countTranslationFields(wordEntry: WordEntryResponse): { filled: number; total: number } {
  let filled = 0;
  if (wordEntry.translation_en) filled++;
  if (wordEntry.translation_en_plural) filled++;
  if (wordEntry.translation_ru) filled++;
  if (wordEntry.translation_ru_plural) filled++;
  return { filled, total: 4 };
}

// ============================================
// Schema
// ============================================

const translationsSchema = z.object({
  translation_en: z.string().min(1),
  translation_en_plural: z.string().optional().or(z.literal('')),
  translation_ru: z.string().optional().or(z.literal('')),
  translation_ru_plural: z.string().optional().or(z.literal('')),
});

type TranslationsFormData = z.infer<typeof translationsSchema>;

// ============================================
// Props
// ============================================

interface TranslationsEditSectionProps {
  wordEntry: WordEntryResponse;
  onEditingChange?: (isEditing: boolean) => void;
}

// ============================================
// Component
// ============================================

export function TranslationsEditSection({
  wordEntry,
  onEditingChange,
}: TranslationsEditSectionProps) {
  const { t } = useTranslation('admin');
  const updateWordEntry = useUpdateWordEntry();

  const [isEditing, setIsEditing] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  const compl = countTranslationFields(wordEntry);

  const form = useForm<TranslationsFormData>({
    resolver: zodResolver(translationsSchema),
    mode: 'onBlur',
    defaultValues: {
      translation_en: wordEntry.translation_en,
      translation_en_plural: wordEntry.translation_en_plural ?? '',
      translation_ru: wordEntry.translation_ru ?? '',
      translation_ru_plural: wordEntry.translation_ru_plural ?? '',
    },
  });

  const {
    formState: { isDirty, isValid },
  } = form;

  const enterEditMode = () => {
    form.reset({
      translation_en: wordEntry.translation_en,
      translation_en_plural: wordEntry.translation_en_plural ?? '',
      translation_ru: wordEntry.translation_ru ?? '',
      translation_ru_plural: wordEntry.translation_ru_plural ?? '',
    });
    setIsEditing(true);
    onEditingChange?.(true);
  };

  const exitEditMode = () => {
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      exitEditMode();
    }
  };

  const handleDiscard = () => {
    setShowDiscard(false);
    exitEditMode();
  };

  const handleSave = async (data: TranslationsFormData) => {
    const dirtyFields = form.formState.dirtyFields;
    const payload: Parameters<typeof updateWordEntry.mutateAsync>[0]['payload'] = {};

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

    try {
      await updateWordEntry.mutateAsync({
        wordEntryId: wordEntry.id,
        payload,
      });
      exitEditMode();
    } catch {
      // error toast handled by mutation hook; stay in edit mode
    }
  };

  return (
    <>
      <Card id="section-translations">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center">
              {t('wordEntryContent.sectionTranslations')}
              <SectionBadge filled={compl.filled} total={compl.total} />
            </div>
            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={enterEditMode}
                data-testid="translations-edit-btn"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isEditing ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSave)}
                className="space-y-3"
                data-testid="translations-edit-form"
              >
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
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateWordEntry.isPending}
                    data-testid="translations-cancel-btn"
                  >
                    {t('wordEntryEdit.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || !isValid || updateWordEntry.isPending}
                    data-testid="translations-save-btn"
                  >
                    {updateWordEntry.isPending
                      ? t('wordEntryEdit.saving')
                      : t('wordEntryEdit.save')}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <dl className="space-y-3" id="section-en">
              <FieldRow
                label={t('wordEntryContent.translationEn')}
                value={wordEntry.translation_en || <NotSet />}
                testId="word-entry-content-translation-en"
              />
              <div id="section-ru">
                <FieldRow
                  label={t('wordEntryContent.translationRu')}
                  value={wordEntry.translation_ru || <NotSet />}
                  testId="word-entry-content-translation-ru"
                />
              </div>
              <FieldRow
                label={t('wordEntryContent.translationEnPlural')}
                value={wordEntry.translation_en_plural || <NotSet />}
                testId="word-entry-content-translation-en-plural"
              />
              <FieldRow
                label={t('wordEntryContent.translationRuPlural')}
                value={wordEntry.translation_ru_plural || <NotSet />}
                testId="word-entry-content-translation-ru-plural"
              />
            </dl>
          )}
        </CardContent>
      </Card>

      <div data-testid="translations-discard-dialog">
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
