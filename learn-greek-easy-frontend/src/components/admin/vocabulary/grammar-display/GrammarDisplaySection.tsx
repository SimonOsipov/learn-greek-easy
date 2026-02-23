// src/components/admin/vocabulary/grammar-display/GrammarDisplaySection.tsx

/**
 * GrammarDisplaySection - Routes grammar display to POS-specific component.
 *
 * - Returns null for 'phrase' (no grammar section)
 * - Shows "No grammar data" for null grammar_data on non-phrase POS
 * - Normalizes V1/V2 data and routes to appropriate display component
 */

import { useTranslation } from 'react-i18next';

import { AdjectiveGrammarDisplay } from './AdjectiveGrammarDisplay';
import { AdverbGrammarDisplay } from './AdverbGrammarDisplay';
import { normalizeGrammarData } from './grammarNormalizer';
import { NounGrammarDisplay } from './NounGrammarDisplay';
import { VerbGrammarDisplay } from './VerbGrammarDisplay';

// ============================================
// Props
// ============================================

interface GrammarDisplaySectionProps {
  partOfSpeech: string;
  grammarData: Record<string, unknown> | null;
}

// ============================================
// Component
// ============================================

export function GrammarDisplaySection({ partOfSpeech, grammarData }: GrammarDisplaySectionProps) {
  const { t } = useTranslation('admin');

  // Phrases have no grammar section at all
  if (partOfSpeech === 'phrase') return null;

  if (!grammarData) {
    return (
      <p data-testid="grammar-no-data" className="text-sm italic text-muted-foreground">
        {t('wordEntryContent.noGrammarData')}
      </p>
    );
  }

  const normalized = normalizeGrammarData(grammarData, partOfSpeech);

  switch (partOfSpeech) {
    case 'noun':
      return <NounGrammarDisplay fields={normalized} />;
    case 'verb':
      return <VerbGrammarDisplay fields={normalized} />;
    case 'adjective':
      return <AdjectiveGrammarDisplay fields={normalized} />;
    case 'adverb':
      return <AdverbGrammarDisplay fields={normalized} />;
    default:
      return (
        <p className="text-sm text-muted-foreground">
          {t('wordEntryContent.unknownPartOfSpeech', { pos: partOfSpeech })}
        </p>
      );
  }
}
