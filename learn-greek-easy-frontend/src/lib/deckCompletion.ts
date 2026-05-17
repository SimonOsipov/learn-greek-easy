/**
 * deckCompletion.ts — Format-conversion adapter for the admin Decks Drawer (ADMIN2-09).
 *
 * Wraps the existing `computeChipsFromCard` (vocab) and `computeCultureChips` (culture)
 * helpers and translates their `{ label, color }` output into the `DeckPill` shape
 * consumed by the drawer atom. No business logic lives here — only shape adaptation.
 */
import { computeChipsFromCard, type ChipData, type ChipColor } from '@/lib/completeness';
import { computeCultureChips, type CultureChipData } from '@/lib/cultureCompleteness';
import type { AdminVocabularyCard, AdminCultureQuestion } from '@/services/adminAPI';

// ============================================================
// Public interface
// ============================================================

/**
 * A single completion pill rendered in the Decks Drawer.
 * Produced by {@link getWordCompletion} and {@link getCultureCompletion}.
 */
export interface DeckPill {
  /** Stable identifier, e.g. `'en' | 'ru' | 'audio-a2' | 'news'` */
  name: string;
  /** Display label, e.g. `'EN 2/2'`, `'Audio ✓'`, `'B2 Audio'` */
  label: string;
  /** Numeric ratio (0..1) when the upstream chip carries one; otherwise undefined */
  value?: number;
  /** Completion flag — derived from numeric ratio in label, or falls back to `color === 'green'` */
  done: boolean;
  /** When `false` the drawer must NOT render this pill */
  visible: boolean;
  /** Verbatim tooltip from the upstream chip, when present */
  tooltip?: string;
}

// ============================================================
// Shared `done` derivation
// ============================================================

/**
 * Derives the `done` flag from an upstream chip's label and color.
 *
 * Rules (single source of truth, per DKDR-01 spec):
 * 1. If the label ends with a `N/M` ratio, `done = (N === M && M > 0)`.
 * 2. Otherwise fall back to `done = (color === 'green')`.
 *
 * The label-parse strategy keeps `done` correct even when `ratio` is
 * misleadingly set (e.g. `audio_status === 'generating'` → `ratio: 0.5`
 * but label `'Audio …'` has no ratio → falls back to color → `done: false`).
 */
function deriveDone(label: string, color: ChipColor): boolean {
  const match = /(\d+)\/(\d+)$/.exec(label);
  if (match) {
    const numerator = parseInt(match[1], 10);
    const denominator = parseInt(match[2], 10);
    return denominator > 0 && numerator === denominator;
  }
  return color === 'green';
}

// ============================================================
// Word-side adapter
// ============================================================

/**
 * Returns 6 completion pills for a vocabulary card in fixed order:
 * `[en, ru, pron, audio, gram, ex]`.
 *
 * Input is strictly `AdminVocabularyCard` (per QA #2b — `WordEntryResponse`
 * lacks the granular enrichment counts that `computeChipsFromCard` requires).
 */
export function getWordCompletion(card: AdminVocabularyCard): DeckPill[] {
  const chips: ChipData[] = computeChipsFromCard(card);
  return chips.map(
    (chip): DeckPill => ({
      name: chip.name,
      label: chip.label,
      value: chip.ratio,
      done: deriveDone(chip.label, chip.color),
      visible: chip.visible,
      tooltip: chip.tooltip,
    })
  );
}

// ============================================================
// Culture-side adapter
// ============================================================

/**
 * Returns up to 7 completion pills for a culture question.
 *
 * - **Exam question** (`news_item_id === null`): emits `lang-el`, `lang-en`,
 *   `lang-ru`, `opts`, `audio`, `news` (no `audio-a2`).
 * - **News question** (`news_item_id !== null`): emits `lang-el`, `lang-en`,
 *   `lang-ru`, `opts`, `audio-b2`, `audio-a2`, `news`.
 *
 * Defensive contract: any `audio-a2` chip is forced to `visible: false` when
 * `question.news_item_id === null`, regardless of upstream drift.
 */
export function getCultureCompletion(question: AdminCultureQuestion): DeckPill[] {
  const chips: CultureChipData[] = computeCultureChips(question);
  return chips.map((chip): DeckPill => {
    const isHiddenAudioA2 = chip.name === 'audio-a2' && question.news_item_id === null;

    return {
      name: chip.name,
      label: chip.label,
      // Culture chips don't carry a numeric ratio
      value: undefined,
      done: deriveDone(chip.label, chip.color),
      visible: isHiddenAudioA2 ? false : chip.visible,
      tooltip: chip.tooltip || undefined,
    };
  });
}
