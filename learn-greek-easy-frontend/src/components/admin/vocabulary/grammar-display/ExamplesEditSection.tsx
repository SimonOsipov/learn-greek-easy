// src/components/admin/vocabulary/grammar-display/ExamplesEditSection.tsx

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
import type { WordEntryExampleSentence, WordEntryResponse } from '@/services/wordEntryAPI';

import { AudioStatusBadge } from '../../AudioStatusBadge';
import { NotSet } from '../../NotSet';

// ============================================
// Schema
// ============================================

const exampleSchema = z.object({
  id: z.string(),
  greek: z.string().min(1),
  english: z.string().optional().or(z.literal('')),
  russian: z.string().optional().or(z.literal('')),
});

const examplesFormSchema = z.object({
  examples: z.array(exampleSchema),
});

type ExamplesFormData = z.infer<typeof examplesFormSchema>;

// ============================================
// Helpers
// ============================================

function CompletionDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${filled ? 'bg-success' : 'bg-muted-foreground/30'}`}
    />
  );
}

function ExampleCard({ example, index }: { example: WordEntryExampleSentence; index: number }) {
  const { t } = useTranslation('admin');

  const hasEnglish = Boolean(example.english);
  const hasRussian = Boolean(example.russian);
  const hasAudio = example.audio_status === 'ready' || example.audio_status === 'generating';

  return (
    <div
      className="space-y-1.5 rounded-md border p-3"
      data-testid={`word-entry-content-example-${index}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        {example.audio_status && (
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasAudio} />
            <AudioStatusBadge
              status={example.audio_status}
              data-testid={`audio-status-badge-example-${index}`}
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CompletionDot filled={true} />
          <span className="text-xs text-muted-foreground">
            {t('wordEntryContent.exampleGreek')}
          </span>
        </div>
        <p className="mt-0.5 pl-3.5 text-sm">{example.greek}</p>
      </div>

      <div className="space-y-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasEnglish} />
            <span className="text-xs text-muted-foreground">
              {t('wordEntryContent.exampleEnglish')}
            </span>
          </div>
          <p className="mt-0.5 pl-3.5 text-sm">{example.english || <NotSet />}</p>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CompletionDot filled={hasRussian} />
            <span className="text-xs text-muted-foreground">
              {t('wordEntryContent.exampleRussian')}
            </span>
          </div>
          <p className="mt-0.5 pl-3.5 text-sm">{hasRussian ? example.russian : <NotSet />}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Props
// ============================================

interface ExamplesEditSectionProps {
  wordEntry: WordEntryResponse;
  onEditingChange?: (isEditing: boolean) => void;
  onAudioRegenNeeded?: () => void;
}

// ============================================
// Component
// ============================================

export function ExamplesEditSection({
  wordEntry,
  onEditingChange,
  onAudioRegenNeeded,
}: ExamplesEditSectionProps) {
  const { t } = useTranslation('admin');
  const updateWordEntry = useUpdateWordEntry();

  const [isEditing, setIsEditing] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  const examples = wordEntry.examples ?? [];
  const examplesCount = examples.length;

  const form = useForm<ExamplesFormData>({
    resolver: zodResolver(examplesFormSchema),
    mode: 'onBlur',
    defaultValues: {
      examples: examples.map((ex) => ({
        id: ex.id ?? '',
        greek: ex.greek,
        english: ex.english ?? '',
        russian: ex.russian ?? '',
      })),
    },
  });

  const {
    formState: { isDirty, isValid },
  } = form;

  const enterEditMode = () => {
    form.reset({
      examples: examples.map((ex) => ({
        id: ex.id ?? '',
        greek: ex.greek,
        english: ex.english ?? '',
        russian: ex.russian ?? '',
      })),
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

  const handleSave = async (data: ExamplesFormData) => {
    const payload = {
      examples: data.examples.map((ex) => ({
        id: ex.id,
        greek: ex.greek,
        english: ex.english || null,
        russian: ex.russian || null,
      })),
    };

    try {
      await updateWordEntry.mutateAsync({
        wordEntryId: wordEntry.id,
        payload,
      });

      // Trigger audio regen ONLY if an EXISTING example's GREEK changed
      const originalExamples = wordEntry.examples ?? [];
      const originalById = Object.fromEntries(
        originalExamples.map((ex) => [ex.id ?? '', ex.greek])
      );
      let exampleGreekChanged = false;
      for (const ex of data.examples) {
        if (ex.id && originalById[ex.id] !== undefined && originalById[ex.id] !== ex.greek) {
          exampleGreekChanged = true;
          break;
        }
      }
      if (exampleGreekChanged) {
        onAudioRegenNeeded?.();
      }

      exitEditMode();
    } catch {
      // error toast handled by mutation hook; stay in edit mode
    }
  };

  return (
    <>
      <Card id="section-examples">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center">
              {t('wordEntryContent.sectionExamples')}
              <span className="ml-2 rounded-sm border border-muted-foreground/30 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
                {examplesCount}
              </span>
            </div>
            {!isEditing && examplesCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={enterEditMode}
                data-testid="examples-edit-btn"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4" id="section-ex">
          {isEditing ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSave)}
                className="space-y-3"
                data-testid="examples-edit-form"
              >
                {form.getValues('examples').map((_, index) => (
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
                  </div>
                ))}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateWordEntry.isPending}
                    data-testid="examples-cancel-btn"
                  >
                    {t('wordEntryEdit.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || !isValid || updateWordEntry.isPending}
                    data-testid="examples-save-btn"
                  >
                    {updateWordEntry.isPending
                      ? t('wordEntryEdit.saving')
                      : t('wordEntryEdit.save')}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div data-testid="word-entry-content-examples">
              {examplesCount === 0 && (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="word-entry-content-no-examples"
                >
                  {t('wordEntryContent.noExamples')}
                </p>
              )}
              {examplesCount > 0 && (
                <div className="space-y-3">
                  {examples.map((example, index) => (
                    <ExampleCard key={example.id || index} example={example} index={index} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div data-testid="examples-discard-dialog">
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
