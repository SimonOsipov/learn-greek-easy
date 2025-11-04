import { useState } from 'react';
import { useReviewStore } from '@/stores/reviewStore';
import { cn } from '@/lib/utils';
import type { ReviewRating } from '@/types/review';

export function RatingButtons() {
  const { rateCard, canRate, isLoading } = useReviewStore();
  const [highlightedButton, setHighlightedButton] = useState<ReviewRating | null>(null);

  const handleRate = async (rating: ReviewRating) => {
    setHighlightedButton(rating);
    await rateCard(rating);
    setTimeout(() => setHighlightedButton(null), 200);
  };

  const buttons: Array<{ rating: ReviewRating; label: string; color: string }> = [
    { rating: 'again', label: 'Again', color: 'bg-red-500 hover:bg-red-600' },
    { rating: 'hard', label: 'Hard', color: 'bg-orange-500 hover:bg-orange-600' },
    { rating: 'good', label: 'Good', color: 'bg-green-500 hover:bg-green-600' },
    { rating: 'easy', label: 'Easy', color: 'bg-green-700 hover:bg-green-800' },
  ];

  return (
    <div className="px-8 py-6 flex gap-3 justify-center">
      {buttons.map(({ rating, label, color }) => (
        <button
          key={rating}
          onClick={() => handleRate(rating)}
          disabled={!canRate || isLoading}
          className={cn(
            'flex-1 max-w-[120px] px-6 py-3 rounded-lg text-white font-semibold text-sm',
            'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            color,
            highlightedButton === rating && 'ring-2 ring-offset-2 ring-current',
            canRate && 'hover:-translate-y-0.5 hover:shadow-lg'
          )}
          aria-label={`Rate card as ${label}`}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
