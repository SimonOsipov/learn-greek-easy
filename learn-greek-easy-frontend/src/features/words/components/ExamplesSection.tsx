// src/features/words/components/ExamplesSection.tsx

/**
 * Examples section displaying usage examples for word entries.
 * Shows Greek sentences with English and Russian translations.
 */

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { trackExampleAudioPlayed, trackWordAudioFailed } from '@/lib/analytics';
import { getLocalizedTranslation } from '@/lib/localeUtils';
import type { WordEntryExampleSentence } from '@/services/wordEntryAPI';

// ============================================
// Types
// ============================================

export interface ExamplesSectionProps {
  /** Array of example sentences */
  examples: WordEntryExampleSentence[] | null;
  wordEntryId?: string;
  deckId?: string;
}

// ============================================
// Component
// ============================================

export function ExamplesSection({ examples, wordEntryId, deckId }: ExamplesSectionProps) {
  const { t, i18n } = useTranslation('review');

  // Handle empty/null examples
  if (!examples || examples.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('grammar.examples.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('grammar.examples.noExamples')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('grammar.examples.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {examples.map((example, index) => {
          const exampleTranslation = getLocalizedTranslation(
            example.english,
            example.russian,
            i18n.language
          );
          return (
            <Card key={index} className="bg-muted/30 p-4 transition-colors hover:bg-muted/50">
              {/* Context badge */}
              {example.context && (
                <Badge variant="outline" className="mb-2 text-xs">
                  {example.context}
                </Badge>
              )}

              {/* Greek sentence */}
              <div className="flex items-center gap-2">
                <p className="text-lg font-medium text-foreground">{example.greek}</p>
                {example.audio_url && (
                  <SpeakerButton
                    audioUrl={example.audio_url}
                    size="sm"
                    onPlay={() =>
                      trackExampleAudioPlayed({
                        word_entry_id: wordEntryId ?? '',
                        example_id: example.id ?? '',
                        context: 'reference',
                        deck_id: deckId ?? '',
                        playback_speed: 1,
                      })
                    }
                    onError={(error) =>
                      trackWordAudioFailed({
                        word_entry_id: wordEntryId ?? '',
                        error,
                        audio_type: 'example',
                        context: 'reference',
                      })
                    }
                  />
                )}
              </div>

              {/* Locale-appropriate translation */}
              {exampleTranslation && (
                <p className="mt-2 text-sm text-muted-foreground">{exampleTranslation}</p>
              )}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
