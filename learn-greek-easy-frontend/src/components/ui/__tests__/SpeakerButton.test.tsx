/**
 * SpeakerButton Component Tests
 */

import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { render, screen } from '@/lib/test-utils';

vi.mock('@/hooks/useAudioPlayer');

const mockDefaultReturn = {
  isPlaying: false,
  isLoading: false,
  error: null as string | null,
  play: vi.fn(),
  pause: vi.fn(),
  toggle: vi.fn(),
  speed: 1 as const,
  setSpeed: vi.fn(),
};

beforeEach(() => {
  vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn });
});

describe('SpeakerButton', () => {
  it('1. does not render when audioUrl is null', () => {
    render(<SpeakerButton audioUrl={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('2. does not render when audioUrl is undefined', () => {
    render(<SpeakerButton audioUrl={undefined} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('3. renders a button with Volume2 icon when audioUrl provided', () => {
    const { container } = render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
  });

  it('4. aria-label is "Play audio" in idle state', () => {
    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument();
  });

  it('5. clicking the button calls toggle', async () => {
    const mockToggle = vi.fn();
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, toggle: mockToggle });
    const user = userEvent.setup();

    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    await user.click(screen.getByRole('button'));

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('6. aria-label is "Pause audio" when isPlaying is true', () => {
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, isPlaying: true });

    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    expect(screen.getByRole('button', { name: 'Pause audio' })).toBeInTheDocument();
  });

  it('7. shows Loader2 spinner during loading', () => {
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, isLoading: true });
    const { container } = render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    // Volume2 icon should not be rendered inside the play button during loading
    const playButton = screen.getByRole('button', { name: 'Loading audio' });
    expect(playButton.querySelector('.text-muted-foreground')).not.toBeInTheDocument();
  });

  it('8. aria-label is "Loading audio" during loading', () => {
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, isLoading: true });

    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    expect(screen.getByRole('button', { name: 'Loading audio' })).toBeInTheDocument();
  });

  it('9. fires onPlay callback when isPlaying transitions false→true', () => {
    const onPlay = vi.fn();
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, isPlaying: false });

    const { rerender } = render(
      <SpeakerButton audioUrl="https://example.com/audio.mp3" onPlay={onPlay} />
    );
    expect(onPlay).not.toHaveBeenCalled();

    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, isPlaying: true });
    rerender(<SpeakerButton audioUrl="https://example.com/audio.mp3" onPlay={onPlay} />);

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('10. fires onError callback when error appears', () => {
    const onError = vi.fn();
    vi.mocked(useAudioPlayer).mockReturnValue({ ...mockDefaultReturn, error: null });

    const { rerender } = render(
      <SpeakerButton audioUrl="https://example.com/audio.mp3" onError={onError} />
    );
    expect(onError).not.toHaveBeenCalled();

    vi.mocked(useAudioPlayer).mockReturnValue({
      ...mockDefaultReturn,
      error: 'Network error',
    });
    rerender(<SpeakerButton audioUrl="https://example.com/audio.mp3" onError={onError} />);

    expect(onError).toHaveBeenCalledWith('Network error');
  });

  it('11. click calls stopPropagation — parent onClick not called', async () => {
    const parentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div role="presentation" onClick={parentClick}>
        <SpeakerButton audioUrl="https://example.com/audio.mp3" />
      </div>
    );
    await user.click(screen.getByRole('button'));

    expect(parentClick).not.toHaveBeenCalled();
  });

  it('12. default size renders button with h-10 w-10 classes', () => {
    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-10');
    expect(button.className).toContain('w-10');
  });

  it('13. sm size renders button with h-9 class', () => {
    render(<SpeakerButton audioUrl="https://example.com/audio.mp3" size="sm" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-9');
  });
});
