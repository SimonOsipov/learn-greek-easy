// src/features/words/components/CollocationsSection.tsx

/**
 * CollocationsSection — placeholder grid for word collocations.
 *
 * DX-10 (R6): not yet connected to backend data.
 * The section shows placeholder slots and one R6 danger UnwiredDot.
 * Greek text carries lang="el" + Noto Serif via .dx-colloc-el.
 */

import { useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx';

export interface CollocationsSectionProps {
  lemma: string;
}

// Placeholder collocations shown while backend model does not exist.
const PLACEHOLDER_COLLOCATIONS = [
  { el: '—', en: '—' },
  { el: '—', en: '—' },
  { el: '—', en: '—' },
  { el: '—', en: '—' },
];

export function CollocationsSection({ lemma: _lemma }: CollocationsSectionProps) {
  const { t } = useTranslation('deck');

  return (
    <div className="dx-section" data-testid="collocations-section">
      <div className="dx-section-head">
        <h3 className="dx-section-h">
          <UnwiredDot tone="danger" aria-label={t('dx.unwiredCollocations')} />
          {t('wordReference.sectionCollocations')}
        </h3>
      </div>
      <div className="dx-colloc" data-testid="collocations-grid">
        {PLACEHOLDER_COLLOCATIONS.map((col, idx) => (
          <div key={idx} className="dx-colloc-row" data-testid="collocation-row">
            <span className="dx-colloc-el" lang="el">
              {col.el}
            </span>
            <span className="dx-colloc-en">{col.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
