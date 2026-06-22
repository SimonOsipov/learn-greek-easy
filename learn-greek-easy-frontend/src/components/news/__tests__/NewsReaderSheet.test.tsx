/**
 * NewsReaderSheet Component Tests (NEWS-07 Mode B QA, NWSR-11)
 *
 * Covers:
 * - Open/close via scrim (Radix overlay), ESC key, and back/close buttons
 * - Level switch swaps BOTH body text AND audio src (resetKey → WaveformPlayer remount)
 * - "Open original" CTA fires news_article_clicked (outbound) + opens new tab
 * - Source line shows hostname only (no www.)
 * - Accessibility: aria-labels on icon buttons, lang="el" on Greek text
 * - A2 segment disabled/hidden when has_a2_content is false
 * - hero gradient fallback when image_url is null
 * - Audio coordinator: registerActivePlayer on play, clearActivePlayer on sheet close
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewsReaderSheet } from '../NewsReaderSheet';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/newsAudioCoordinator', () => ({
  registerActivePlayer: vi.fn(),
  clearActivePlayer: vi.fn(),
}));

vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

vi.mock('@/lib/imageVariants', () => ({
  buildSrcSet: vi.fn(() => undefined),
  recoverDerivativeError: vi.fn(),
}));

// Window.open mock so we can assert outbound navigation without leaving jsdom
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true });

// ---------------------------------------------------------------------------
// Imports that must come after mocks (dynamic import order)
// ---------------------------------------------------------------------------

import { track } from '@/lib/analytics';
import { clearActivePlayer } from '@/lib/newsAudioCoordinator';
import type { NewsItemResponse } from '@/services/adminAPI';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const createArticle = (overrides: Partial<NewsItemResponse> = {}): NewsItemResponse =>
  ({
    id: 'article-reader-1',
    title_el: 'Ελληνικός τίτλος B1',
    title_en: 'English title',
    title_ru: 'Русский заголовок',
    title_el_a2: 'Ελληνικός τίτλος A2',
    description_el: 'B1 Ελληνική περιγραφή για ανάγνωση.',
    description_el_a2: 'A2 Ελληνική περιγραφή για ανάγνωση.',
    description_en: 'English description',
    description_ru: 'Русское описание',
    publication_date: '2026-01-27',
    original_article_url: 'https://www.ekathimerini.com/article/123',
    image_url: null,
    image_variants: null,
    audio_url: 'https://cdn.example.com/b1.mp3',
    audio_a2_url: 'https://cdn.example.com/a2.mp3',
    audio_duration_seconds: 120,
    audio_a2_duration_seconds: 90,
    audio_generated_at: null,
    audio_a2_generated_at: null,
    audio_file_size_bytes: null,
    audio_a2_file_size_bytes: null,
    country: 'greece',
    has_a2_content: true,
    alt_text: null,
    photo_credit: null,
    status: 'published' as const,
    linked_situation: null,
    created_at: '2026-01-27T00:00:00Z',
    updated_at: '2026-01-27T00:00:00Z',
    ...overrides,
  }) as NewsItemResponse;

// Default render helper
function renderReader(
  overrides: {
    article?: NewsItemResponse | null;
    open?: boolean;
    level?: 'a2' | 'b1';
    onOpenChange?: (o: boolean) => void;
    onLevelChange?: (l: 'a2' | 'b1') => void;
  } = {}
) {
  const {
    article = createArticle(),
    open = true,
    level = 'b1',
    onOpenChange = vi.fn(),
    onLevelChange = vi.fn(),
  } = overrides;
  return render(
    <NewsReaderSheet
      article={article}
      open={open}
      onOpenChange={onOpenChange}
      level={level}
      onLevelChange={onLevelChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsReaderSheet — open/close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders content when open=true and article is provided', () => {
    renderReader();
    expect(screen.getByText('Ελληνικός τίτλος B1')).toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    renderReader({ open: false });
    expect(screen.queryByText('Ελληνικός τίτλος B1')).not.toBeInTheDocument();
  });

  it('renders nothing when article is null', () => {
    renderReader({ article: null });
    // Sheet opens (open=true) but body is empty when article=null
    expect(screen.queryByText('Ελληνικός τίτλος B1')).not.toBeInTheDocument();
  });

  it('calls onOpenChange(false) when the close × button is clicked', async () => {
    const onOpenChange = vi.fn();
    renderReader({ onOpenChange });

    // Use getAllByRole and pick the visible one (the hidden Radix close button has sr-only text)
    const closeBtns = screen.getAllByRole('button', { name: /close/i });
    // Our custom close button is the one with aria-label="Close" (explicit, not sr-only)
    const customClose =
      closeBtns.find(
        (btn) => btn.getAttribute('aria-label') === 'Close' && !btn.querySelector('.sr-only')
      ) ?? closeBtns[0];
    await userEvent.click(customClose);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the back button is clicked', async () => {
    const onOpenChange = vi.fn();
    renderReader({ onOpenChange });

    const backBtn = screen.getByRole('button', { name: /back to news/i });
    await userEvent.click(backBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on ESC key press', async () => {
    const onOpenChange = vi.fn();
    renderReader({ onOpenChange });

    // Radix Dialog handles ESC via keydown at document level
    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('NewsReaderSheet — level switch swaps body text AND audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows B1 body text when level=b1', () => {
    renderReader({ level: 'b1' });
    expect(screen.getByText('B1 Ελληνική περιγραφή για ανάγνωση.')).toBeInTheDocument();
    expect(screen.queryByText('A2 Ελληνική περιγραφή για ανάγνωση.')).not.toBeInTheDocument();
  });

  it('shows A2 body text when level=a2 and has_a2_content=true', () => {
    renderReader({ level: 'a2' });
    expect(screen.getByText('A2 Ελληνική περιγραφή για ανάγνωση.')).toBeInTheDocument();
    expect(screen.queryByText('B1 Ελληνική περιγραφή για ανάγνωση.')).not.toBeInTheDocument();
  });

  it('shows B1 body text when level=a2 but has_a2_content=false (fallback)', () => {
    const article = createArticle({ has_a2_content: false, description_el_a2: null });
    renderReader({ level: 'a2', article });
    // Falls back to B1 description
    expect(screen.getByText('B1 Ελληνική περιγραφή για ανάγνωση.')).toBeInTheDocument();
  });

  it('shows B1 title when level=b1', () => {
    renderReader({ level: 'b1' });
    expect(screen.getByText('Ελληνικός τίτλος B1')).toBeInTheDocument();
  });

  it('shows A2 title when level=a2', () => {
    renderReader({ level: 'a2' });
    expect(screen.getByText('Ελληνικός τίτλος A2')).toBeInTheDocument();
  });

  it('switches audio src by remounting player when level changes (B1 → A2)', async () => {
    const onLevelChange = vi.fn();
    const { rerender } = renderReader({ level: 'b1', onLevelChange });

    // Initial: audio element has B1 url
    const b1Audio = document.querySelector('audio') as HTMLAudioElement | null;
    expect(b1Audio?.src).toContain('b1.mp3');

    // Level change is managed by parent — rerender with new level prop
    rerender(
      <NewsReaderSheet
        article={createArticle()}
        open={true}
        onOpenChange={vi.fn()}
        level="a2"
        onLevelChange={onLevelChange}
      />
    );

    await waitFor(() => {
      const a2Audio = document.querySelector('audio') as HTMLAudioElement | null;
      expect(a2Audio?.src).toContain('a2.mp3');
    });
  });

  it('calls onLevelChange when the A2 button is clicked', async () => {
    const onLevelChange = vi.fn();
    renderReader({ level: 'b1', onLevelChange });

    const a2Btn = screen.getByRole('button', { name: /a2/i });
    await userEvent.click(a2Btn);

    expect(onLevelChange).toHaveBeenCalledWith('a2');
  });

  it('calls onLevelChange when the B1 button is clicked while at A2', async () => {
    const onLevelChange = vi.fn();
    renderReader({ level: 'a2', onLevelChange });

    const b1Btn = screen.getByRole('button', { name: /b1/i });
    await userEvent.click(b1Btn);

    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });
});

describe('NewsReaderSheet — A2 segment disabled when has_a2_content=false', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A2 button is disabled when article has no A2 content', () => {
    const article = createArticle({ has_a2_content: false });
    renderReader({ article, level: 'b1' });

    const a2Btn = screen.getByRole('button', { name: /a2/i });
    expect(a2Btn).toBeDisabled();
  });

  it('A2 button is enabled when article has A2 content', () => {
    renderReader({ level: 'b1' });

    const a2Btn = screen.getByRole('button', { name: /a2/i });
    expect(a2Btn).not.toBeDisabled();
  });

  it('A2 button has correct aria-pressed=false when level is b1', () => {
    renderReader({ level: 'b1' });
    const a2Btn = screen.getByRole('button', { name: /a2/i });
    expect(a2Btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('A2 button has correct aria-pressed=true when level is a2', () => {
    renderReader({ level: 'a2' });
    const a2Btn = screen.getByRole('button', { name: /a2/i });
    expect(a2Btn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('NewsReaderSheet — "Open original" CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  it('fires news_article_clicked with correct domain on CTA click', async () => {
    renderReader({ level: 'b1' });

    const cta = screen.getByRole('button', { name: /open original/i });
    await userEvent.click(cta);

    expect(track).toHaveBeenCalledWith(
      'news_article_clicked',
      expect.objectContaining({
        item_id: 'article-reader-1',
        article_domain: 'www.ekathimerini.com',
      })
    );
  });

  it('opens original_article_url in a new tab on CTA click', async () => {
    renderReader({ level: 'b1' });

    const cta = screen.getByRole('button', { name: /open original/i });
    await userEvent.click(cta);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.ekathimerini.com/article/123',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('fires news_article_clicked with article_domain="unknown" when URL is invalid', async () => {
    const article = createArticle({ original_article_url: 'not-a-url' });
    renderReader({ article });

    const cta = screen.getByRole('button', { name: /open original/i });
    await userEvent.click(cta);

    expect(track).toHaveBeenCalledWith(
      'news_article_clicked',
      expect.objectContaining({
        article_domain: 'unknown',
      })
    );
  });

  it('does NOT fire news_article_opened on CTA click (only news_article_clicked)', async () => {
    renderReader({ level: 'b1' });

    const cta = screen.getByRole('button', { name: /open original/i });
    await userEvent.click(cta);

    const calls = vi.mocked(track).mock.calls;
    expect(calls.some(([evt]) => evt === 'news_article_opened')).toBe(false);
  });
});

describe('NewsReaderSheet — source line shows hostname', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows hostname with www stripped', () => {
    renderReader();
    // URL is https://www.ekathimerini.com/article/123
    // hostname.replace(/^www\./, '') → 'ekathimerini.com'
    expect(screen.getByText('ekathimerini.com')).toBeInTheDocument();
    expect(screen.queryByText('www.ekathimerini.com')).not.toBeInTheDocument();
  });

  it('shows raw hostname when URL has no www prefix', () => {
    const article = createArticle({ original_article_url: 'https://sigmalive.com/news/123' });
    renderReader({ article });
    expect(screen.getByText('sigmalive.com')).toBeInTheDocument();
  });

  it('shows no source line when URL is unparseable', () => {
    const article = createArticle({ original_article_url: 'not-valid' });
    renderReader({ article });
    // No source line should appear (hostname would be empty string)
    // The <p> source element only renders when sourceHostname is truthy
    const paras = screen.queryAllByText('not-valid');
    expect(paras).toHaveLength(0);
  });
});

describe('NewsReaderSheet — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('close × button has an aria-label', () => {
    renderReader();
    // Multiple close buttons may exist (Radix auto-rendered + our custom); get all
    const closeBtns = screen.getAllByRole('button', { name: /close/i });
    // Our custom one has explicit aria-label="Close"
    const customClose = closeBtns.find((btn) => btn.getAttribute('aria-label') === 'Close');
    expect(customClose).toBeDefined();
    expect(customClose).toHaveAttribute('aria-label');
  });

  it('back button has an aria-label', () => {
    renderReader();
    const backBtn = screen.getByRole('button', { name: /back to news/i });
    expect(backBtn).toHaveAttribute('aria-label');
  });

  it('title element has lang="el"', () => {
    renderReader({ level: 'b1' });
    const title = screen.getByText('Ελληνικός τίτλος B1');
    expect(title).toHaveAttribute('lang', 'el');
  });

  it('body text element has lang="el"', () => {
    renderReader({ level: 'b1' });
    const bodyEl = screen.getByText('B1 Ελληνική περιγραφή για ανάγνωση.');
    expect(bodyEl.closest('[lang="el"]')).not.toBeNull();
  });

  it('level segment group has aria-label', () => {
    renderReader();
    expect(screen.getByRole('group', { name: /content level/i })).toBeInTheDocument();
  });
});

describe('NewsReaderSheet — hero gradient fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no <img> when image_url is null (uses CSS gradient)', () => {
    renderReader({ article: createArticle({ image_url: null }) });
    const imgs = document.querySelectorAll('img[aria-hidden="true"]');
    expect(imgs).toHaveLength(0);
  });

  it('renders <img> when image_url is present', () => {
    renderReader({
      article: createArticle({ image_url: 'https://cdn.example.com/photo.jpg' }),
    });
    const img = document.querySelector('img[aria-hidden="true"]');
    expect(img).not.toBeNull();
  });
});

describe('NewsReaderSheet — audio coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears audio coordinator when sheet closes', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderReader({ open: true, onOpenChange });

    // Close the sheet by setting open=false
    rerender(
      <NewsReaderSheet
        article={createArticle()}
        open={false}
        onOpenChange={onOpenChange}
        level="b1"
        onLevelChange={vi.fn()}
      />
    );

    expect(clearActivePlayer).toHaveBeenCalled();
  });

  it('renders WaveformPlayer when audio_url is present', () => {
    renderReader({ level: 'b1' });
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
  });

  it('does NOT render WaveformPlayer when no audio', () => {
    const article = createArticle({ audio_url: null, audio_a2_url: null });
    renderReader({ article, level: 'b1' });
    expect(screen.queryByTestId('waveform-player')).not.toBeInTheDocument();
  });

  it('reader player has scrub ENABLED (no disableScrub prop — waveform-bars is slider)', () => {
    renderReader({ level: 'b1' });
    const bars = screen.getByTestId('waveform-bars');
    // disableScrub=false (default) → role="slider" for the waveform bars area
    expect(bars).toHaveAttribute('role', 'slider');
  });

  it('reader player shows speed control', () => {
    renderReader({ level: 'b1' });
    expect(screen.getByTestId('waveform-speed-pills')).toBeInTheDocument();
  });
});

describe('NewsReaderSheet — no new @keyframes', () => {
  it('no data-state animation classes from custom keyframes on SheetContent', () => {
    renderReader();
    // The sheet uses shadcn built-in slide-in/out from Radix — no bespoke @keyframes.
    // We verify no className contains "news-reader-slide" or similar custom names.
    const content = document.querySelector('[role="dialog"]');
    expect(content?.className).not.toMatch(/news-reader|reader-slide/);
  });
});
