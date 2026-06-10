/**
 * WordDetailScreen — /decks/[deckId]/[wordId] (MOB-12, design_handoff_word).
 *
 * A pushed root-stack route (no tab bar). Blocks:
 *   1. Hero — primary-tinted gradient, back button, report button, POS + gender
 *      badges, article + lemma (Inter Tight 44px), optional speaker button,
 *      IPA, translation.
 *   2. Sticky two-tab switcher — "Word info" | "Cards (mastered/total)".
 *   3. Word info panel — declension table (nouns), examples, optional note.
 *   4. Cards panel — mastery bar + card groups (Translation/Grammar/Declension)
 *      each with 2-up mini flip cards.
 *
 * Report error sheet is a linked future flow (MOB coming-soon).
 * Card flip is local state — no navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Volume2, Flag } from 'lucide-react-native';
import { useAudioPlayer } from 'expo-audio';

import { useWordEntry, useWordCards, useWordMasteryItem } from '@/hooks/use-word-detail';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';
import {
  GENDER_FG,
  GENDER_LABEL,
  MASTERY_DOT_COLOR,
  CARD_TYPE_GROUP,
  CARD_GROUP_ORDER,
  deriveCardMasteryStatus,
  extractDeclension,
} from '@/lib/words/presentation';
import type { CardRecordResponse, CardMasteryStatus } from '@/types/word';

// ---------------------------------------------------------------------------
// Colour constants (MOB-13: explicit rgba — no /NN modifiers on var-backed tokens)
// ---------------------------------------------------------------------------

// Note callout: fixed warm yellow (both themes)
const NOTE_BG    = 'rgba(253,224,171,0.5)';  // hsl(45 80% 90% / 50%)
const NOTE_BORDER = 'rgba(202,158,69,0.4)';  // hsl(45 60% 70% / 40%)
const NOTE_LABEL  = 'rgb(133,94,18)';         // hsl(38 70% 38%)
const NOTE_TEXT   = 'rgb(57,38,8)';           // hsl(40 30% 28%)

// fg-3 for icons (light theme -- used in lucide color prop)
const ICON_FG3 = 'rgb(127,136,159)';

// ---------------------------------------------------------------------------
// Mini flip card
// ---------------------------------------------------------------------------

interface MiniCardProps {
  card: CardRecordResponse;
  mastery: CardMasteryStatus;
  testID?: string;
}

function MiniCard({ card, mastery, testID }: MiniCardProps) {
  const [flipped, setFlipped] = useState(false);

  const frontText =
    typeof card.front_content['text'] === 'string'
      ? card.front_content['text']
      : typeof card.front_content['word'] === 'string'
        ? card.front_content['word']
        : String(Object.values(card.front_content)[0] ?? '');

  const backText =
    typeof card.back_content['text'] === 'string'
      ? card.back_content['text']
      : typeof card.back_content['word'] === 'string'
        ? card.back_content['word']
        : String(Object.values(card.back_content)[0] ?? '');

  const promptText =
    card.card_type === 'meaning_el_to_en' ? 'What does this mean?' :
    card.card_type === 'meaning_en_to_el' ? 'Say this in Greek' :
    card.card_type === 'article' ? 'What is the article?' :
    card.card_type === 'plural_form' ? 'What is the plural form?' :
    card.card_type === 'declension' ? 'Decline this form' :
    card.card_type === 'conjugation' ? 'Conjugate this verb' :
    card.card_type === 'cloze' ? 'Fill in the blank' :
    'Translate this sentence';

  // Greek text should use Noto Serif — check if front/back is Greek script
  const isGreek = (s: string) => /[Ͱ-Ͽἀ-῿]/.test(s);
  const displayText = flipped ? backText : frontText;
  const displayIsGreek = isGreek(displayText);

  return (
    <Pressable
      testID={testID ?? `mini-card-${card.id}`}
      accessibilityRole="button"
      accessibilityLabel={flipped ? 'Card answer — tap to flip back' : 'Card front — tap to see answer'}
      onPress={() => setFlipped((f) => !f)}
      className="active:opacity-70"
      style={{ flex: 1 }}
    >
      <View
        className="bg-card border border-line rounded-xl p-3"
        style={{ height: 132 }}
      >
        {/* Prompt */}
        <Text
          className="text-fg3 text-[9px] font-semibold tracking-[0.08em] uppercase text-center mb-1"
          numberOfLines={1}
        >
          {promptText}
        </Text>

        {/* Front / back content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            className="text-fg text-[16px] font-bold text-center leading-snug"
            style={displayIsGreek ? { fontFamily: 'NotoSerif_400Regular' } : { fontFamily: 'InterTight_700Bold' }}
            numberOfLines={3}
          >
            {displayText}
          </Text>
        </View>

        {/* Footer: tap hint + mastery dot */}
        <View className="flex-row items-center justify-between">
          <Text className="text-fg3 text-[9px] font-semibold">
            {flipped ? 'Tap to flip' : 'Tap to flip'}
          </Text>
          {/* Mastery dot */}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: MASTERY_DOT_COLOR[mastery],
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card group
// ---------------------------------------------------------------------------

