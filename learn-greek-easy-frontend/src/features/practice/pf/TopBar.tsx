// src/features/practice/pf/TopBar.tsx
//
// 3-column (.pf-top) top bar for the practice session.
// Left:   exit button + deck label (name + counts)
// Centre: segmented ProgressBar
// Right:  StreakPill + LanguageSwitcher + ThemeSwitcher
//
// Design-system: all colours via pf.css HSL tokens. No raw hex.

import { ChevronLeft } from 'lucide-react';

import { LanguageSwitcher } from '@/components/i18n';
import { ThemeSwitcher } from '@/components/theme';
import { Button } from '@/components/ui/button';
import type { StudyQueueCard } from '@/services/studyAPI';
import type { RatingKey } from '@/stores/v2PracticeStore';

import { ProgressBar } from './ProgressBar';
import { StreakPill } from './StreakPill';

export interface TopBarProps {
  /** Navigate back to the deck. */
  onExit: () => void;
  /** Deck display name. Fallback to "Practice" when null. */
  deckName: string | null;
  /** All cards in the session queue. */
  cards: StudyQueueCard[];
  /** Zero-based index of the current card. */
  currentIndex: number;
  /** Number of new cards in this session (from store totalNew). */
  totalNew: number;
  /** Number of review cards in this session (from store totalReview). */
  totalReview: number;
  /** Current streak count. */
  streak: number;
  /** Per-card rating outcomes. */
  ratings: (RatingKey | null)[];
  /** Whether to display the streak pill. */
  showStreak: boolean;
}

/**
 * TopBar — replaces legacy PracticeHeader + ProgressIndicator in the V2
 * practice page. Provides deck context, visual progress, and utility chrome.
 */
export function TopBar({
  onExit,
  deckName,
  cards,
  currentIndex,
  totalNew,
  totalReview,
  streak,
  ratings,
  showStreak,
}: TopBarProps) {
  const displayName = deckName ?? 'Practice';
  const totalCards = cards.length;

  return (
    <div className="pf-top" data-testid="pf-top-bar">
      {/* ── Left: exit + deck label ─────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="chrome-ghost"
          size="sm"
          onClick={onExit}
          aria-label="Exit practice"
          data-testid="pf-exit-button"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Exit</span>
        </Button>

        <div className="pf-deck-label min-w-0">
          <span className="pf-deck-label__title">{displayName} · Practice</span>
          <span className="pf-deck-label__meta">
            {totalCards} cards · {totalReview} review · {totalNew} new
          </span>
        </div>
      </div>

      {/* ── Centre: segmented progress ─────────────────────────────────── */}
      <ProgressBar cards={cards} currentIndex={currentIndex} ratings={ratings} />

      {/* ── Right: streak + utility chrome ────────────────────────────── */}
      <div className="pf-right">
        <StreakPill streak={streak} showStreak={showStreak} />
        <LanguageSwitcher variant="icon" />
        <ThemeSwitcher />
      </div>
    </div>
  );
}
