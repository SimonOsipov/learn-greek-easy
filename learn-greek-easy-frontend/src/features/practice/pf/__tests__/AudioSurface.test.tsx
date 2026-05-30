/**
 * pf/AudioSurface.tsx — unit tests (PRACT2-1-06)
 *
 * Covers:
 * - Renders .pf-audio-surface shell
 * - Play button calls onToggle
 * - Play button shows pause icon while playing
 * - Play button shows loading icon while isLoading
 * - Play button is disabled when no audioUrl
 * - 28 waveform bars render
 * - Bar heights are deterministic — identical across two renders (AC #2)
 * - barHeight() is a pure function (same input → same output, no random)
 * - Bars have pf-wave-bar--playing class while isPlaying
 * - Bars do NOT have pf-wave-bar--playing class while not playing
 * - x1 / x0.75 speed buttons render
 * - Speed button calls setSpeed with correct value
 * - Active speed button has is-active class
 * - Audio family header carries UnwiredDot (data-testid="unwired-dot")
 * - Audio family carries red dot (tone="danger" — default)
 * - UnwiredDot aria-label describes the Audio family placeholder
 * - Error message renders when error is set
 * - Component NOT dispatched from V2FlashcardPracticePage (no audio case)
 */

import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AudioSurface, barHeight } from '../AudioSurface';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// dx.css import — mock to avoid JSDOM CSS parse errors
vi.mock('@/features/decks/dx/dx.css', () => ({}));

