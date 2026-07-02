import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewsCard } from '../NewsCard';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/newsAudioCoordinator', () => ({
  registerActivePlayer: vi.fn(),
  clearActivePlayer: vi.fn(),
}));

import { track } from '@/lib/analytics';
import { type NewsItemResponse } from '@/services/adminAPI';

const createMockArticle = (overrides: Partial<NewsItemResponse> = {}): NewsItemResponse =>
  ({
    id: 'test-article-id',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English title',
    title_ru: 'Русский заголовок',
    description_el: 'Ελληνική περιγραφή',
    description_en: 'English description',
    description_ru: 'Русское описание',
    publication_date: '2026-01-27',
    original_article_url: 'https://example.com/article',
    image_url: 'https://example.com/image.jpg',
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    created_at: '2026-01-27T00:00:00Z',
    updated_at: '2026-01-27T00:00:00Z',
    country: 'cyprus',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: null,
    audio_a2_duration_seconds: null,
    has_a2_content: false,
    alt_text: null,
    photo_credit: null,
    status: 'published' as const,
    linked_situation: null,
    image_variants: null,
    ...overrides,
  }) as NewsItemResponse;

describe('NewsCard', () => {
  it('renders WaveformPlayer when audio_url is present', () => {
    const article = createMockArticle({
      audio_url: 'https://example.com/audio.mp3',
    });

    render(<NewsCard article={article} newsLang="el" />);

    const player = screen.getByTestId('waveform-player');
    expect(player).toBeInTheDocument();
    expect(player).not.toHaveAttribute('aria-disabled');
  });

  it('does not render WaveformPlayer when no audio', () => {
    const article = createMockArticle({
      audio_url: null,
    });

    render(<NewsCard article={article} newsLang="el" />);

    expect(screen.queryByTestId('waveform-player')).not.toBeInTheDocument();
  });

  it('does not render questions button', () => {
    const article = createMockArticle({
      audio_url: 'https://example.com/audio.mp3',
    });

    render(<NewsCard article={article} newsLang="el" />);

    expect(screen.queryByTestId(`news-questions-button-${article.id}`)).not.toBeInTheDocument();
  });

  it('renders without errors with page="dashboard" prop', () => {
    const article = createMockArticle({
      audio_url: 'https://example.com/audio.mp3',
    });

    expect(() =>
      render(<NewsCard article={article} newsLang="el" page="dashboard" />)
    ).not.toThrow();
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
  });

  it('renders without errors with page="news" prop', () => {
    const article = createMockArticle({
      audio_url: 'https://example.com/audio.mp3',
    });

    expect(() => render(<NewsCard article={article} newsLang="el" page="news" />)).not.toThrow();
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
  });

  describe('Error Flash', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows error flash when onError fires from WaveformPlayer', () => {
      const article = createMockArticle({
        audio_url: 'https://example.com/audio.mp3',
      });

      render(<NewsCard article={article} newsLang="el" />);

      // Trigger error on the audio element
      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      fireEvent(audio, new Event('error'));

      // Error text should be visible (mock returns key since no fallback provided)
      expect(screen.getByText('dashboard.news.buttons.audioError')).toBeInTheDocument();
    });

    it('error flash disappears after 1.5s timeout', () => {
      const article = createMockArticle({
        audio_url: 'https://example.com/audio.mp3',
      });

      render(<NewsCard article={article} newsLang="el" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      fireEvent(audio, new Event('error'));

      expect(screen.getByText('dashboard.news.buttons.audioError')).toBeInTheDocument();

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.queryByText('dashboard.news.buttons.audioError')).not.toBeInTheDocument();
    });

    it('player resets after error flash timeout', () => {
      const article = createMockArticle({
        audio_url: 'https://example.com/audio.mp3',
      });

      render(<NewsCard article={article} newsLang="el" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      fireEvent(audio, new Event('error'));

      // After timeout, the player should be reset (re-mounted via resetKey)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Player should still be present (re-mounted, not removed)
      expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
    });

    it('timeout is cleared on unmount', () => {
      const article = createMockArticle({
        audio_url: 'https://example.com/audio.mp3',
      });

      const { unmount } = render(<NewsCard article={article} newsLang="el" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      fireEvent(audio, new Event('error'));

      unmount();

      // Should not throw when timers advance after unmount
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(true).toBe(true); // No crash means cleanup worked
    });
  });
});

