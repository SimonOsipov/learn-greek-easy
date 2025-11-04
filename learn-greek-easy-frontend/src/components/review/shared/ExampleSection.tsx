import { cn } from '@/lib/utils';
import type { CardReview } from '@/types/review';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { PremiumGate } from './PremiumGate';

interface ExampleSectionProps {
  card: CardReview;
  selectedTense?: 'present' | 'past' | 'future';
  isFlipped: boolean;
}

export function ExampleSection({ card, selectedTense, isFlipped }: ExampleSectionProps) {
  const isPremium = usePremiumAccess();

  const getExample = () => {
    if (card.nounData) {
      return {
        greek: card.nounData.exampleSentence,
        english: card.nounData.exampleTranslation,
      };
    }
    if (card.verbData && selectedTense) {
      return card.verbData.exampleSentences[selectedTense];
    }
    return null;
  };

  const example = getExample();
  if (!example) return null;

  return (
    <div className="bg-gray-50 px-6 py-6">
      <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">
        💬 Example in Context
      </div>

      <PremiumGate isLocked={!isPremium} badgeText="Pro">
        <div className="bg-white px-4 py-4 rounded-lg border-l-4 border-[#667eea]">
          <p className="text-sm font-medium text-gray-900 mb-2">{example.greek}</p>
          <p
            className={cn(
              'text-xs italic text-gray-600 transition-opacity duration-300',
              isFlipped ? 'opacity-100' : 'opacity-0'
            )}
          >
            {example.english}
          </p>
        </div>
      </PremiumGate>
    </div>
  );
}
