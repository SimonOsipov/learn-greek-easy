/**
 * NewUserStart — "Three ways to start" chooser block shown to new users.
 *
 * Pure presentational component (no hooks, no useDashboard). The parent
 * screen (DASH-09) renders this only when `isNewUser` is true
 * (mastered === 0 && streak === 0). The gating logic lives in the parent.
 *
 * Three numbered rows — each is a Pressable that calls its respective handler:
 *   - onPickDeck       → Row 1: First Greek words
 *   - onReadArticle    → Row 2: Read your first article
 *   - onTryConversation → Row 3: Try a real conversation
 *
 * MOB-13 SAFE: the number tiles use solid bg-primary / bg-accent / bg-accent-2
 * (no /NN opacity modifier on any var-backed token). No progress band, stat grid,
 * or streak surfaces appear in this component.
 *
 * Design reference: Dashboard Mock.html › HomeNewUser / "Three ways to start".
 */
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewUserStartProps {
  /** Called when the user taps row 1 — "First Greek words" (A1 deck). */
  onPickDeck: () => void;
  /** Called when the user taps row 2 — "Read your first article" (B2). */
  onReadArticle: () => void;
  /** Called when the user taps row 3 — "Try a real conversation" (café A2). */
  onTryConversation: () => void;
}

// ---------------------------------------------------------------------------
// Row data — verbatim handoff copy. Do NOT paraphrase.
// ---------------------------------------------------------------------------

const ROWS = [
  {
    id: 'pick-deck',
    number: 1,
    title: 'First Greek words',
    sub: '20 cards · 15 min · A1',
    meta: 'Greetings, family, food.',
    numBg: 'bg-primary',
  },
  {
    id: 'read-article',
    number: 2,
    title: 'Read your first article',
    sub: '1 min audio · B2',
    meta: 'Listen along, tap for translation.',
    numBg: 'bg-accent',
  },
  {
    id: 'try-conversation',
    number: 3,
    title: 'Try a real conversation',
    sub: 'Coffee shop · A2',
    meta: 'Practice what you’d say at a καφενείο.',
    numBg: 'bg-accent-2',
  },
] as const;

// ---------------------------------------------------------------------------
// NewUserStart
// ---------------------------------------------------------------------------

export function NewUserStart({
  onPickDeck,
  onReadArticle,
  onTryConversation,
}: NewUserStartProps) {
  const handlers = [onPickDeck, onReadArticle, onTryConversation];

  return (
    <View testID="new-user-start" className="px-[18px] pt-1.5 pb-6 gap-4">
      {/* ── Header ── */}
      <View className="gap-1">
        <Text
          testID="new-user-start-heading"
          className="text-fg text-[22px] font-bold tracking-tight leading-tight"
          style={{ fontFamily: 'InterTight_700Bold' }}
        >
          Three ways to start
        </Text>
        <Text
          testID="new-user-start-lede"
          className="text-fg2 text-[13px] leading-snug"
        >
          Pick one. Most people start with the first deck.
        </Text>
      </View>

      {/* ── Rows ── */}
      <View className="gap-2.5">
        {ROWS.map((row, idx) => (
          <Pressable
            key={row.id}
            testID={`new-user-row-${row.id}`}
            onPress={handlers[idx]}
            className="flex-row items-center gap-3.5 px-4 py-3.5 rounded-[16px] bg-bg-2 border border-line"
          >
            {/* Number tile: 40×40, rounded, weight 800 */}
            <View
              testID={`new-user-row-num-${row.id}`}
              className={`w-10 h-10 rounded-[12px] items-center justify-center flex-shrink-0 ${row.numBg}`}
            >
              <Text
                className="text-[17px] leading-none text-on-photo"
                style={{ fontFamily: 'InterTight_700Bold', fontWeight: '800' }}
                aria-hidden
              >
                {row.number}
              </Text>
            </View>

            {/* Middle column */}
            <View className="flex-1 min-w-0 gap-0.5">
              <Text
                testID={`new-user-row-title-${row.id}`}
                className="text-fg text-[15px] font-bold leading-tight tracking-tight"
                style={{ fontFamily: 'InterTight_700Bold' }}
                numberOfLines={1}
              >
                {row.title}
              </Text>
              <Text
                testID={`new-user-row-sub-${row.id}`}
                className="text-fg3 text-[11.5px] uppercase tracking-[0.04em]"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
                numberOfLines={1}
              >
                {row.sub}
              </Text>
              <Text
                testID={`new-user-row-meta-${row.id}`}
                className="text-fg2 text-[13px] leading-snug"
                numberOfLines={2}
              >
                {row.meta}
              </Text>
            </View>

            {/* Trailing chevron */}
            <View className="flex-shrink-0" style={{ width: 18, height: 18 }}>
              <ChevronRight
                size={18}
                className="text-fg3"
                aria-hidden
              />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
