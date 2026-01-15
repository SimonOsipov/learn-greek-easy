import { cn } from '@/lib/utils';
import type { CardReview } from '@/types/review';

interface WordTypeBadgeProps {
  partOfSpeech: CardReview['partOfSpeech'];
  metadata?: CardReview['nounData'] | CardReview['verbData'];
}

export function WordTypeBadge({ partOfSpeech, metadata }: WordTypeBadgeProps) {
  if (!partOfSpeech) return null;

  const getLabel = () => {
    if (partOfSpeech === 'noun' && metadata && 'gender' in metadata) {
      const gender = metadata.gender;
      return `Noun • ${gender.charAt(0).toUpperCase() + gender.slice(1)}`;
    }
    if (partOfSpeech === 'verb' && metadata && 'voice' in metadata) {
      const voice = metadata.voice;
      return `Verb • ${voice.charAt(0).toUpperCase() + voice.slice(1)} Voice`;
    }
    return partOfSpeech.charAt(0).toUpperCase() + partOfSpeech.slice(1);
  };

  const colorClass =
    partOfSpeech === 'verb'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        colorClass
      )}
    >
      {getLabel()}
    </span>
  );
}