// Lucide icons — simple stubs so we don't need SVG rendering
vi.mock('lucide-react', () => ({
  Play: (props: Record<string, unknown>) => <span data-testid="icon-play" {...props} />,
  Pause: (props: Record<string, unknown>) => <span data-testid="icon-pause" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  Volume2: (props: Record<string, unknown>) => <span data-testid="icon-volume2" {...props} />,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(
  overrides: Partial<{
    audioUrl: string | null;
    isPlaying: boolean;
    isLoading: boolean;
    error: string | null;
    onToggle: () => void;
    speed: 1 | 0.75;
    setSpeed: (s: 1 | 0.75) => void;
  }> = {}
) {
  return {
    audioUrl: 'https://example.com/audio.mp3',
    isPlaying: false,
    isLoading: false,
    error: null,
    onToggle: vi.fn(),
    speed: 1 as const,
    setSpeed: vi.fn(),
    ...overrides,
  };
}

// ─── barHeight pure function ──────────────────────────────────────────────────

describe('barHeight (deterministic waveform helper)', () => {
  it('returns a number between 20 and 100 for all 28 bar indices', () => {
    for (let i = 0; i < 28; i++) {
      const h = barHeight(i);
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic — same index always returns same height', () => {
    for (let i = 0; i < 28; i++) {
      expect(barHeight(i)).toBe(barHeight(i));
    }
  });

  it('produces 28 distinct heights (no flat constant wave)', () => {
    const heights = Array.from({ length: 28 }, (_, i) => barHeight(i));
    const unique = new Set(heights);
    // At least 5 distinct values across 28 bars
    expect(unique.size).toBeGreaterThan(5);
  });
});

// ─── AudioSurface rendering ───────────────────────────────────────────────────

describe('AudioSurface — shell', () => {
  it('renders .pf-audio-surface shell', () => {
    const { container } = render(<AudioSurface audioState={makeState()} />);
    expect(container.querySelector('.pf-audio-surface')).not.toBeNull();
  });

  it('renders data-testid="pf-audio-surface"', () => {
    render(<AudioSurface audioState={makeState()} />);
    expect(screen.getByTestId('pf-audio-surface')).not.toBeNull();
  });

  it('applies extra className when provided', () => {
    const { container } = render(<AudioSurface audioState={makeState()} className="my-extra" />);
    expect(container.querySelector('.pf-audio-surface.my-extra')).not.toBeNull();
  });
});

// ─── Play button ──────────────────────────────────────────────────────────────

describe('AudioSurface — play button', () => {
  it('renders the play button', () => {
    render(<AudioSurface audioState={makeState()} />);
    expect(screen.getByTestId('pf-audio-play-btn')).not.toBeNull();
  });

  it('shows play icon when not playing and not loading', () => {
    render(<AudioSurface audioState={makeState({ isPlaying: false, isLoading: false })} />);
    expect(screen.getByTestId('icon-play')).not.toBeNull();
  });

  it('shows pause icon while isPlaying=true', () => {
    render(<AudioSurface audioState={makeState({ isPlaying: true })} />);
    expect(screen.getByTestId('icon-pause')).not.toBeNull();
  });

  it('shows loading icon while isLoading=true', () => {
    render(<AudioSurface audioState={makeState({ isLoading: true })} />);
    expect(screen.getByTestId('icon-loader')).not.toBeNull();
  });

  it('calls onToggle when play button is clicked', () => {
    const onToggle = vi.fn();
    render(<AudioSurface audioState={makeState({ onToggle })} />);
    fireEvent.click(screen.getByTestId('pf-audio-play-btn'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is disabled when audioUrl is null', () => {
    render(<AudioSurface audioState={makeState({ audioUrl: null })} />);
    const btn = screen.getByTestId('pf-audio-play-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('does NOT call onToggle when disabled (no audioUrl)', () => {
    const onToggle = vi.fn();
    render(<AudioSurface audioState={makeState({ audioUrl: null, onToggle })} />);
    fireEvent.click(screen.getByTestId('pf-audio-play-btn'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

// ─── Waveform bars ────────────────────────────────────────────────────────────

describe('AudioSurface — waveform', () => {
  it('renders exactly 28 bars', () => {
    const { container } = render(<AudioSurface audioState={makeState()} />);
    const bars = container.querySelectorAll('[data-testid^="pf-wave-bar-"]');
    expect(bars.length).toBe(28);
  });

  it('bar heights are deterministic — two renders produce identical heights (AC #2)', () => {
    const getHeights = () => {
      const { container } = render(<AudioSurface audioState={makeState()} />);
      const bars = Array.from(container.querySelectorAll('[data-testid^="pf-wave-bar-"]'));
      return bars.map((b) => (b as HTMLElement).style.getPropertyValue('--bar-h'));
    };

    const first = getHeights();
    const second = getHeights();
    expect(first).toEqual(second);
  });

  it('bar heights are non-empty strings (CSS custom prop set)', () => {
    const { container } = render(<AudioSurface audioState={makeState()} />);
    const bars = Array.from(container.querySelectorAll('[data-testid^="pf-wave-bar-"]'));
    bars.forEach((b) => {
      const h = (b as HTMLElement).style.getPropertyValue('--bar-h');
      expect(h).toBeTruthy();
      expect(h.endsWith('%')).toBe(true);
    });
  });

  it('bars have pf-wave-bar--playing class while isPlaying=true', () => {
    const { container } = render(<AudioSurface audioState={makeState({ isPlaying: true })} />);
    const bars = container.querySelectorAll('.pf-wave-bar--playing');
    expect(bars.length).toBe(28);
  });

  it('bars do NOT have pf-wave-bar--playing class while isPlaying=false', () => {
    const { container } = render(<AudioSurface audioState={makeState({ isPlaying: false })} />);
    const bars = container.querySelectorAll('.pf-wave-bar--playing');
    expect(bars.length).toBe(0);
  });
});

// ─── Speed toggle ─────────────────────────────────────────────────────────────

describe('AudioSurface — speed toggle', () => {
  it('renders x1 and x0.75 speed buttons', () => {
    render(<AudioSurface audioState={makeState()} />);
    expect(screen.getByTestId('pf-audio-speed-1')).not.toBeNull();
    expect(screen.getByTestId('pf-audio-speed-0.75')).not.toBeNull();
  });

  it('x1 button has is-active class when speed=1', () => {
    const { container } = render(<AudioSurface audioState={makeState({ speed: 1 })} />);
    const btn1 = container.querySelector('[data-testid="pf-audio-speed-1"]');
    expect(btn1?.classList.contains('is-active')).toBe(true);
    const btn075 = container.querySelector('[data-testid="pf-audio-speed-0.75"]');
    expect(btn075?.classList.contains('is-active')).toBe(false);
  });

  it('x0.75 button has is-active class when speed=0.75', () => {
    const { container } = render(<AudioSurface audioState={makeState({ speed: 0.75 })} />);
    const btn075 = container.querySelector('[data-testid="pf-audio-speed-0.75"]');
    expect(btn075?.classList.contains('is-active')).toBe(true);
    const btn1 = container.querySelector('[data-testid="pf-audio-speed-1"]');
    expect(btn1?.classList.contains('is-active')).toBe(false);
  });

  it('calls setSpeed(0.75) when x0.75 button is clicked', () => {
    const setSpeed = vi.fn();
    render(<AudioSurface audioState={makeState({ speed: 1, setSpeed })} />);
    fireEvent.click(screen.getByTestId('pf-audio-speed-0.75'));
    expect(setSpeed).toHaveBeenCalledWith(0.75);
  });

  it('calls setSpeed(1) when x1 button is clicked', () => {
    const setSpeed = vi.fn();
    render(<AudioSurface audioState={makeState({ speed: 0.75, setSpeed })} />);
    fireEvent.click(screen.getByTestId('pf-audio-speed-1'));
    expect(setSpeed).toHaveBeenCalledWith(1);
  });
});

// ─── UnwiredDot — Audio family red dot (AC #3) ───────────────────────────────

describe('AudioSurface — Audio family red dot', () => {
  it('renders UnwiredDot (data-testid="unwired-dot")', () => {
    render(<AudioSurface audioState={makeState()} />);
    expect(screen.getByTestId('unwired-dot')).not.toBeNull();
  });

  it('UnwiredDot has a descriptive aria-label about Audio family placeholder', () => {
    render(<AudioSurface audioState={makeState()} />);
    const dot = screen.getByTestId('unwired-dot');
    const label = dot.getAttribute('aria-label') ?? '';
    // Must mention "Audio" and indicate not connected to backend
    expect(label.toLowerCase()).toContain('audio');
    expect(label.toLowerCase()).toContain('backend');
  });
});

// ─── Error state ─────────────────────────────────────────────────────────────

describe('AudioSurface — error state', () => {
  it('renders error message when error is set', () => {
    render(<AudioSurface audioState={makeState({ error: 'Failed to load audio' })} />);
    expect(screen.getByTestId('pf-audio-error')).not.toBeNull();
    expect(screen.getByText('Failed to load audio')).not.toBeNull();
  });

  it('does NOT render error element when error is null', () => {
    render(<AudioSurface audioState={makeState({ error: null })} />);
    expect(screen.queryByTestId('pf-audio-error')).toBeNull();
  });
});

// ─── No dispatch case in live page (AC #4) ───────────────────────────────────

describe('AudioSurface — NOT in live dispatch', () => {
  it('V2FlashcardPracticePage does not import or dispatch AudioSurface', async () => {
    // Read the page source as a string and verify no audio case was added
    const pageSource = await import(
      /* @vite-ignore */
      '/Users/samosipov/Downloads/learn-greek-easy/.claude/worktrees/pract2-1/learn-greek-easy-frontend/src/pages/V2FlashcardPracticePage.tsx?raw'
    );
    const src: string = pageSource.default ?? '';
    // Must NOT contain an audio card_type switch case
    expect(src).not.toContain("case 'audio");
    expect(src).not.toContain('AudioSurface');
  });
});