describe('NewsCard Level Switching', () => {
  const a2Article = createMockArticle({
    has_a2_content: true,
    title_el: 'B1 Τίτλος',
    title_el_a2: 'A2 Τίτλος',
    description_el: 'B1 Περιγραφή',
    description_el_a2: 'A2 Περιγραφή',
    audio_url: 'https://example.com/audio-b2.mp3',
    audio_a2_url: 'https://example.com/audio-a2.mp3',
  });

  it('shows A2 title and description when level is a2 and has_a2_content is true', () => {
    render(<NewsCard article={a2Article} newsLang="el" level="a2" />);
    expect(screen.getByText('A2 Τίτλος')).toBeInTheDocument();
    expect(screen.getByText('A2 Περιγραφή')).toBeInTheDocument();
  });

  it('falls back to B1 when level is a2 but has_a2_content is false', () => {
    const noA2 = createMockArticle({
      has_a2_content: false,
      title_el: 'B1 Τίτλος',
      description_el: 'B1 Περιγραφή',
    });
    render(<NewsCard article={noA2} newsLang="el" level="a2" />);
    expect(screen.getByText('B1 Τίτλος')).toBeInTheDocument();
    expect(screen.getByText('B1 Περιγραφή')).toBeInTheDocument();
  });

  it('shows B1 content when level is b1 regardless of has_a2_content', () => {
    render(<NewsCard article={a2Article} newsLang="el" level="b1" />);
    expect(screen.getByText('B1 Τίτλος')).toBeInTheDocument();
    expect(screen.getByText('B1 Περιγραφή')).toBeInTheDocument();
  });
});

describe('NewsCard Country Pill', () => {
  it('renders country pill for cyprus', () => {
    const article = createMockArticle({ country: 'cyprus', id: 'test-cy' });
    render(<NewsCard article={article} newsLang="el" />);
    expect(screen.getByText(/news\.country\.cyprus/)).toBeInTheDocument();
  });

  it('renders country pill for greece', () => {
    const article = createMockArticle({ country: 'greece', id: 'test-gr' });
    render(<NewsCard article={article} newsLang="el" />);
    expect(screen.getByText(/news\.country\.greece/)).toBeInTheDocument();
  });

  it('renders country pill for world', () => {
    const article = createMockArticle({ country: 'world', id: 'test-wo' });
    render(<NewsCard article={article} newsLang="el" />);
    expect(screen.getByText(/news\.country\.world/)).toBeInTheDocument();
  });

  it('pill has correct position classes', () => {
    const article = createMockArticle({ country: 'cyprus', id: 'test-pos' });
    render(<NewsCard article={article} newsLang="el" />);
    const pill = document.querySelector('.absolute.left-2.top-2.z-10');
    expect(pill).toBeInTheDocument();
  });
});

