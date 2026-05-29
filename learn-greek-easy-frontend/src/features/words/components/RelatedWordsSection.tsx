// src/features/words/components/RelatedWordsSection.tsx

/**
 * RelatedWordsSection — placeholder inert chip row for related words.
 *
 * DX-10 (R7): not yet connected to backend data (no vocab-graph).
 * Chips are intentionally inert — clicking does NOT navigate.
 * One R7 danger UnwiredDot in the section heading.
 * Greek text carries lang="el" + Noto Serif via .dx-related-chip-el.
 */

import { useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx';

export interface RelatedWordsSectionProps {
  lemma: string;
}

// Placeholder chips shown while backend vocab-graph does not exist.
const PLACEHOLDER_RELATED = [
  { el: '—', en: '—' },
  { el: '—', en: '—' },
  { el: '—', en: '—' },
];

export function RelatedWordsSection({ lemma: _lemma }: RelatedWordsSectionProps) {
  const { t } = useTranslation('deck');

  return (
    <div className="dx-section" data-testid="related-words-section">
      <div className="dx-section-head">
        <h3 className="dx-section-h">
          <UnwiredDot tone="danger" aria-label={t('dx.unwiredRelated')}>
            {t('wordReference.sectionRelatedWords')}
          </UnwiredDot>
        </h3>
      </div>
      <div className="dx-related" data-testid="related-words-chips">
        {PLACEHOLDER_RELATED.map((word, idx) => (
          /* intentionally inert — no onClick, no navigation */
          <span key={idx} className="dx-related-chip" data-testid="related-word-chip">
            <span className="dx-related-chip-el" lang="el">
              {word.el}
            </span>
            <span className="dx-related-chip-en">{word.en}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
