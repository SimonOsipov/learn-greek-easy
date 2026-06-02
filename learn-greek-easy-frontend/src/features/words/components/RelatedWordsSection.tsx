// src/features/words/components/RelatedWordsSection.tsx

/**
 * RelatedWordsSection — clickable chip row of same-deck sibling words.
 *
 * DX-10 (R7): sources neighbours from the already-cached useWordEntries({ deckId }).
 * "Related" = same-deck neighbours in deck order (up to 3, forward-first, ascending index).
 * Clicking a chip navigates to that word's reference page.
 */

import { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useWordEntries } from '@/features/decks/hooks/useWordEntries';
import { getLocalizedTranslation } from '@/lib/localeUtils';

export interface RelatedWordsSectionProps {
  deckId: string;
  wordId: string;
}

export function RelatedWordsSection({ deckId, wordId }: RelatedWordsSectionProps) {
  const { t, i18n } = useTranslation('deck');
  const navigate = useNavigate();

  const { wordEntries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useWordEntries(
    { deckId }
  );

  const idx = wordEntries.findIndex((w) => w.id === wordId);

  useEffect(() => {
    if (idx === -1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [idx, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Guard: missing context
  if (!deckId || !wordId) return null;
  // Guard: initial load
  if (isLoading) return null;
  // Guard: still paginating to find the current word
  if (idx === -1 && hasNextPage) return null;
  // Guard: all pages exhausted but word not found
  if (idx === -1) return null;

  // Collect up to 3 neighbours expanding outward, forward-first
  const collected: typeof wordEntries = [];
  for (let d = 1; collected.length < 3; d++) {
    const forwardIdx = idx + d;
    const backIdx = idx - d;
    const hasForward = forwardIdx < wordEntries.length;
    const hasBack = backIdx >= 0;
    if (!hasForward && !hasBack) break;
    if (hasForward) collected.push(wordEntries[forwardIdx]);
    if (collected.length < 3 && hasBack) collected.push(wordEntries[backIdx]);
  }

  if (collected.length === 0) return null;

  // Sort by ascending deck index for consistent render order
  const neighbours = [...collected].sort((a, b) => wordEntries.indexOf(a) - wordEntries.indexOf(b));

  return (
    <div className="dx-section" data-testid="related-words-section">
      <div className="dx-section-eyebrow">
        <span className="dx-kicker" data-testid="related-words-eyebrow">
          {t('wordReference.relatedWordsEyebrow')}
        </span>
        <h3 className="dx-section-h">{t('wordReference.sectionRelatedWords')}</h3>
      </div>
      <div className="dx-related" data-testid="related-words-chips">
        {neighbours.map((n) => (
          <button
            key={n.id}
            type="button"
            className="dx-related-chip"
            data-testid="related-word-chip"
            onClick={() => {
              navigate(`/decks/${deckId}/words/${n.id}`);
              window.scrollTo({ top: 0 });
            }}
          >
            <span className="dx-related-chip-el" lang="el">
              {n.lemma}
            </span>
            <span className="dx-related-chip-en">
              {getLocalizedTranslation(n.translation_en, n.translation_ru, i18n.language)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
