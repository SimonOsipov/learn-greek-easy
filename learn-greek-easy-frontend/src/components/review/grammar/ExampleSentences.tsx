import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Example } from '@/types/grammar';

import { TenseBadge } from './TenseBadge';

export interface ExampleSentencesProps {
  examples: Example[];
}

export function ExampleSentences({ examples }: ExampleSentencesProps) {
  const { t, i18n } = useTranslation('review');
  const [revealedIndexes, setRevealedIndexes] = useState<Set<number>>(new Set());

  const toggleReveal = (index: number) => {
    setRevealedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getTranslation = (example: Example): string => {
    const primary = i18n.language === 'ru' ? example.russian : example.english;
    const fallback = i18n.language === 'ru' ? example.english : example.russian;
    return primary || fallback || '';
  };

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
      {examples.map((example, index) => {
        const isRevealed = revealedIndexes.has(index);
        const translation = getTranslation(example);

        return (
          <Card key={index}>
            <CardContent className="p-4">
              {/* Greek - always visible, with optional tense badge */}
              <div className="flex items-baseline gap-2">
                <p className="text-base font-medium">{example.greek}</p>
                {example.tense && <TenseBadge tense={example.tense} />}
              </div>

              {/* Translation - blurred until revealed */}
              {translation && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleReveal(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleReveal(index);
                    }
                  }}
                  aria-label={
                    isRevealed
                      ? t('grammar.examples.hideTranslation')
                      : t('grammar.examples.showTranslation')
                  }
                  className={cn(
                    'mt-1 transition-[filter] duration-200',
                    !isRevealed && 'cursor-pointer select-none blur-sm'
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
