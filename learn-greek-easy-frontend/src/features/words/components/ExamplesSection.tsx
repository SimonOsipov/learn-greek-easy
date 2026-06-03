// src/features/words/components/ExamplesSection.tsx

/**
 * Examples section displaying usage examples for word entries.
 * Shows Greek sentences with English and Russian translations.
 *
 * DX-10: re-skinned as a .dx-section card.
 */

import { useTranslation } from 'react-i18next';

import { SpeakerButton } from '@/components/ui/SpeakerButton';
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

// ============================================
// Component
// ============================================

export function ExamplesSection({ examples, wordEntryId, deckId, speed }: ExamplesSectionProps) {
  const { t, i18n } = useTranslation('review');

  // Handle empty/null examples
  if (!examples || examples.length === 0) {
    return (
      <div className="dx-section" data-testid="examples-section">
        <div className="dx-section-eyebrow">
          <span className="dx-kicker" data-testid="examples-eyebrow">
            {t('grammar.examples.eyebrow')}
          </span>
          <h3 className="dx-section-h">{t('grammar.examples.title')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('grammar.examples.noExamples')}</p>
      </div>
    );
  }

  return (
    <div className="dx-section" data-testid="examples-section">
      <div className="dx-section-eyebrow">
        <span className="dx-kicker" data-testid="examples-eyebrow">
          {t('grammar.examples.eyebrow')}
        </span>
        <h3 className="dx-section-h">{t('grammar.examples.title')}</h3>
      </div>
      <div className="dx-examples">
        {examples.map((example, index) => {
          const exampleTranslation = getLocalizedTranslation(
            example.english,
            example.russian,
            i18n.language
          );

          return (
            <div key={index} className="dx-example">
              <div className="dx-example-head">
                {/* Greek sentence + audio speaker (flex-grow group) */}
                <p className="dx-example-el" lang="el">
                  {example.greek}
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
                </p>
              </div>

              {/* Locale-appropriate translation */}
              {exampleTranslation && <p className="dx-example-en">{exampleTranslation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
