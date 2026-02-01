// src/components/admin/vocabulary/GrammarTab.tsx

/**
 * GrammarTab - Tab content component for grammar-specific vocabulary card fields.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() and useWatch() to observe the part_of_speech field
 * and conditionally render the appropriate grammar form.
 *
 * Behavior:
 * - Shows placeholder when no part of speech is selected
 * - Renders NounGrammarForm when part_of_speech === 'noun'
 * - Renders VerbGrammarForm when part_of_speech === 'verb'
 * - Renders AdjectiveGrammarForm when part_of_speech === 'adjective'
 * - Renders AdverbGrammarForm when part_of_speech === 'adverb'
 * - Clears previous grammar data when part_of_speech changes
 */

import { useEffect, useRef } from 'react';

import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AdjectiveGrammarForm } from './grammar/AdjectiveGrammarForm';
import { AdverbGrammarForm } from './grammar/AdverbGrammarForm';
import { NounGrammarForm } from './grammar/NounGrammarForm';
import { VerbGrammarForm } from './grammar/VerbGrammarForm';

// ============================================
// Props Interface
// ============================================

export interface GrammarTabProps {
  isSubmitting?: boolean;
}

// ============================================
// Component
// ============================================

export function GrammarTab({ isSubmitting = false }: GrammarTabProps) {
  const { t } = useTranslation('admin');
  const { control, setValue } = useFormContext();

  // Watch the part_of_speech field to conditionally render the appropriate form
  const partOfSpeech = useWatch({ control, name: 'part_of_speech' });

  // Track previous part of speech to clear old grammar data when it changes
  const previousPartOfSpeech = useRef(partOfSpeech);

  useEffect(() => {
    if (previousPartOfSpeech.current && previousPartOfSpeech.current !== partOfSpeech) {
      // Clear the old grammar data when part of speech changes
      if (previousPartOfSpeech.current === 'noun') setValue('noun_data', null);
      if (previousPartOfSpeech.current === 'verb') setValue('verb_data', null);
      if (previousPartOfSpeech.current === 'adjective') setValue('adjective_data', null);
      if (previousPartOfSpeech.current === 'adverb') setValue('adverb_data', null);
    }
    previousPartOfSpeech.current = partOfSpeech;
  }, [partOfSpeech, setValue]);

  // Render placeholder when no part of speech is selected
  if (!partOfSpeech) {
    return (
      <div
        className="flex items-center justify-center py-8 text-center text-muted-foreground"
        data-testid="grammar-tab-placeholder"
      >
        <p>{t('vocabularyCard.grammarTab.placeholder')}</p>
      </div>
    );
  }

  // Render the appropriate grammar form based on part of speech
  return (
    <div data-testid="grammar-tab">
      {partOfSpeech === 'noun' && <NounGrammarForm isSubmitting={isSubmitting} />}
      {partOfSpeech === 'verb' && <VerbGrammarForm isSubmitting={isSubmitting} />}
      {partOfSpeech === 'adjective' && <AdjectiveGrammarForm isSubmitting={isSubmitting} />}
      {partOfSpeech === 'adverb' && <AdverbGrammarForm isSubmitting={isSubmitting} />}
    </div>
  );
}

export default GrammarTab;
