// src/features/decks/components/V2DeckPage/V2DeckHeader.tsx

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { progressAPI } from '@/services/progressAPI';
import type { Deck } from '@/types/deck';

import { DxActionPanel } from './DxActionPanel';
import { DxMetricStrip } from './DxMetricStrip';
import { DxResumeHeroConnected } from './DxResumeHero';
import { deriveWordProgress } from '../../dx';

/**
 * Props for V2DeckHeader component.
 */
interface V2DeckHeaderProps {
  deck: Deck;
}

/**
 * V2DeckHeader Component
 *
 * Displays the header section for V2 decks with:
 * - DX-05 resume hero (DxResumeHeroConnected) replacing the old cover-image card
 * - DX-06 metric strip (DxMetricStrip) — Due / Streak / Mastered / Time on deck
 * - DX-07 action panel (DxActionPanel) with gradient progress bar, chip selector, CTA
 */
export const V2DeckHeader: React.FC<V2DeckHeaderProps> = ({ deck }) => {
  useTranslation('deck'); // keep namespace registered at this level

  const { data: progressData } = useQuery({
    queryKey: ['deckProgress', deck.id],
    queryFn: () => progressAPI.getDeckProgressDetail(deck.id),
  });

  // Word mastery query — shares TanStack cache key with DxResumeHeroConnected
  // and WordBrowser, so at most ONE network request is made per deck.
  const { data: wordMastery } = useQuery({
    queryKey: ['wordMastery', deck.id],
    queryFn: () => progressAPI.getWordMastery(deck.id),
  });
  const wordProgress = wordMastery ? deriveWordProgress(wordMastery.items) : undefined;

  return (
    <div className="space-y-4">
      {/* DX-05: Resume hero replaces the old cover-image card */}
      <DxResumeHeroConnected deck={deck} />

      {/* DX-06: Metric strip — Due / Streak / Mastered / Time on deck */}
      <DxMetricStrip
        progress={progressData?.progress}
        statistics={progressData?.statistics}
        wordProgress={wordProgress}
      />

      {/* DX-07: Action / practice panel */}
      <DxActionPanel
        deckId={deck.id}
        progress={progressData?.progress}
        wordProgress={wordProgress}
      />
    </div>
  );
};
