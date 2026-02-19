import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { trackExampleAudioPlayed, trackWordAudioFailed } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { Example } from '@/types/grammar';

import { TenseBadge } from './TenseBadge';

// Tense ordering for consistent display (same order as TenseTabs)
const TENSE_ORDER: readonly string[] = [
  'present',
  'imperfect',
  'past',
  'future',
  'perfect',
  'imperative',
] as const;

function getTenseSortIndex(tense: string | null | undefined): number {
  if (!tense) return TENSE_ORDER.length;
  const index = TENSE_ORDER.indexOf(tense.toLowerCase());
  return index === -1 ? TENSE_ORDER.length : index;
}

export interface ExampleSentencesProps {
  examples: Example[];
  isFlipped?: boolean;
  wordEntryId?: string;
  deckId?: string;
}

export function ExampleSentences({
  examples,
  isFlipped = true,
  wordEntryId,
  deckId,
}: ExampleSentencesProps) {
  const { t, i18n } = useTranslation('review');

  const getTranslation = (example: Example): string => {
    const primary = i18n.language === 'ru' ? example.russian : example.english;
    const fallback = i18n.language === 'ru' ? example.english : example.russian;
    return primary || fallback || '';
  };

  // Sort examples by tense for consistent display order
  const sortedExamples = useMemo(() => {
    if (!examples || examples.length === 0) return [];
    return [...examples].sort((a, b) => getTenseSortIndex(a.tense) - getTenseSortIndex(b.tense));
  }, [examples]);

  if (!examples || examples.length === 0) {
    return (
      <Card>
        <CardContent className="px-4 py-3">
          <p className="text-sm text-muted-foreground">{t('grammar.examples.noExamples')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sortedExamples.map((example, index) => {
        const translation = getTranslation(example);

        return (
          <Card key={index}>
            <CardContent className="p-4">
              {/* Greek - always visible, with optional tense badge and audio button */}
              <div className="flex items-baseline gap-2">
                <p className="text-base font-medium">{example.greek}</p>
                {example.tense && <TenseBadge tense={example.tense} />}
                {isFlipped && example.audio_url && (
                  <SpeakerButton
                    audioUrl={example.audio_url}
                    size="sm"
                    onPlay={() =>
                      trackExampleAudioPlayed({
                        word_entry_id: wordEntryId ?? '',
                        example_id: example.id ?? '',
                        context: 'review',
                        deck_id: deckId ?? '',
                      })
                    }
                    onError={(error) =>
                      trackWordAudioFailed({
                        word_entry_id: wordEntryId ?? '',
                        error,
                        audio_type: 'example',
                        context: 'review',
                      })
                    }
                  />
                )}
              </div>

              {/* Translation - visible when card is flipped */}
              {translation && (
                <div
                  className={cn(
                    'mt-1 transition-[filter] duration-200',
                    !isFlipped && 'select-none blur-sm'
                  )}
                >
                  <p className="text-sm text-muted-foreground">{translation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
