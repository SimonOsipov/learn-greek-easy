/// <reference types="jest" />
/**
 * DASH-07 — RNTL component tests for the stat grid, shelves, and cards.
 *
 * Tests:
 *   StatGrid
 *     1. Formats study time from seconds using formatStudyTime (not minutes-based).
 *     2. Renders all four stat tiles.
 *
 *   NewsCard
 *     3. Renders with no level pill.
 *     4. Shows date + title_el + title_en; pressing calls onPress with the item id.
 *
 *   SituationCard
 *     5. Subline shows "N exercises" only — no domain, no level.
 *     6. Pressing calls onPress with the item id.
 *
 *   Shelf
 *     7. Renders the kicker label, title, and FlatList.
 *     8. Live shelf card press calls its nav handler (no toast).
 *
 *   QuickWinsShelf
 *     9. Shows the red-dot eyebrow (ComingSoonDot).
 *    10. A card press fires the toast and does NOT navigate.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';

// ---------------------------------------------------------------------------
// Mocks — must precede imports of the subjects.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// expo-router — capture router.push calls to verify QuickWinsShelf does NOT navigate.
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// expo-linear-gradient — wrap children in a plain View.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => ce(View, { testID }, children),
  };
});

// lucide-react-native — stub icons to plain Views.
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = ({ testID }: { testID?: string } = {}) =>
    ce(View, { testID: testID ?? 'icon-stub' });
  return {
    Flame: stub,
    Check: stub,
    Clock: stub,
    Trophy: stub,
    ChevronRight: stub,
    Play: stub,
    Sparkles: stub,
    Zap: stub,
  };
});

// ToastProvider / useToast — controlled mock.
const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks.
// ---------------------------------------------------------------------------
import { StatGrid } from '@/components/dashboard/stat-grid';
import { NewsCard } from '@/components/dashboard/news-card';
import { SituationCard } from '@/components/dashboard/situation-card';
import { Shelf } from '@/components/dashboard/shelf';
import { QuickWinsShelf } from '@/components/dashboard/quick-wins-shelf';
import type { NewsItem } from '@/types/news';
import type { SituationItem } from '@/types/situation';
import type { DeckWithProgress } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_NEWS_ITEM: NewsItem = {
  id: 'news-01',
  title_el: 'Καταδίκη επίθεσης κτηνοτρόφου',
  title_en: 'Cyprus vets condemn farmer attack',
  title_ru: '',
  publication_date: '2026-05-08T10:00:00Z',
  image_url: 'https://example.com/photo.jpg',
  audio_url: 'https://example.com/audio.mp3',
  audio_duration_seconds: 74,
};

const MOCK_SITUATION: SituationItem = {
  id: 'supreme-court',
  scenario_el: 'Το Ανώτατο Δικαστήριο απέρριψε',
  scenario_en: 'The Supreme Court rejected the appeal',
  has_audio: true,
  has_dialog: false,
  exercise_total: 4,
  exercise_completed: 0,
  source_image_url: null,
};

// ---------------------------------------------------------------------------
// 1–2. StatGrid
// ---------------------------------------------------------------------------

describe('StatGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats study time from seconds using formatStudyTime', () => {
    // 3660 seconds = 1h 1m (per the web timeFormatUtils port)
    render(
      <StatGrid
        currentStreak={6}
        masteredCards={142}
        studyTimeSeconds={3660}
        cardsDueToday={130}
      />,
    );
    // The time tile should show the formatted value, not the raw seconds
    const timeTile = screen.getByTestId('stat-tile-time');
    // Find the value text within the tile — it should contain "1h 1m"
    expect(timeTile).toBeTruthy();
    // The formatted text should appear somewhere in the rendered tree
    expect(screen.getByText('1h 1m')).toBeTruthy();
  });

  it('renders 0m for zero seconds', () => {
    render(
      <StatGrid
        currentStreak={0}
        masteredCards={0}
        studyTimeSeconds={0}
        cardsDueToday={0}
      />,
    );
    expect(screen.getByText('0m')).toBeTruthy();
  });

  it('renders all four stat tiles', () => {
    render(
      <StatGrid
        currentStreak={6}
        masteredCards={142}
        studyTimeSeconds={720}
        cardsDueToday={130}
      />,
    );
    expect(screen.getByTestId('stat-tile-streak')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-mastered')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-time')).toBeTruthy();
    expect(screen.getByTestId('stat-tile-due')).toBeTruthy();
  });

  it('formats 3600 seconds as "1h" (drops minutes when 0)', () => {
    render(
      <StatGrid
        currentStreak={1}
        masteredCards={10}
        studyTimeSeconds={3600}
        cardsDueToday={5}
      />,
    );
    expect(screen.getByText('1h')).toBeTruthy();
  });

  it('formats 86400 seconds as "1d" (drops hours when 0)', () => {
    render(
      <StatGrid
        currentStreak={1}
        masteredCards={10}
        studyTimeSeconds={86400}
        cardsDueToday={5}
      />,
    );
    expect(screen.getByText('1d')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3–4. NewsCard
// ---------------------------------------------------------------------------

describe('NewsCard', () => {
  it('renders with NO level pill', () => {
    const onPress = jest.fn();
    render(<NewsCard item={MOCK_NEWS_ITEM} onPress={onPress} />);
    // No element with testID "news-card-level" should exist
    expect(screen.queryByTestId('news-card-level')).toBeNull();
    // There should be no text matching "B1", "B2", "A1", "A2" that looks like a level badge
    // (asserting the title_el IS present confirms the card rendered)
    expect(screen.getByTestId('news-card-title-el')).toBeTruthy();
  });

  it('renders Greek headline and English subhead', () => {
    const onPress = jest.fn();
    render(<NewsCard item={MOCK_NEWS_ITEM} onPress={onPress} />);
    expect(screen.getByTestId('news-card-title-el').props.children).toBe(
      MOCK_NEWS_ITEM.title_el,
    );
    expect(screen.getByTestId('news-card-title-en').props.children).toBe(
      MOCK_NEWS_ITEM.title_en,
    );
  });

  it('calls onPress with the item id when pressed', () => {
    const onPress = jest.fn();
    render(<NewsCard item={MOCK_NEWS_ITEM} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('news-card-news-01'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('news-01');
  });

  it('shows the date pill', () => {
    const onPress = jest.fn();
    render(<NewsCard item={MOCK_NEWS_ITEM} onPress={onPress} />);
    expect(screen.getByTestId('news-card-date-pill')).toBeTruthy();
  });

  it('shows the audio pill when audio_duration_seconds is present', () => {
    const onPress = jest.fn();
    render(<NewsCard item={MOCK_NEWS_ITEM} onPress={onPress} />);
    expect(screen.getByTestId('news-card-audio-pill')).toBeTruthy();
  });

  it('hides the audio pill when audio_duration_seconds is null', () => {
    const onPress = jest.fn();
    render(
      <NewsCard
        item={{ ...MOCK_NEWS_ITEM, audio_duration_seconds: null }}
        onPress={onPress}
      />,
    );
    expect(screen.queryByTestId('news-card-audio-pill')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5–6. SituationCard
// ---------------------------------------------------------------------------

describe('SituationCard', () => {
  it('subline shows "N exercises" ONLY — no domain, no level text', () => {
    const onPress = jest.fn();
    render(<SituationCard item={MOCK_SITUATION} onPress={onPress} />);
    const subline = screen.getByTestId('situation-card-subline');
    // children may be a string or a React expression array [number, string] — normalise with join
    const rawChildren = subline.props.children;
    const text: string = Array.isArray(rawChildren)
      ? rawChildren.join('')
      : String(rawChildren ?? '');
    expect(text).toBe('4 exercises');
    // Must NOT contain domain, level, or any separator between them
    expect(text).not.toMatch(/·/); // no separator
    expect(text).not.toMatch(/B1|B2|A1|A2/); // no level
    expect(text).not.toMatch(/Law|Government|Business|Tourism/); // no domain
  });

  it('renders the Greek scenario title', () => {
    const onPress = jest.fn();
    render(<SituationCard item={MOCK_SITUATION} onPress={onPress} />);
    expect(screen.getByTestId('situation-card-title').props.children).toBe(
      MOCK_SITUATION.scenario_el,
    );
  });

  it('calls onPress with the item id when pressed', () => {
    const onPress = jest.fn();
    render(<SituationCard item={MOCK_SITUATION} onPress={onPress} />);
    fireEvent.press(screen.getByTestId(`situation-card-${MOCK_SITUATION.id}`));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(MOCK_SITUATION.id);
  });
});

// ---------------------------------------------------------------------------
// 7–8. Shelf wrapper
// ---------------------------------------------------------------------------

describe('Shelf', () => {
  const SAMPLE_DATA = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
  ];

  it('renders the kicker label, title, and FlatList', () => {
    const onPress = jest.fn();
    render(
      <Shelf
        kicker="NEWS"
        title="Today's news"
        subtitle="With audio at your level"
        seeAllLabel="All news"
        onSeeAll={onPress}
        data={SAMPLE_DATA}
        renderItem={({ item }) => (
          <View testID={`item-${item.id}`}>
            <View />
          </View>
        )}
        keyExtractor={(item) => item.id}
        cardWidth={260}
      />,
    );
    expect(screen.getByTestId('shelf')).toBeTruthy();
    expect(screen.getByTestId('shelf-title').props.children).toBe("Today's news");
    expect(screen.getByTestId('shelf-subtitle').props.children).toBe(
      'With audio at your level',
    );
    // Kicker label is rendered via Kicker component — check via kicker-label testID
    expect(screen.getByTestId('kicker-label').props.children).toBe('NEWS');
  });

  it('calls onSeeAll when the "see all" link is pressed', () => {
    const onSeeAll = jest.fn();
    render(
      <Shelf
        kicker="NEWS"
        title="Test"
        seeAllLabel="All news"
        onSeeAll={onSeeAll}
        data={SAMPLE_DATA}
        renderItem={({ item }) => <View testID={`item-${item.id}`} />}
        keyExtractor={(item) => item.id}
        cardWidth={260}
      />,
    );
    fireEvent.press(screen.getByTestId('shelf-see-all'));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('does not render "see all" when seeAllLabel is omitted', () => {
    render(
      <Shelf
        kicker="NEWS"
        title="Test"
        data={SAMPLE_DATA}
        renderItem={({ item }) => <View testID={`item-${item.id}`} />}
        keyExtractor={(item) => item.id}
        cardWidth={260}
      />,
    );
    expect(screen.queryByTestId('shelf-see-all')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9–10. QuickWinsShelf
// ---------------------------------------------------------------------------

describe('QuickWinsShelf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockReset();
  });

  it('shows the ComingSoonDot (red-dot eyebrow)', () => {
    const { UNSAFE_getByProps } = render(<QuickWinsShelf />);
    // ComingSoonDot has testID="coming-soon-dot" but accessibilityElementsHidden=true;
    // use UNSAFE_getByProps to locate it in the React tree directly.
    expect(UNSAFE_getByProps({ testID: 'coming-soon-dot' })).toBeTruthy();
  });

  it('shows the "Coming soon" kicker label', () => {
    render(<QuickWinsShelf />);
    expect(screen.getByTestId('kicker-coming-soon-label')).toBeTruthy();
  });

  it('pressing a card fires the toast and does NOT navigate', () => {
    render(<QuickWinsShelf />);
    // Press the Daily Mix card
    fireEvent.press(screen.getByTestId('quick-wins-card-daily-mix'));
    // Toast was called
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    // router.push from expo-router must NOT be called — QuickWinsShelf never navigates
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('pressing multiple cards each fires the toast', () => {
    render(<QuickWinsShelf />);
    fireEvent.press(screen.getByTestId('quick-wins-card-daily-mix'));
    fireEvent.press(screen.getByTestId('quick-wins-card-word-of-day'));
    fireEvent.press(screen.getByTestId('quick-wins-card-quick-drill'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(3);
  });

  it('renders the three sample cards', () => {
    render(<QuickWinsShelf />);
    expect(screen.getByTestId('quick-wins-card-daily-mix')).toBeTruthy();
    expect(screen.getByTestId('quick-wins-card-word-of-day')).toBeTruthy();
    expect(screen.getByTestId('quick-wins-card-quick-drill')).toBeTruthy();
  });
});
