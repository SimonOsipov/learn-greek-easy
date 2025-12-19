import React from 'react';

import { useTranslation } from 'react-i18next';

import type { DeckProgress } from '@/types/deck';

export interface DeckProgressBarProps {
  progress: DeckProgress;
  size?: 'default' | 'large';
  showLegend?: boolean;
  className?: string;
}

export const DeckProgressBar: React.FC<DeckProgressBarProps> = ({
  progress,
  size = 'default',
  showLegend = false,
  className = '',
}) => {
  const { t } = useTranslation('deck');
  const { cardsNew, cardsLearning, cardsMastered } = progress;
  const totalCards = cardsNew + cardsLearning + cardsMastered;

  // Calculate percentages
  const newPercent = totalCards > 0 ? (cardsNew / totalCards) * 100 : 0;
  const learningPercent = totalCards > 0 ? (cardsLearning / totalCards) * 100 : 0;
  const masteredPercent = totalCards > 0 ? (cardsMastered / totalCards) * 100 : 0;

  const height = size === 'large' ? 'h-3' : 'h-2';

  return (
    <div className={className}>
      {/* Progress Bar */}
      <div
        className={`w-full ${height} flex overflow-hidden rounded-full bg-gray-200`}
        role="progressbar"
        aria-label="Deck learning progress"
        aria-valuenow={cardsMastered}
        aria-valuemin={0}
        aria-valuemax={totalCards}
      >
        {/* New Cards Segment */}
        {newPercent > 0 && (
          <div
            className="bg-gray-200"
            style={{ width: `${newPercent}%` }}
            aria-label={`${cardsNew} new cards`}
          />
        )}

        {/* Learning Cards Segment */}
        {learningPercent > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${learningPercent}%` }}
            aria-label={`${cardsLearning} learning cards`}
          />
        )}

        {/* Mastered Cards Segment */}
        {masteredPercent > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${masteredPercent}%` }}
            aria-label={`${cardsMastered} mastered cards`}
          />
        )}
      </div>

      {/* Optional Legend */}
      {showLegend && (
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-gray-200" />
            <span>
              {cardsNew} {t('detail.new')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>
              {cardsLearning} {t('detail.learning')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>
              {cardsMastered} {t('detail.masteredLabel')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
