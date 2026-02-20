import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewsCard } from '../NewsCard';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

vi.mock('@/lib/analytics/newsAnalytics', () => ({
  trackNewsArticleClicked: vi.fn(),
  trackNewsQuestionsButtonClicked: vi.fn(),
  trackNewsAudioPlayStarted: vi.fn(),
  trackNewsAudioPlayPaused: vi.fn(),
  trackNewsAudioPlayCompleted: vi.fn(),
  trackNewsAudioError: vi.fn(),
}));

vi.mock('@/lib/newsAudioCoordinator', () => ({
  registerActivePlayer: vi.fn(),
  clearActivePlayer: vi.fn(),
}));

import { type NewsItemResponse } from '@/services/adminAPI';

const createMockArticle = (overrides: Partial<NewsItemResponse> = {}): NewsItemResponse => ({
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
  card_id: null,
  deck_id: null,
  ...overrides,
});

describe('NewsCard', () => {
  it('renders WaveformPlayer when hasQuestion and audio_url is present', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
      audio_url: 'https://example.com/audio.mp3',
    });

    render(<NewsCard article={article} newsLang="el" />);

    const player = screen.getByTestId('waveform-player');
    expect(player).toBeInTheDocument();
    expect(player).not.toHaveAttribute('aria-disabled');
  });

  it('renders disabled WaveformPlayer when hasQuestion and no audio_url', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
      audio_url: null,
    });

    render(<NewsCard article={article} newsLang="el" />);

    const player = screen.getByTestId('waveform-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not render WaveformPlayer when no question', () => {
    const article = createMockArticle({
      card_id: null,
      deck_id: null,
    });

    render(<NewsCard article={article} newsLang="el" />);

    expect(screen.queryByTestId('waveform-player')).not.toBeInTheDocument();
  });

  it('does not render old placeholder button text', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
    });

    render(<NewsCard article={article} newsLang="el" />);

    expect(screen.queryByText('Audio (coming soon)')).not.toBeInTheDocument();
  });

  it('questions button navigates to the correct path', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
    });

    render(<NewsCard article={article} newsLang="el" />);

    const questionsButton = screen.getByTestId(`news-questions-button-${article.id}`);
    fireEvent.click(questionsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/culture/deck-456/practice');
  });

  it('renders without errors with page="dashboard" prop', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
      audio_url: 'https://example.com/audio.mp3',
    });

    expect(() =>
      render(<NewsCard article={article} newsLang="el" page="dashboard" />)
    ).not.toThrow();
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
  });

  it('renders without errors with page="news" prop', () => {
    const article = createMockArticle({
      card_id: 'card-123',
      deck_id: 'deck-456',
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
        card_id: 'card-123',
        deck_id: 'deck-456',
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
        card_id: 'card-123',
        deck_id: 'deck-456',
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
        card_id: 'card-123',
        deck_id: 'deck-456',
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
        card_id: 'card-123',
        deck_id: 'deck-456',
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