interface CardGroupProps {
  label: string;
  cards: CardRecordResponse[];
  masteryMap: Map<string, CardMasteryStatus>;
}

function CardGroup({ label, cards, masteryMap }: CardGroupProps) {
  const masteredCount = cards.filter((c) => masteryMap.get(c.id) === 'mastered').length;

  return (
    <View className="bg-card border border-line rounded-2xl overflow-hidden">
      {/* Header */}
      <View className="px-3.5 py-3 flex-row items-center justify-between border-b border-line">
        <Text
          className="text-fg2 text-[10px] font-extrabold tracking-[0.14em] uppercase"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {label}
        </Text>
        <Text
          className="text-fg3 text-[11px] font-semibold"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {masteredCount} of {cards.length} mastered
        </Text>
      </View>

      {/* 2-up grid of mini cards */}
      <View className="p-3" style={{ gap: 10 }}>
        {/* Render rows of 2 */}
        {Array.from({ length: Math.ceil(cards.length / 2) }, (_, rowIdx) => {
          const left = cards[rowIdx * 2];
          const right = cards[rowIdx * 2 + 1];
          return (
            <View key={rowIdx} className="flex-row" style={{ gap: 10 }}>
              <MiniCard
                card={left}
                mastery={masteryMap.get(left.id) ?? 'new'}
                testID={`mini-card-${left.id}`}
              />
              {right ? (
                <MiniCard
                  card={right}
                  mastery={masteryMap.get(right.id) ?? 'new'}
                  testID={`mini-card-${right.id}`}
                />
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WordDetailScreen() {
  const { deckId, wordId } = useLocalSearchParams<{ deckId: string; wordId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showComingSoonToast } = useToast();

  const wordQuery = useWordEntry(wordId);
  const cardsQuery = useWordCards(wordId);
  const masteryItem = useWordMasteryItem(deckId, wordId);

  const word = wordQuery.data;
  const cards = cardsQuery.data ?? [];

  // Audio playback
  const player = useAudioPlayer(word?.audio_url ?? '');
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeaker = useCallback(() => {
    if (!word?.audio_url || word.audio_status !== 'ready') return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      void player.play();
      setIsPlaying(true);
    }
  }, [word, isPlaying, player]);

  // Active tab: 'info' | 'cards'
  const [activeTab, setActiveTab] = useState<'info' | 'cards'>('info');

  // Analytics: word_detail_viewed once per mount
  const viewedFired = useRef(false);
  useEffect(() => {
    if (word && !viewedFired.current) {
      viewedFired.current = true;
      track('word_detail_viewed', {
        word_id: word.id,
        deck_id: deckId,
        part_of_speech: word.part_of_speech,
      });
    }
  }, [word, deckId]);

  // ── Error state ──
  if (wordQuery.isError && !wordQuery.isLoading) {
    return (
      <View
        testID="word-detail-error"
        className="flex-1 bg-bg items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load this word.
        </Text>
        <Pressable
          testID="word-detail-retry"
          onPress={() => wordQuery.refetch()}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
        <Pressable
          testID="word-detail-error-back"
          onPress={() => router.back()}
          className="mt-3 px-6 py-3 active:opacity-70"
        >
          <Text className="text-fg3 text-[14px]">Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Loading state ──
  if (!word) {
    return (
      <View testID="word-detail-loading" className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // ── Derived data ──
  const gender = typeof word.grammar_data?.['gender'] === 'string'
    ? word.grammar_data['gender']
    : null;
  const genderFg = gender ? (GENDER_FG[gender] ?? null) : null;
  const genderLabel = gender ? (GENDER_LABEL[gender] ?? null) : null;
  const article = gender === 'masculine' ? 'ο' : gender === 'feminine' ? 'η' : gender === 'neuter' ? 'το' : null;

  const declensionRows = extractDeclension(word.grammar_data);

  // Cards tab: mastery map + grouped cards
  const masteryMap = new Map<string, CardMasteryStatus>(
    cards.map((c) => [c.id, deriveCardMasteryStatus(c.card_type, masteryItem)]),
  );
  const masteredCardCount = [...masteryMap.values()].filter((v) => v === 'mastered').length;
  const totalCardCount = cards.length;

  // Group cards by display group
  const groupedCards = new Map<string, CardRecordResponse[]>();
  for (const c of cards) {
    const group = CARD_TYPE_GROUP[c.card_type] ?? 'Other';
    const existing = groupedCards.get(group) ?? [];
    existing.push(c);
    groupedCards.set(group, existing);
  }

  const hasAudio = !!word.audio_url && word.audio_status === 'ready';

  return (
    <View testID="word-detail-screen" className="flex-1 bg-bg">
      {/* ── Hero ── */}
      <View
        testID="word-detail-hero"
        className="border-b border-line"
        style={{
          paddingTop: insets.top,
        }}
      >
        {/* Primary gradient wash using inline style (LinearGradient not needed for alpha wash) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Start: primary-14, End: primary-04
            backgroundColor: 'rgba(36,99,235,0.07)',
          }}
        />

        {/* Watermark glyph */}
        <Text
          aria-hidden
          style={{
            position: 'absolute',
            top: insets.top + 20,
            right: -10,
            fontFamily: 'NotoSerif_400Regular',
            fontSize: 200,
            lineHeight: 200,
            color: 'rgba(36,99,235,0.06)',
            fontWeight: '700',
            letterSpacing: -8,
          }}
        >
          {word.lemma[0]}
        </Text>

        {/* Nav row: back + report */}
        <View className="flex-row items-center justify-between px-[18px] pt-3 pb-0">
          <Pressable
            testID="word-detail-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="flex-row items-center gap-1 py-2 pr-2 active:opacity-70"
          >
            <ChevronLeft size={16} color={ICON_FG3} strokeWidth={2.2} />
            <Text className="text-fg2 text-[13px] font-semibold">Back</Text>
          </Pressable>
          <Pressable
            testID="word-detail-report"
            accessibilityRole="button"
            accessibilityLabel="Report an error"
            onPress={() => {
              track('word_report_tapped', { word_id: word.id });
              showComingSoonToast();
            }}
            className="w-9 h-9 rounded-full bg-card border border-line items-center justify-center active:opacity-70"
            style={{ opacity: 0.8 }}
          >
            <Flag size={14} color={ICON_FG3} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Content */}
        <View className="px-[22px] pt-[14px] pb-[22px]">
          {/* Badges row: POS + gender */}
          <View className="flex-row gap-1.5 mb-3.5">
            {/* POS badge */}
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'rgba(36,99,235,0.10)' }}
            >
              <Text
                className="text-primary text-[10px] font-bold tracking-[0.08em] uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
              >
                {word.part_of_speech}
              </Text>
            </View>

            {/* Gender badge */}
            {genderFg && genderLabel ? (
              <View
                className="rounded-full px-2.5 py-1"
                style={{
                  backgroundColor:
                    gender === 'masculine' ? 'rgba(31,104,190,0.12)' :
                    gender === 'feminine'  ? 'rgba(181,38,101,0.12)' :
                    'rgba(37,177,130,0.14)',
                }}
              >
                <Text
                  className="text-[10px] font-bold tracking-[0.08em] uppercase"
                  style={{ fontFamily: 'SpaceMono_400Regular', color: genderFg }}
                >
                  {genderLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Article + lemma row + speaker */}
          <View className="flex-row items-flex-end gap-2.5 mb-1">
            <View className="flex-row items-baseline gap-2 flex-1">
              {article ? (
                <Text
                  testID="word-detail-article"
                  className="text-fg3 text-[32px] leading-none tracking-tight"
                  style={{ fontFamily: 'InterTight_700Bold' }}
                >
                  {article}
                </Text>
              ) : null}
              <Text
                testID="word-detail-lemma"
                className="text-fg text-[44px] leading-none tracking-tight font-bold flex-shrink"
                style={{ fontFamily: 'InterTight_700Bold' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {word.lemma}
              </Text>
            </View>

            {/* Speaker button — shown if audio is ready */}
            {hasAudio ? (
              <Pressable
                testID="word-detail-speaker"
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause audio' : 'Play pronunciation'}
                onPress={handleSpeaker}
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70 self-end mb-1"
                style={{
                  backgroundColor: 'rgba(36,99,235,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(36,99,235,0.20)',
                }}
              >
                <Volume2 size={16} color="rgb(36,99,235)" strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          {/* IPA */}
          {word.pronunciation ? (
            <Text
              testID="word-detail-ipa"
              className="text-fg3 text-[13px] mb-3"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {word.pronunciation}
            </Text>
          ) : null}

          {/* Translation */}
          <Text
            testID="word-detail-translation"
            className="text-fg text-[17px] font-semibold"
            style={{ letterSpacing: -0.2 }}
          >
            {word.translation_en}
          </Text>
        </View>
      </View>

      {/* ── Tab switcher ── */}
      <View className="flex-row bg-card border-b border-line">
        {(['info', 'cards'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'info' ? 'Word info' : 'Cards';
          const pill = tab === 'cards' && totalCardCount > 0
            ? `${masteredCardCount}/${totalCardCount}`
            : null;
          return (
            <Pressable
              key={tab}
              testID={`word-tab-${tab}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveTab(tab)}
              className="flex-1 flex-row items-center justify-center gap-2 active:opacity-70"
              style={{ paddingVertical: 14, paddingBottom: 13 }}
            >
              <Text
                className="text-[14px] font-semibold"
                style={{ color: isActive ? 'rgb(36,99,235)' : undefined }}
              >
                {label}
              </Text>
              {pill ? (
                <View
                  className="rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: isActive ? 'rgba(36,99,235,0.12)' : undefined,
                  }}
                >
                  <Text
                    className={isActive ? 'text-primary' : 'text-fg3'}
                    style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 11, fontWeight: '700' }}
                  >
                    {pill}
                  </Text>
                </View>
              ) : null}
              {/* Active underline */}
              {isActive ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    backgroundColor: 'rgb(36,99,235)',
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* ── Tab body ── */}
      <ScrollView
        testID={activeTab === 'info' ? 'word-info-panel' : 'word-cards-panel'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 40 + insets.bottom, gap: 16 }}
      >
        {activeTab === 'info' ? (
          <>
            {/* Declension table */}
            {declensionRows ? (
              <View className="bg-card border border-line rounded-2xl overflow-hidden">
                {/* Section heading */}
                <Text
                  className="text-fg3 text-[11px] font-bold tracking-[0.12em] uppercase px-4 pt-3.5 pb-2.5"
                  style={{ fontFamily: 'SpaceMono_400Regular' }}
                >
                  Declension
                </Text>
                {/* Column headers */}
                <View className="flex-row border-b border-line">
                  <View
                    className="border-r border-line bg-bg-2 px-3 py-2.5"
                    style={{ width: 112 }}
                  >
                    <Text
                      className="text-fg3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{ fontFamily: 'SpaceMono_400Regular' }}
                    >
                      Case
                    </Text>
                  </View>
                  <View className="flex-1 border-r border-line bg-bg-2 px-3 py-2.5">
                    <Text
                      className="text-fg3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{ fontFamily: 'SpaceMono_400Regular' }}
                    >
                      Singular
                    </Text>
                  </View>
                  <View className="flex-1 bg-bg-2 px-3 py-2.5">
                    <Text
                      className="text-fg3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{ fontFamily: 'SpaceMono_400Regular' }}
                    >
                      Plural
                    </Text>
                  </View>
                </View>
                {/* Case rows */}
                {declensionRows.map((row, i) => {
                  const isLast = i === declensionRows.length - 1;
                  return (
                    <View
                      key={row.caseName}
                      className={`flex-row${!isLast ? ' border-b border-line' : ''}`}
                    >
                      <View
                        className="border-r border-line px-3 py-3 bg-bg-2"
                        style={{ width: 112 }}
                      >
                        <Text
                          testID={`declension-case-${row.caseName.toLowerCase()}`}
                          className="text-fg2 text-[11px] font-bold tracking-[0.06em] uppercase"
                          style={{ fontFamily: 'SpaceMono_400Regular' }}
                        >
                          {row.caseName}
                        </Text>
                      </View>
                      <View className="flex-1 border-r border-line px-3 py-3">
                        <Text
                          className="text-fg text-[15px] font-medium"
                          style={{ fontFamily: 'NotoSerif_400Regular' }}
                        >
                          {row.singular}
                        </Text>
                      </View>
                      <View className="flex-1 px-3 py-3">
                        <Text
                          className="text-fg text-[15px] font-medium"
                          style={{ fontFamily: 'NotoSerif_400Regular' }}
                        >
                          {row.plural}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Examples */}
            {word.examples && word.examples.length > 0 ? (
              <View>
                <Text
                  className="text-fg3 text-[11px] font-bold tracking-[0.12em] uppercase mb-3"
                  style={{ fontFamily: 'SpaceMono_400Regular' }}
                >
                  Examples
                </Text>
                <View style={{ gap: 10 }}>
                  {word.examples.map((ex, i) => (
                    <View
                      key={ex.id ?? i}
                      testID={`example-${i}`}
                      className="bg-bg-2 rounded-xl px-4 py-3.5"
                    >
                      {/* (No example tag field in the backend — omit tag chip) */}
                      <View className="flex-row items-start gap-2.5">
                        <Text
                          className="text-fg text-[15px] font-semibold leading-snug flex-1"
                          style={{ fontFamily: 'NotoSerif_400Regular', lineHeight: 22 }}
                        >
                          {ex.greek}
                        </Text>
                        {/* Example speaker (coming-soon: audio per example) */}
                        {ex.audio_url && ex.audio_status === 'ready' ? (
                          <ExampleSpeaker audioUrl={ex.audio_url} />
                        ) : null}
                      </View>
                      <Text
                        className="text-fg2 text-[13px] mt-1"
                        style={{ lineHeight: 18 }}
                      >
                        {ex.english}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Note (optional — stored in grammar_data.note if present) */}
            {typeof word.grammar_data?.['note'] === 'string' ? (
              <View
                testID="word-detail-note"
                className="rounded-xl px-4 py-3.5"
                style={{
                  backgroundColor: NOTE_BG,
                  borderWidth: 1,
                  borderColor: NOTE_BORDER,
                }}
              >
                <Text
                  className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5"
                  style={{ fontFamily: 'SpaceMono_400Regular', color: NOTE_LABEL }}
                >
                  Note
                </Text>
                <Text
                  className="text-[13px] leading-[19px]"
                  style={{ color: NOTE_TEXT }}
                >
                  {word.grammar_data['note'] as string}
                </Text>
              </View>
            ) : null}

            {/* Empty state if nothing to show */}
            {!declensionRows && (!word.examples || word.examples.length === 0) ? (
              <View testID="word-info-empty" className="items-center py-8">
                <Text className="text-fg3 text-[14px]">No additional information yet.</Text>
              </View>
            ) : null}
          </>
        ) : (
          /* Cards panel */
          <>
            {cardsQuery.isLoading ? (
              <View testID="word-cards-loading" className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : cardsQuery.isError ? (
              <View testID="word-cards-error" className="items-center py-6">
                <Text className="text-fg2 text-[13px] mb-3">Couldn&apos;t load the cards.</Text>
                <Pressable
                  testID="word-cards-retry"
                  onPress={() => cardsQuery.refetch()}
                  className="active:opacity-70"
                >
                  <Text className="text-primary text-[13px] font-semibold">Retry</Text>
                </Pressable>
              </View>
            ) : totalCardCount === 0 ? (
              <View testID="word-cards-empty" className="items-center py-8">
                <Text className="text-fg3 text-[14px]">No study cards yet.</Text>
              </View>
            ) : (
              <>
                {/* Mastery bar */}
                <View testID="word-cards-mastery-bar">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-fg2 text-[12px] font-semibold">
                      {masteredCardCount} of {totalCardCount} mastered
                    </Text>
                    <Text
                      className="text-[11px] font-semibold"
                      style={{
                        fontFamily: 'SpaceMono_400Regular',
                        color: 'rgb(37,177,130)',
                      }}
                    >
                      {totalCardCount > 0
                        ? `${Math.round((masteredCardCount / totalCardCount) * 100)}%`
                        : '0%'}
                    </Text>
                  </View>
                  <View className="h-[3px] rounded-sm bg-bg-2 overflow-hidden">
                    <View
                      style={{
                        height: '100%',
                        width: `${totalCardCount > 0 ? (masteredCardCount / totalCardCount) * 100 : 0}%`,
                        backgroundColor: 'rgb(37,177,130)',
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>

                {/* Card groups */}
                {CARD_GROUP_ORDER.map((groupName) => {
                  const groupCards = groupedCards.get(groupName);
                  if (!groupCards || groupCards.length === 0) return null;
                  return (
                    <CardGroup
                      key={groupName}
                      label={groupName}
                      cards={groupCards}
                      masteryMap={masteryMap}
                    />
                  );
                })}

                {/* Any overflow groups not in the canonical order */}
                {[...groupedCards.entries()]
                  .filter(([name]) => !(CARD_GROUP_ORDER as readonly string[]).includes(name))
                  .map(([name, groupCards]) => (
                    <CardGroup
                      key={name}
                      label={name}
                      cards={groupCards}
                      masteryMap={masteryMap}
                    />
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Example sentence speaker button (self-contained — avoids prop drilling)
// ---------------------------------------------------------------------------

function ExampleSpeaker({ audioUrl }: { audioUrl: string }) {
  const player = useAudioPlayer(audioUrl);
  const [playing, setPlaying] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play example sentence audio"
      onPress={() => {
        if (playing) {
          player.pause();
          setPlaying(false);
        } else {
          void player.play();
          setPlaying(true);
        }
      }}
      className="items-center justify-center rounded-full active:opacity-70 flex-shrink-0"
      style={{
        width: 28,
        height: 28,
        backgroundColor: 'rgba(36,99,235,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(36,99,235,0.20)',
      }}
    >
      <Volume2 size={13} color="rgb(36,99,235)" strokeWidth={2} />
    </Pressable>
  );
}
