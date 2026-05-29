// src/features/words/components/ExamplesSection.tsx

/**
 * Examples section displaying usage examples for word entries.
 * Shows Greek sentences with English and Russian translations.
 *
 * DX-10: re-skinned as a .dx-section card.
 * Each example has a derived type tag (.dx-example-tag) + R5 amber UnwiredDot.
 */

import { useTranslation } from 'react-i18next';

import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { UnwiredDot } from '@/features/decks/dx';
import { track } from '@/lib/analytics';
import { getLocalizedTranslation } from '@/lib/localeUtils';
import type { WordEntryExampleSentence } from '@/services/wordEntryAPI';
import type { AudioSpeed } from '@/utils/audioSpeed';

// ============================================
// Types
// ============================================

export interface ExamplesSectionProps {
  /** Array of example sentences */
  examples: WordEntryExampleSentence[] | null;
  wordEntryId?: string;
  deckId?: string;
  speed?: AudioSpeed;
}

export type ExampleTag = 'simple' | 'comparative' | 'locative';

/**
 * Maps the free-text `context` field to one of three ExampleTag values.
 * Since the backend has no tag taxonomy, this is always derived=false
 * (we use 'simple' as placeholder) unless the context matches a known keyword.
 *
 * derived=true  -> context contained a recognisable keyword
 * derived=false -> fell back to 'simple' placeholder
 */
export function mapContextToTag(context?: string | null): {
  tag: ExampleTag;
  derived: boolean;
} {
  if (!context) return { tag: 'simple', derived: false };
  const lower = context.toLowerCase();
  if (lower.includes('comparative') || lower.includes('comparison')) {
    return { tag: 'comparative', derived: true };
  }
  if (
    lower.includes('locative') ||
    lower.includes('location') ||
    lower.includes('place') ||
    lower.includes('where')
  ) {
    return { tag: 'locative', derived: true };
  }
  return { tag: 'simple', derived: false };
}

// ============================================
// Component
// ============================================

export function ExamplesSection({ examples, wordEntryId, deckId, speed }: ExamplesSectionProps) {
  const { t, i18n } = useTranslation(['review', 'deck']);

  // Handle empty/null examples
  if (!examples || examples.length === 0) {
    return (
      <div className="dx-section" data-testid="examples-section">
        <div className="dx-section-head">
          <h3 className="dx-section-h">{t('grammar.examples.title')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('grammar.examples.noExamples')}</p>
      </div>
    );
  }

  return (
    <div className="dx-section" data-testid="examples-section">
      <div className="dx-section-head">
        <h3 className="dx-section-h">{t('grammar.examples.title')}</h3>
      </div>
      <div className="dx-examples">
        {examples.map((example, index) => {
          const exampleTranslation = getLocalizedTranslation(
            example.english,
            example.russian,
            i18n.language
          );
          const { tag } = mapContextToTag(example.context);

          return (
            <div key={index} className="dx-example">
              <div className="dx-example-head">
                {/* Type tag with R5 amber UnwiredDot */}
                <span className="dx-example-tag" data-testid="example-tag">
                  <UnwiredDot tone="amber" aria-label={t('deck:dx.unwiredExampleTag')} />
                  {tag}
                </span>
                {/* Audio speaker */}
                {example.audio_url && (
                  <SpeakerButton
                    audioUrl={example.audio_url}
                    size="sm"
                    speed={speed}
                    onPlay={() =>
                      track('example_audio_played', {
                        word_entry_id: wordEntryId ?? '',
                        example_id: example.id ?? '',
                        context: 'reference',
                        deck_id: deckId ?? '',
                        playback_speed: 1,
                      })
                    }
                  />
                )}
              </div>

              {/* Greek sentence */}
              <p className="dx-example-el" lang="el">
                {example.greek}
              </p>

              {/* Locale-appropriate translation */}
              {exampleTranslation && <p className="dx-example-en">{exampleTranslation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