describe('NewsCard Compact Variant', () => {
  it('hides description when variant is compact', () => {
    const article = createMockArticle({
      description_el: 'Should be hidden',
    });
    render(<NewsCard article={article} newsLang="el" variant="compact" />);
    expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
    expect(screen.queryByText('Should be hidden')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEWS-07 Mode B QA additions: two-zone model, onOpen, analytics, footer, gradient
// ---------------------------------------------------------------------------

describe('NewsCard two-zone: onOpen wiring (AC-5, AC-9, AC-13)', () => {
  it('card body click calls onOpen with the article — NOT window.open (reader mode)', () => {
    const onOpen = vi.fn();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    fireEvent.click(card);

    expect(onOpen).toHaveBeenCalledWith(article);
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it('card renders as native anchor with correct href/target/rel when onOpen is absent (link mode)', () => {
    const article = createMockArticle({
      original_article_url: 'https://example.com/fallback',
    });
    render(<NewsCard article={article} newsLang="el" />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    expect(card.tagName.toLowerCase()).toBe('a');
    expect(card).toHaveAttribute('href', 'https://example.com/fallback');
    expect(card).toHaveAttribute('target', '_blank');
    expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('card click fires news_article_clicked analytics when onOpen is absent (link mode)', () => {
    vi.clearAllMocks();
    const article = createMockArticle({
      original_article_url: 'https://ekathimerini.com/article',
    });
    render(<NewsCard article={article} newsLang="el" />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    fireEvent.click(card);

    expect(vi.mocked(track)).toHaveBeenCalledWith(
      'news_article_clicked',
      expect.objectContaining({ item_id: article.id })
    );
  });

  it('Enter key activates card body (calls onOpen) — reader mode', () => {
    const onOpen = vi.fn();
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledWith(article);
  });

  it('Space key activates card body (calls onOpen) — reader mode', () => {
    const onOpen = vi.fn();
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    fireEvent.keyDown(card, { key: ' ' });

    expect(onOpen).toHaveBeenCalledWith(article);
  });

  it('card Play button opens the reader with autoplay intent — not on-card playback (reader mode)', () => {
    const onOpen = vi.fn();
    const article = createMockArticle({ audio_url: 'https://example.com/audio.mp3' });
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    fireEvent.click(screen.getByTestId('waveform-play-button'));

    // Single click routes to the reader with autoplay; the card's own mini-player
    // never starts (button stays on the Play affordance, not Pause).
    expect(onOpen).toHaveBeenCalledWith(article, { autoplay: true });
    expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument();
  });
});

describe('NewsCard external-link button: stops propagation + outbound (AC-2, AC-5, AC-13)', () => {
  it('external-link button click does NOT call onOpen', () => {
    const onOpen = vi.fn();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const article = createMockArticle({
      original_article_url: 'https://example.com/article',
    });
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    // The external-link button is inside the card area; click it
    const extBtn = screen.getByRole('button', { name: /dashboard\.news\.readMore|read more/i });
    fireEvent.click(extBtn);

    expect(onOpen).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it('external-link button click opens original URL in new tab', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const article = createMockArticle({
      original_article_url: 'https://example.com/article',
    });
    render(<NewsCard article={article} newsLang="el" onOpen={vi.fn()} />);

    const extBtn = screen.getByRole('button', { name: /dashboard\.news\.readMore|read more/i });
    fireEvent.click(extBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/article',
      '_blank',
      'noopener,noreferrer'
    );
    windowOpenSpy.mockRestore();
  });

  it('external-link button fires news_article_clicked (outbound path)', () => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const article = createMockArticle({
      original_article_url: 'https://ekathimerini.com/123',
    });
    render(<NewsCard article={article} newsLang="el" onOpen={vi.fn()} />);

    const extBtn = screen.getByRole('button', { name: /dashboard\.news\.readMore|read more/i });
    fireEvent.click(extBtn);

    // news_article_clicked must fire (not news_article_opened)
    expect(vi.mocked(track)).toHaveBeenCalledWith(
      'news_article_clicked',
      expect.objectContaining({ item_id: article.id })
    );
  });

  it('card body click does NOT fire news_article_clicked', () => {
    vi.clearAllMocks();
    // news_article_opened is fired by NewsPage.handleOpenArticle, not by NewsCard body click
    const onOpen = vi.fn();
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={onOpen} />);

    const card = screen.getByTestId(`news-card-${article.id}`);
    fireEvent.click(card);

    // Primary assertion: card called onOpen, NOT the external-link path
    expect(onOpen).toHaveBeenCalledWith(article);
    // Confirm news_article_clicked was NOT called (it fires only on external-link button)
    const clickedCalls = vi
      .mocked(track)
      .mock.calls.filter(([evt]) => evt === 'news_article_clicked');
    expect(clickedCalls).toHaveLength(0);
  });
});

describe('NewsCard footer: hostname + date (AC-3)', () => {
  it('renders source hostname (www stripped) in footer', () => {
    const article = createMockArticle({
      original_article_url: 'https://www.sigmalive.com/news/123',
    });
    render(<NewsCard article={article} newsLang="el" />);
    expect(screen.getByText('sigmalive.com')).toBeInTheDocument();
  });

  it('renders hostname without www prefix when www is present', () => {
    const article = createMockArticle({
      original_article_url: 'https://www.philenews.com/article/456',
    });
    render(<NewsCard article={article} newsLang="el" />);
    expect(screen.getByText('philenews.com')).toBeInTheDocument();
    expect(screen.queryByText('www.philenews.com')).not.toBeInTheDocument();
  });

  it('renders formatted publication date in footer', () => {
    const article = createMockArticle({ publication_date: '2026-01-27' });
    render(<NewsCard article={article} newsLang="el" />);
    // Date formatted by toLocaleDateString — check it contains the year
    const dateElements = document.querySelectorAll('.font-mono.text-\\[12px\\]');
    // At least one element should contain year 2026
    const hasDate = Array.from(dateElements).some((el) => el.textContent?.includes('2026'));
    expect(hasDate).toBe(true);
  });

  it('renders no date when publication_date is empty string', () => {
    // publication_date is typed as string (not nullable in NewsItemResponse), but
    // may arrive as empty from the API. The card should still render without crashing.
    const article = createMockArticle({ publication_date: '' });
    render(<NewsCard article={article} newsLang="el" />);
    // Footer should still render (source) but date span is empty string
    const card = screen.getByTestId(`news-card-${article.id}`);
    expect(card).toBeInTheDocument();
  });
});

describe('NewsCard image: null → gradient fallback (AC-4)', () => {
  it('renders no <img> element when image_url is null (gradient fallback)', () => {
    const article = createMockArticle({ image_url: null });
    render(<NewsCard article={article} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]');
    expect(img).toBeNull();
  });

  it('applies backgroundImage style to photo block when image_url is null', () => {
    const article = createMockArticle({ id: 'gradient-test', image_url: null });
    render(<NewsCard article={article} newsLang="el" />);
    // The photo block div should have a backgroundImage style (gradient from pickNewsThumb)
    const photoBlock = document.querySelector('[class*="aspect-"]') as HTMLElement | null;
    expect(photoBlock?.style.backgroundImage).toBeTruthy();
  });

  it('renders <img> when image_url is present', () => {
    const article = createMockArticle({ image_url: 'https://cdn.example.com/photo.jpg' });
    render(<NewsCard article={article} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]');
    expect(img).not.toBeNull();
  });
});

describe('NewsCard accessibility: aria-labels, lang, tabIndex (AC-5, AC-14)', () => {
  it('card surface has role="button" and tabIndex=0 in reader mode (onOpen provided)', () => {
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={vi.fn()} />);
    const card = screen.getByTestId(`news-card-${article.id}`);
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('card root is an <a> (not role=button) in link mode (no onOpen)', () => {
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" />);
    const card = screen.getByTestId(`news-card-${article.id}`);
    expect(card.tagName.toLowerCase()).toBe('a');
    expect(card).not.toHaveAttribute('role', 'button');
  });

  it('Greek title has lang="el"', () => {
    const article = createMockArticle({ title_el: 'Ελληνικός τίτλος' });
    render(<NewsCard article={article} newsLang="el" />);
    const title = screen.getByText('Ελληνικός τίτλος');
    expect(title).toHaveAttribute('lang', 'el');
  });

  it('external-link button has aria-label in reader mode (onOpen provided)', () => {
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" onOpen={vi.fn()} />);
    const extBtn = screen.getByRole('button', { name: /dashboard\.news\.readMore|read more/i });
    expect(extBtn).toHaveAttribute('aria-label');
  });

  it('external-link icon is decorative (aria-hidden span, no interactive button) in link mode', () => {
    const article = createMockArticle();
    render(<NewsCard article={article} newsLang="el" />);
    // No interactive button with that label in link mode
    expect(
      screen.queryByRole('button', { name: /dashboard\.news\.readMore|read more/i })
    ).not.toBeInTheDocument();
  });

  it('description paragraph has lang="el"', () => {
    const article = createMockArticle({ description_el: 'Ελληνική περιγραφή' });
    render(<NewsCard article={article} newsLang="el" />);
    const desc = screen.getByText('Ελληνική περιγραφή');
    expect(desc).toHaveAttribute('lang', 'el');
  });
});

describe('NewsCard: disableScrub on compact card player (AC-8)', () => {
  it('card audio player has disableScrub — waveform-bars is role=img not slider', () => {
    const article = createMockArticle({
      audio_url: 'https://cdn.example.com/audio.mp3',
    });
    render(<NewsCard article={article} newsLang="el" />);

    const bars = screen.getByTestId('waveform-bars');
    // disableScrub=true → role="img" (not "slider")
    expect(bars).toHaveAttribute('role', 'img');
  });
});
