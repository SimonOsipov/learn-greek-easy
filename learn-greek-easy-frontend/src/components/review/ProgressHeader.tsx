import { useReviewStore } from '@/stores/reviewStore';

export function ProgressHeader() {
  const { progress, sessionStats } = useReviewStore();
  const { current, total } = progress;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  // Calculate estimated time remaining
  const avgTimePerCard = sessionStats.averageTime || 30; // 30s default
  const cardsRemaining = sessionStats.cardsRemaining;
  const minutesRemaining = Math.ceil((cardsRemaining * avgTimePerCard) / 60);

  return (
    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#667eea] to-[#764ba2] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Progress text */}
      <div className="text-center text-sm text-gray-600">
        Card {current + 1} of {total} • {minutesRemaining} min remaining
      </div>
    </div>
  );
}
