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
    i18n: { language: 'en' },
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

// (window.open is no longer called — the CTA is a real <a> anchor that navigates natively)

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
    // Title appears in both sr-only SheetTitle and visible h2 — check at least one is present
    expect(screen.getAllByText('Ελληνικός τίτλος B1').length).toBeGreaterThan(0);
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
    // Title appears in both sr-only SheetTitle and visible h2
    expect(screen.getAllByText('Ελληνικός τίτλος B1').length).toBeGreaterThan(0);
  });

  it('shows A2 title when level=a2', () => {
    renderReader({ level: 'a2' });
    // Title appears in both sr-only SheetTitle and visible h2
    expect(screen.getAllByText('Ελληνικός τίτλος A2').length).toBeGreaterThan(0);
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
  });

  it('CTA is a real anchor with correct href, target, rel, and data-testid', () => {
    renderReader({ level: 'b1' });

    const cta = screen.getByTestId('news-reader-open-original');
    expect(cta.tagName).toBe('A');
    expect(cta).toHaveAttribute('href', 'https://www.ekathimerini.com/article/123');
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta.getAttribute('rel')).toContain('noopener');
    expect(cta).toHaveAttribute('data-testid', 'news-reader-open-original');
  });

  it('fires news_article_clicked with correct domain on CTA click', async () => {
    renderReader({ level: 'b1' });

    const cta = screen.getByTestId('news-reader-open-original');
    await userEvent.click(cta);

    expect(track).toHaveBeenCalledWith(
      'news_article_clicked',
      expect.objectContaining({
        item_id: 'article-reader-1',
        article_domain: 'www.ekathimerini.com',
      })
    );
  });

  it('does NOT call window.open on CTA click (anchor navigates natively)', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open');
    renderReader({ level: 'b1' });

    const cta = screen.getByTestId('news-reader-open-original');
    await userEvent.click(cta);

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it('fires news_article_clicked with article_domain="unknown" when URL is invalid', async () => {
    const article = createArticle({ original_article_url: 'not-a-url' });
    renderReader({ article });

    const cta = screen.getByTestId('news-reader-open-original');
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

    const cta = screen.getByTestId('news-reader-open-original');
    await userEvent.click(cta);

    const calls = vi.mocked(track).mock.calls;
    expect(calls.some(([evt]) => evt === 'news_article_opened')).toBe(false);
  });

  it('CTA has no href when URL is unsafe/unparseable (XSS guard — renders non-navigating)', () => {
    const article = createArticle({ original_article_url: 'not-a-url' });
    renderReader({ article });

    const cta = screen.getByTestId('news-reader-open-original');
    // Unsafe URL → no href attribute (renders a <span>, not a navigating anchor)
    expect(cta).not.toHaveAttribute('href');
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
    // Both the sr-only SheetTitle (Radix h2) and the visible body h2 contain the title.
    // Only the body heading carries lang="el" — find it by that attribute.
    const titleElements = screen.getAllByText('Ελληνικός τίτλος B1');
    const langElTitle = titleElements.find((el) => el.getAttribute('lang') === 'el');
    expect(langElTitle).toBeDefined();
    expect(langElTitle).toHaveAttribute('lang', 'el');
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

// NWS8-05: SheetTitle + SheetDescription sr-only elements (a11y — AC #1 / AC #2)
describe('NewsReaderSheet — NWS8-05 sr-only SheetTitle and SheetDescription (a11y)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SheetTitle sr-only element is present in the DOM when sheet is open', () => {
    renderReader({ level: 'b1' });
    // The dialog role element is the SheetContent; Radix requires a DialogTitle (h2) inside.
    // Our SheetTitle is sr-only — find the heading that Radix renders.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // Radix renders DialogTitle as an h2 — the sr-only one is our SheetTitle
    const srOnlyHeadings = Array.from(dialog!.querySelectorAll('h2')).filter((el) =>
      el.className.includes('sr-only')
    );
    expect(srOnlyHeadings.length).toBeGreaterThan(0);
  });

  it('SheetTitle sr-only contains the article title (not just the fallback)', () => {
    renderReader({ level: 'b1' });
    // There should be at least two occurrences of the title: sr-only + visible h2
    const titleEls = screen.getAllByText('Ελληνικός τίτλος B1');
    expect(titleEls.length).toBeGreaterThanOrEqual(2);
    // One of them must be sr-only
    const srOnlyTitle = titleEls.find((el) => el.className.includes('sr-only'));
    expect(srOnlyTitle).toBeDefined();
  });

  it('SheetDescription sr-only element is present in the DOM', () => {
    renderReader({ level: 'b1' });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // SheetDescription renders as <p> or similar with sr-only — query by class
    const srOnlyEls = Array.from(dialog!.querySelectorAll('.sr-only'));
    // Should have at least two sr-only elements: title and description
    expect(srOnlyEls.length).toBeGreaterThanOrEqual(2);
  });

  it('SheetDescription renders the news.reader.description i18n key text', () => {
    renderReader({ level: 'b1' });
    // The mock returns the key as fallback: 'news.reader.description'
    // Check that it's in the DOM (sr-only, not visible but in the tree)
    expect(screen.getByText('news.reader.description')).toBeInTheDocument();
  });

  it('SheetTitle sr-only still present when article is null (fallback to news.page.title)', () => {
    renderReader({ article: null });
    // When article is null, SheetTitle fallback = t('news.page.title') = 'news.page.title'
    // The dialog is open (open=true) but body conditional renders nothing — the sr-only title
    // is outside the body conditional so it should still render.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // The sr-only SheetTitle must contain the fallback text so screen readers announce the sheet
    const srOnlyTitle = dialog!.querySelector('.sr-only');
    expect(srOnlyTitle).not.toBeNull();
    expect(srOnlyTitle!.textContent).toBe('news.page.title');
  });

  it('no visible change to the sticky header layout (CA3, CA4) — back and close buttons still present', () => {
    renderReader({ level: 'b1' });
    // NWS8-05 must not alter the visible sticky-header UI
    expect(screen.getByRole('button', { name: /back to news/i })).toBeInTheDocument();
    const closeBtns = screen.getAllByRole('button', { name: /close/i });
    expect(closeBtns.length).toBeGreaterThan(0);
  });
});
