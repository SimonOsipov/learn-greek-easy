import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReviewStore } from '@/stores/reviewStore';
import type { ReviewRating } from '@/types/review';

export function RatingButtons() {
  const { t } = useTranslation('review');
  const { rateCard, canRate, isLoading } = useReviewStore();
  const [highlightedButton, setHighlightedButton] = useState<ReviewRating | null>(null);

  const handleRate = async (rating: ReviewRating) => {
    setHighlightedButton(rating);
    await rateCard(rating);
    setTimeout(() => setHighlightedButton(null), 200);
  };

  const buttons: Array<{ rating: ReviewRating; labelKey: string; color: string }> = [
    { rating: 'again', labelKey: 'ratings.again', color: 'bg-red-500 hover:bg-red-600' },
    { rating: 'hard', labelKey: 'ratings.hard', color: 'bg-orange-500 hover:bg-orange-600' },
    { rating: 'good', labelKey: 'ratings.good', color: 'bg-green-500 hover:bg-green-600' },
    { rating: 'easy', labelKey: 'ratings.easy', color: 'bg-green-700 hover:bg-green-800' },
  ];

  return (
    <div className="flex justify-center gap-3 px-8 py-6">
      {buttons.map(({ rating, labelKey, color }) => {
        const label = t(labelKey);
        return (
          <Button
            key={rating}
            onClick={() => handleRate(rating)}
            disabled={!canRate || isLoading}
            className={cn(
              'max-w-[120px] flex-1 rounded-lg px-6 py-3 text-sm font-semibold text-white',
              'transition-all duration-200',
              color,
              highlightedButton === rating && 'ring-2 ring-current ring-offset-2',
              canRate && 'hover:-translate-y-0.5 hover:shadow-lg'
            )}
            aria-label={`Rate card as ${label}`}
            type="button"
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
