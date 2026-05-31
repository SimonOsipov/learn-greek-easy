// src/features/decks/components/V2DeckPage/DxActionPanel.tsx
//
// DX-07 — Action / practice panel re-skin.
//
// Replaces the progress+practice <Card> from V2DeckHeader with the
// .dx-action* design-system pattern.  Owns:
//   - local selectedCardType state
//   - handleStartReview navigation
//   - gradient progress bar + legend
//   - card-type chip selector
//   - CTA button

import { useState } from 'react';

import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { ProgressMetrics } from '@/services/progressAPI';

import { Kicker } from '../../dx';

import type { deriveWordProgress } from '../../dx';

// ─────────────────────────────────────────────────────────────────────────────
// Card type filters — single source of truth; reused by tests
// ─────────────────────────────────────────────────────────────────────────────

const CARD_TYPE_FILTERS = [
  { value: 'all', labelKey: 'v2Practice.filterAll' },
  { value: 'meaning', labelKey: 'v2Practice.filterTranslation' },
  { value: 'plural_form', labelKey: 'v2Practice.filterPluralForm' },
  { value: 'article', labelKey: 'v2Practice.filterArticle' },
  { value: 'declension', labelKey: 'v2Practice.filterDeclension' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface DxActionPanelProps {
  deckId: string;
  progress: ProgressMetrics | undefined;
  wordProgress?: ReturnType<typeof deriveWordProgress> | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DxActionPanel({ deckId, progress: _progress, wordProgress }: DxActionPanelProps) {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();

  const [selectedCardType, setSelectedCardType] = useState<string>('all');

  // Word-level progress drives the bar and legend; fall back to 0 when no data yet
  const pct = wordProgress?.progressPct ?? 0;

  const handleStartReview = () => {
    const basePath = `/decks/${deckId}/practice`;
    if (selectedCardType === 'all') {
      navigate(basePath);
    } else {
      navigate(`${basePath}?cardType=${selectedCardType}`);
    }
  };

  return (
    <div className="dx-action" data-testid="dx-action-panel">
      {/* Header: eyebrow kicker */}
      <Kicker tone="primary">{t('detail.actionEyebrow')}</Kicker>

      {/* Progress head: title + percentage */}
      <div className="dx-action-head">
        <h3 className="dx-action-h">{t('detail.actionYourProgress', { pct })}</h3>
      </div>

      {/* Single gradient progress bar */}
      <div
        className="dx-action-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span data-testid="dx-action-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Counts legend — word-level counts */}
      <div className="dx-action-legend">
        <span className="dx-action-legend-item" data-tone="todo">
          {t('detail.actionCounts', {
            new: wordProgress?.newWords ?? 0,
            inProgress: wordProgress?.inProgressWords ?? 0,
            mastered: wordProgress?.masteredWords ?? 0,
          })}
        </span>
      </div>

      {/* Card-type chip selector */}
      <div className="dx-action-want">
        <p className="dx-action-want-l">{t('v2Practice.filterLabel')}</p>
        <div className="dx-action-want-chips">
          {CARD_TYPE_FILTERS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              className="dx-action-want-chip"
              aria-pressed={selectedCardType === value}
              onClick={() => setSelectedCardType(value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        className="dx-action-cta"
        data-testid="start-review-button"
        onClick={handleStartReview}
      >
        <BookOpen />
        {t('detail.startReview')}
      </button>
    </div>
  );
}
