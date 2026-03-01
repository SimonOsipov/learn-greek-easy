/**
 * NewsItemsTable Component Tests
 *
 * Covers TASK-158 acceptance criteria:
 * - Dates use date-fns format() with locale parameter (not hard-coded en-US)
 * - Russian locale shows Cyrillic month names
 * - English locale uses readable date format (dd MMM yyyy)
 * - Greek locale shows Greek month names
 * - Question completeness indicator: green Q badge (card_id non-null) vs muted Q badge
 * - Translation completeness badges: EL, EN, RU — green when both title and description non-empty
 * - Audio status present without regression
 * - Completeness indicators use small colored badges
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsItemsTable } from '../NewsItemsTable';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'news.table.title': 'News Items',
        'news.table.description': 'Manage news items',
        'news.table.noImage': 'No img',
        'news.table.published': 'Published',
        'news.table.created': 'Created',
        'news.table.empty': 'No news items found',
        'news.search.placeholder': 'Search news...',
        'news.search.noResults': 'No results found',
        'news.audio.hasAudio': 'Has audio',
        'news.audio.noAudio': 'No audio',
        'news.audio.regenerate': 'Regenerate',
        'news.audio.regenerating': 'Regenerating...',
        'news.country.filterAll': 'All Countries',
        'news.country.cyprus': 'Cyprus',
        'news.country.greece': 'Greece',
        'news.country.world': 'World',
        'actions.edit': 'Edit',
        'actions.delete': 'Delete',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
      };
      if (key === 'pagination.showing') {
        return `Showing ${options?.from}-${options?.to} of ${options?.total}`;
      }
      if (key === 'pagination.pageOf') {
        return `Page ${options?.page} of ${options?.totalPages}`;
      }
      if (key === 'news.search.filteredCount') {
        return `${options?.filtered} of ${options?.total}`;
      }
      return translations[key] || key;
    },
  }),
}));

// Mock useLanguage
const mockCurrentLanguage = { value: 'en' };
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: mockCurrentLanguage.value }),
}));

// Factory for a complete NewsItemResponse
function makeNewsItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'item-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English Title',
    title_ru: 'Русский заголовок',
    description_el: 'Ελληνική περιγραφή',
    description_en: 'English description',
    description_ru: 'Русское описание',
    publication_date: '2025-03-15',
    original_article_url: 'https://example.com/article',
    image_url: null,
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
    card_id: null,
    deck_id: null,
    country: 'cyprus',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: null,
    audio_a2_duration_seconds: null,
    audio_a2_generated_at: null,
    audio_a2_file_size_bytes: null,
    has_a2_content: false,
    ...overrides,
  };
}

const defaultTableProps = {
  isLoading: false,
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('NewsItemsTable — Date formatting', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('AC-1: formats publication_date with dd MMM yyyy in English locale', () => {
    const item = makeNewsItem({ publication_date: '2025-03-15' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // Expected: 15 Mar 2025 (English date-fns locale)
    expect(screen.getByText(/Published: 15 Mar 2025/)).toBeInTheDocument();
  });

  it('AC-1: formats created_at with dd MMM yyyy in English locale', () => {
    const item = makeNewsItem({ created_at: '2025-01-10T00:00:00Z' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // date-fns default (undefined locale) formats "Jan" in English
    expect(screen.getByText(/Created: 10 Jan 2025/)).toBeInTheDocument();
  });

  it('AC-3/AC-5: formats publication_date with Cyrillic month in Russian locale', () => {
    mockCurrentLanguage.value = 'ru';
    const item = makeNewsItem({ publication_date: '2025-03-15' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // date-fns ru locale uses Cyrillic abbreviated month names
    // March in Russian is "мар." (abbreviated)
    const publishedText = screen.getByText(/Published:/);
    expect(publishedText.textContent).toMatch(/мар/i);
  });

  it('AC-3/AC-5: formats created_at with Cyrillic month in Russian locale', () => {
    mockCurrentLanguage.value = 'ru';
    const item = makeNewsItem({ created_at: '2025-01-10T00:00:00Z' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // January in Russian date-fns is "янв."
    const createdText = screen.getByText(/Created:/);
    expect(createdText.textContent).toMatch(/янв/i);
  });

  it('AC-5: formats publication_date with Greek month in Greek locale', () => {
    mockCurrentLanguage.value = 'el';
    const item = makeNewsItem({ publication_date: '2025-03-15' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // date-fns el locale — March abbreviated is "Μαρ"
    const publishedText = screen.getByText(/Published:/);
    expect(publishedText.textContent).toMatch(/Μαρ/i);
  });
});

describe('NewsItemsTable — Question completeness indicator (AC-6)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows green Q badge when card_id is non-null', () => {
    const item = makeNewsItem({ card_id: 'card-abc' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // Find Q badges — green one has bg-green-500/10 class
    const badges = screen.getAllByText('Q');
    expect(badges.length).toBeGreaterThan(0);
    const greenBadge = badges.find((b) => b.className.includes('bg-green-500'));
    expect(greenBadge).toBeDefined();
  });

  it('shows muted Q badge when card_id is null', () => {
    const item = makeNewsItem({ card_id: null });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const badges = screen.getAllByText('Q');
    expect(badges.length).toBeGreaterThan(0);
    // Muted badge: no green class, has opacity-50
    const mutedBadge = badges.find((b) => b.className.includes('opacity-50'));
    expect(mutedBadge).toBeDefined();
  });
});

describe('NewsItemsTable — Translation completeness badges (AC-7)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows green EL badge when title_el and description_el are both non-empty', () => {
    const item = makeNewsItem({
      title_el: 'Τίτλος',
      description_el: 'Περιγραφή',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const elBadges = screen.getAllByText('EL');
    const greenEl = elBadges.find((b) => b.className.includes('bg-green-500'));
    expect(greenEl).toBeDefined();
  });

  it('shows muted EL badge when description_el is empty', () => {
    const item = makeNewsItem({
      title_el: 'Τίτλος',
      description_el: '',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const elBadges = screen.getAllByText('EL');
    const mutedEl = elBadges.find((b) => b.className.includes('opacity-50'));
    expect(mutedEl).toBeDefined();
  });

  it('shows muted EL badge when title_el is empty', () => {
    const item = makeNewsItem({
      title_el: '',
      description_el: 'Περιγραφή',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const elBadges = screen.getAllByText('EL');
    const mutedEl = elBadges.find((b) => b.className.includes('opacity-50'));
    expect(mutedEl).toBeDefined();
  });

  it('shows green EN badge when title_en and description_en are both non-empty', () => {
    const item = makeNewsItem({
      title_en: 'Title',
      description_en: 'Description',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const enBadges = screen.getAllByText('EN');
    const greenEn = enBadges.find((b) => b.className.includes('bg-green-500'));
    expect(greenEn).toBeDefined();
  });

  it('shows muted EN badge when description_en is empty', () => {
    const item = makeNewsItem({
      title_en: 'Title',
      description_en: '',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const enBadges = screen.getAllByText('EN');
    const mutedEn = enBadges.find((b) => b.className.includes('opacity-50'));
    expect(mutedEn).toBeDefined();
  });

  it('shows green RU badge when title_ru and description_ru are both non-empty', () => {
    const item = makeNewsItem({
      title_ru: 'Заголовок',
      description_ru: 'Описание',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const ruBadges = screen.getAllByText('RU');
    const greenRu = ruBadges.find((b) => b.className.includes('bg-green-500'));
    expect(greenRu).toBeDefined();
  });

  it('shows muted RU badge when description_ru is empty', () => {
    const item = makeNewsItem({
      title_ru: 'Заголовок',
      description_ru: '',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const ruBadges = screen.getAllByText('RU');
    const mutedRu = ruBadges.find((b) => b.className.includes('opacity-50'));
    expect(mutedRu).toBeDefined();
  });

  it('shows all three language badges per row', () => {
    const item = makeNewsItem();
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getAllByText('EL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RU').length).toBeGreaterThan(0);
  });

  it('muted badge uses whitespace-trimmed check (whitespace-only string is incomplete)', () => {
    const item = makeNewsItem({
      title_en: '   ',
      description_en: 'Description',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const enBadges = screen.getAllByText('EN');
    const mutedEn = enBadges.find((b) => b.className.includes('opacity-50'));
    expect(mutedEn).toBeDefined();
  });
});

describe('NewsItemsTable — Audio status (AC-8)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows "No audio" when audio_url is null', () => {
    const item = makeNewsItem({ audio_url: null });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByText('No audio')).toBeInTheDocument();
  });

  it('shows audio duration when audio_url is set and duration present', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_duration_seconds: 125,
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    // 125s = 2:05
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('shows "Has audio" fallback when audio_url set but no duration', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_duration_seconds: null,
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByText('Has audio')).toBeInTheDocument();
  });
});

describe('NewsItemsTable — Audio level pills', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows B2 pill when audio_url exists', () => {
    const item = makeNewsItem({ audio_url: 'https://example.com/audio.mp3', audio_a2_url: null });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    const audioStatus = screen.getByTestId('audio-status-item-1');
    expect(audioStatus.textContent).toContain('B2');
  });

  it('shows A2 pill when audio_a2_url exists', () => {
    const item = makeNewsItem({
      audio_url: null,
      audio_a2_url: 'https://example.com/audio-a2.mp3',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    const audioStatus = screen.getByTestId('audio-status-item-1');
    expect(audioStatus.textContent).toContain('A2');
  });

  it('shows both B2 and A2 pills when both audio URLs exist', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_a2_url: 'https://example.com/audio-a2.mp3',
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    const audioStatus = screen.getByTestId('audio-status-item-1');
    expect(audioStatus.textContent).toContain('B2');
    expect(audioStatus.textContent).toContain('A2');
  });

  it('shows no pills when neither audio URL exists', () => {
    const item = makeNewsItem({ audio_url: null, audio_a2_url: null });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    expect(screen.getByText('No audio')).toBeInTheDocument();
  });

  it('shows B2 duration when B2 audio exists', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_duration_seconds: 125,
      audio_a2_url: null,
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('shows A2 duration when only A2 audio exists', () => {
    const item = makeNewsItem({
      audio_url: null,
      audio_a2_url: 'https://example.com/audio-a2.mp3',
      audio_a2_duration_seconds: 90,
    });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });
});

describe('NewsItemsTable — Core table functionality (AC-10, no regressions)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<NewsItemsTable {...defaultTableProps} newsItems={[]} isLoading={true} />);

    // The skeleton renders without data rows visible
    expect(screen.queryByTestId('news-table-empty')).not.toBeInTheDocument();
  });

  it('shows empty state when no news items', () => {
    render(<NewsItemsTable {...defaultTableProps} newsItems={[]} />);

    expect(screen.getByTestId('news-table-empty')).toBeInTheDocument();
    expect(screen.getByText('No news items found')).toBeInTheDocument();
  });

  it('renders each news item row with testid', () => {
    const item = makeNewsItem({ id: 'item-42' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByTestId('news-item-row-item-42')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup();
    const mockOnEdit = vi.fn();
    const item = makeNewsItem({ id: 'item-42' });

    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} onEdit={mockOnEdit} />);

    await user.click(screen.getByTestId('edit-news-item-42'));
    expect(mockOnEdit).toHaveBeenCalledWith(item);
  });

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const mockOnDelete = vi.fn();
    const item = makeNewsItem({ id: 'item-42' });

    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} onDelete={mockOnDelete} />);

    await user.click(screen.getByTestId('delete-news-item-42'));
    expect(mockOnDelete).toHaveBeenCalledWith(item);
  });

  it('shows English title when currentLanguage is en', () => {
    mockCurrentLanguage.value = 'en';
    const item = makeNewsItem();
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByText('English Title')).toBeInTheDocument();
  });

  it('shows Greek title when currentLanguage is el', () => {
    mockCurrentLanguage.value = 'el';
    const item = makeNewsItem();
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
  });

  it('shows Russian title when currentLanguage is ru', () => {
    mockCurrentLanguage.value = 'ru';
    const item = makeNewsItem();
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    expect(screen.getByText('Русский заголовок')).toBeInTheDocument();
  });

  it('shows pagination when there are multiple pages', () => {
    const item = makeNewsItem();
    render(
      <NewsItemsTable
        {...defaultTableProps}
        newsItems={[item]}
        total={50}
        totalPages={3}
        page={2}
      />
    );

    expect(screen.getByTestId('news-pagination-prev')).toBeInTheDocument();
    expect(screen.getByTestId('news-pagination-next')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('previous page button is disabled on first page', () => {
    const item = makeNewsItem();
    render(
      <NewsItemsTable
        {...defaultTableProps}
        newsItems={[item]}
        total={50}
        totalPages={3}
        page={1}
      />
    );

    expect(screen.getByTestId('news-pagination-prev')).toBeDisabled();
  });

  it('next page button is disabled on last page', () => {
    const item = makeNewsItem();
    render(
      <NewsItemsTable
        {...defaultTableProps}
        newsItems={[item]}
        total={50}
        totalPages={3}
        page={3}
      />
    );

    expect(screen.getByTestId('news-pagination-next')).toBeDisabled();
  });

  it('calls onPageChange when next page clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();
    const item = makeNewsItem();

    render(
      <NewsItemsTable
        {...defaultTableProps}
        newsItems={[item]}
        total={50}
        totalPages={3}
        page={1}
        onPageChange={mockOnPageChange}
      />
    );

    await user.click(screen.getByTestId('news-pagination-next'));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('filters news items by search input', async () => {
    const user = userEvent.setup();
    const items = [
      makeNewsItem({ id: 'item-1', title_en: 'Athens News' }),
      makeNewsItem({ id: 'item-2', title_en: 'Economy Update' }),
    ];
    render(<NewsItemsTable {...defaultTableProps} newsItems={items} total={2} />);

    const searchInput = screen.getByTestId('news-search-input');
    await user.type(searchInput, 'athens');

    // Wait for debounce (300ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.getByTestId('news-item-row-item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('news-item-row-item-2')).not.toBeInTheDocument();
  });

  it('shows no results state when search matches nothing', async () => {
    const user = userEvent.setup();
    const item = makeNewsItem({ title_en: 'Athens News' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const searchInput = screen.getByTestId('news-search-input');
    await user.type(searchInput, 'zzznomatch');

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.getByTestId('news-search-empty')).toBeInTheDocument();
  });
});

describe('NewsItemsTable — Country badge', () => {
  it('shows country badge for cyprus items', () => {
    const item = makeNewsItem({ country: 'cyprus' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    // Badge contains CY short label (may be preceded by flag emoji)
    expect(screen.getByText((content) => content.includes('CY'))).toBeInTheDocument();
  });

  it('shows country badge for greece items', () => {
    const item = makeNewsItem({ country: 'greece' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    expect(screen.getByText((content) => content.includes('GR'))).toBeInTheDocument();
  });

  it('shows country badge for world items', () => {
    const item = makeNewsItem({ country: 'world' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    expect(screen.getByText((content) => content.includes('World'))).toBeInTheDocument();
  });

  it('country badge has blue color classes', () => {
    const item = makeNewsItem({ country: 'cyprus' });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);
    const badge = screen
      .getByText((content) => content.includes('CY'))
      .closest('[class*="bg-blue"]');
    expect(badge).not.toBeNull();
  });
});

describe('NewsItemsTable — A2 badge', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows purple A2 badge when has_a2_content is true', () => {
    const item = makeNewsItem({ id: 'item-a2', has_a2_content: true });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const badge = screen.getByTestId('a2-badge-item-a2');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-purple-500');
  });

  it('shows muted A2 badge when has_a2_content is false', () => {
    const item = makeNewsItem({ id: 'item-no-a2', has_a2_content: false });
    render(<NewsItemsTable {...defaultTableProps} newsItems={[item]} />);

    const badge = screen.getByTestId('a2-badge-item-no-a2');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('opacity-50');
    expect(badge.className).not.toContain('bg-purple-500');
  });

  it('A2 badge is present for every row', () => {
    const items = [
      makeNewsItem({ id: 'item-1', has_a2_content: true }),
      makeNewsItem({ id: 'item-2', has_a2_content: false }),
    ];
    render(<NewsItemsTable {...defaultTableProps} newsItems={items} total={2} />);

    expect(screen.getByTestId('a2-badge-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('a2-badge-item-2')).toBeInTheDocument();
  });
});
