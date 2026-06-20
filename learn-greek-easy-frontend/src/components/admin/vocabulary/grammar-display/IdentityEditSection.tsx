// src/components/admin/vocabulary/grammar-display/IdentityEditSection.tsx

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

import { AudioGenerateButton } from '../../AudioGenerateButton';
import { AudioStatusBadge } from '../../AudioStatusBadge';
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function countIdentityFields(wordEntry: WordEntryResponse): { filled: number; total: number } {
  let filled = 0;
  if (wordEntry.pronunciation) filled++;
  if (wordEntry.audio_status === 'ready') filled++;
  return { filled, total: 2 };
}

// ============================================
// Schema
// ============================================

const identitySchema = z.object({
  pronunciation: z.string().optional().or(z.literal('')),
});

type IdentityFormData = z.infer<typeof identitySchema>;

// ============================================
// Props
// ============================================

interface IdentityEditSectionProps {
  wordEntry: WordEntryResponse;
  onEditingChange?: (isEditing: boolean) => void;
  onGenerateClick: () => void;
  isGenerating: boolean;
}

// ============================================
// Component
// ============================================

export function IdentityEditSection({
  wordEntry,
  onEditingChange,
  onGenerateClick,
  isGenerating,
}: IdentityEditSectionProps) {
  const { t } = useTranslation('admin');
  const updateWordEntry = useUpdateWordEntry();

  const [isEditing, setIsEditing] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  const compl = countIdentityFields(wordEntry);

  const form = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    mode: 'onBlur',
    defaultValues: {
      pronunciation: wordEntry.pronunciation ?? '',
    },
  });

  const {
    formState: { isDirty, isValid },
  } = form;

  const enterEditMode = () => {
    form.reset({
      pronunciation: wordEntry.pronunciation ?? '',
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

  const handleSave = async (data: IdentityFormData) => {
    const dirtyFields = form.formState.dirtyFields;
    const payload: Parameters<typeof updateWordEntry.mutateAsync>[0]['payload'] = {};

    if (dirtyFields.pronunciation !== undefined) {
      payload.pronunciation = data.pronunciation || null;
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
      <Card id="section-identity">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="group flex items-center justify-between">
            <div className="flex items-center text-sm font-semibold">
              {t('wordEntryContent.sectionIdentity')}
              <SectionBadge filled={compl.filled} total={compl.total} />
            </div>
            {!isEditing && (
              <div
                data-testid="identity-pencil-actions"
                className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
              >
                <Button
                  variant="chrome-ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={enterEditMode}
                  data-testid="identity-edit-btn"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isEditing ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSave)}
                className="space-y-3"
                data-testid="identity-edit-form"
              >
                {/* Lemma — read-only (D2) */}
                <div data-testid="word-entry-field-lemma">
                  <p className="text-sm text-muted-foreground">
                    {t('wordEntryEdit.lemmaReadOnly')}
                  </p>
                  <p className="text-sm font-medium">{wordEntry.lemma}</p>
                </div>

                {/* Part of Speech — read-only (D2) */}
                <div data-testid="word-entry-field-part-of-speech">
                  <p className="text-sm text-muted-foreground">
                    {t('wordEntryEdit.partOfSpeechReadOnly')}
                  </p>
                  <p className="text-sm font-medium">
                    {wordEntry.part_of_speech ? capitalize(wordEntry.part_of_speech) : '—'}
                  </p>
                </div>

                {/* Pronunciation — editable */}
                <FormField
                  control={form.control}
                  name="pronunciation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('wordEntryEdit.fieldPronunciation')}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="word-entry-field-pronunciation" autoFocus />
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
                    data-testid="identity-cancel-btn"
                  >
                    {t('wordEntryEdit.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || !isValid || updateWordEntry.isPending}
                    data-testid="identity-save-btn"
                  >
                    {updateWordEntry.isPending
                      ? t('wordEntryEdit.saving')
                      : t('wordEntryEdit.save')}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Part of Speech — read-only display */}
              <div data-testid="word-entry-content-pos">
                <dt className="text-sm text-muted-foreground">
                  {t('wordEntryContent.partOfSpeech')}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {wordEntry.part_of_speech ? capitalize(wordEntry.part_of_speech) : <NotSet />}
                </dd>
              </div>

              {/* Pronunciation + Audio controls */}
              <div id="section-pron" data-testid="word-entry-content-pronunciation">
                <dt className="text-sm text-muted-foreground">
                  {t('wordEntryContent.pronunciation')}
                </dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                  {wordEntry.pronunciation ? wordEntry.pronunciation : <NotSet />}
                  <div className="flex items-center gap-2">
                    <AudioStatusBadge
                      status={wordEntry.audio_status}
                      data-testid="audio-status-badge-lemma"
                    />
                    <AudioGenerateButton
                      status={wordEntry.audio_status}
                      onClick={onGenerateClick}
                      isLoading={isGenerating}
                      data-testid="audio-generate-btn-lemma"
                    />
                  </div>
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <div data-testid="identity-discard-dialog">
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
