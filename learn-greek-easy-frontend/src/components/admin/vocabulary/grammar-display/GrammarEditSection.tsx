// src/components/admin/vocabulary/grammar-display/GrammarEditSection.tsx

import { useState } from 'react';

import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AlertDialog } from '@/components/dialogs/AlertDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useUpdateWordEntry } from '@/features/words/hooks/useUpdateWordEntry';
import { chipColorClasses, type ChipColor } from '@/lib/completeness';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import {
  NounGrammarEditForm,
  VerbGrammarEditForm,
  AdjectiveGrammarEditForm,
  AdverbGrammarEditForm,
} from './grammar-edit';
import {
  buildFormState,
  buildGrammarPayload,
  hasFormChanges,
} from './grammar-edit/grammarEditHelpers';
import { GrammarDisplaySection } from './GrammarDisplaySection';
import { normalizeGrammarData, GRAMMAR_FIELD_COUNTS } from './grammarNormalizer';

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

// ============================================
// Props
// ============================================

interface GrammarEditSectionProps {
  wordEntry: WordEntryResponse;
  onEditingChange?: (isEditing: boolean) => void;
}

// ============================================
// Component
// ============================================

export function GrammarEditSection({ wordEntry, onEditingChange }: GrammarEditSectionProps) {
  const { t } = useTranslation('admin');
  const updateWordEntry = useUpdateWordEntry();

  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [originalState, setOriginalState] = useState<Record<string, string>>({});
  const [showDiscard, setShowDiscard] = useState(false);

  // Phrase guard - no grammar for phrases
  if (wordEntry.part_of_speech === 'phrase') return null;

  // Completeness computation
  const pos = wordEntry.part_of_speech;
  const grammarTotal = GRAMMAR_FIELD_COUNTS[pos] ?? 0;
  const grammarFilled = (() => {
    if (grammarTotal === 0 || !wordEntry.grammar_data) return 0;
    const normalized = normalizeGrammarData(wordEntry.grammar_data, pos);
    return Object.values(normalized).filter((v) => v !== null).length;
  })();

  const isDirty = hasFormChanges(formState, originalState);

  const enterEditMode = () => {
    const state = buildFormState(wordEntry.grammar_data, wordEntry.part_of_speech);
    setFormState(state);
    setOriginalState(state);
    setIsEditing(true);
    onEditingChange?.(true);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const grammarPayload = buildGrammarPayload(formState);
    try {
      await updateWordEntry.mutateAsync({
        wordEntryId: wordEntry.id,
        payload: { grammar_data: grammarPayload },
      });
      setIsEditing(false);
      onEditingChange?.(false);
    } catch {
      // error toast handled by mutation hook; stay in edit mode
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      setIsEditing(false);
      onEditingChange?.(false);
    }
  };

  const handleDiscard = () => {
    setShowDiscard(false);
    setFormState(originalState);
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const renderEditForm = () => {
    switch (wordEntry.part_of_speech) {
      case 'noun':
        return <NounGrammarEditForm formState={formState} onChange={handleFieldChange} />;
      case 'verb':
        return <VerbGrammarEditForm formState={formState} onChange={handleFieldChange} />;
      case 'adjective':
        return <AdjectiveGrammarEditForm formState={formState} onChange={handleFieldChange} />;
      case 'adverb':
        return <AdverbGrammarEditForm formState={formState} onChange={handleFieldChange} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Card id="section-grammar">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center">
              {t('wordEntryContent.sectionGrammar')}
              {grammarTotal > 0 && <SectionBadge filled={grammarFilled} total={grammarTotal} />}
            </div>
            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={enterEditMode}
                data-testid="grammar-edit-btn"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isEditing ? (
            <div className="space-y-3">
              {renderEditForm()}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={updateWordEntry.isPending}
                  data-testid="grammar-cancel-btn"
                >
                  {t('wordEntryEdit.cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty || updateWordEntry.isPending}
                  data-testid="grammar-save-btn"
                >
                  {updateWordEntry.isPending ? t('wordEntryEdit.saving') : t('wordEntryEdit.save')}
                </Button>
              </div>
            </div>
          ) : (
            <GrammarDisplaySection
              partOfSpeech={wordEntry.part_of_speech}
              grammarData={wordEntry.grammar_data}
            />
          )}
        </CardContent>
      </Card>

      <div data-testid="grammar-discard-dialog">
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
