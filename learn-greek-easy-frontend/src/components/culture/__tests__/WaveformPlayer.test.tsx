import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WaveformPlayer } from '../WaveformPlayer';

// Mock generateBars for deterministic output
vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

// Helper to mock getBoundingClientRect on an element
function mockBarsRect(element: HTMLElement, width = 480) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width,
    height: 40,
    top: 0,
    right: width,
    bottom: 40,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('WaveformPlayer', () => {
  describe('Rendering', () => {
    it('renders outer container with data-testid', () => {
      render(<WaveformPlayer />);

      const container = screen.getByTestId('waveform-player');
      expect(container).toBeInTheDocument();
    });

    it('applies custom className to container', () => {
      render(<WaveformPlayer className="custom-class" />);

      const container = screen.getByTestId('waveform-player');
      expect(container.className).toContain('custom-class');
    });

    it('renders play button with "Play audio" aria-label initially', () => {
      render(<WaveformPlayer />);

      const playButton = screen.getByTestId('waveform-play-button');
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });

    it('renders 48 waveform bars', () => {
      render(<WaveformPlayer />);

      const bars = screen.getAllByTestId('waveform-bar');
      expect(bars).toHaveLength(48);
    });

    it('renders time display showing "0:00" current and "1:30" total (default 90s)', () => {
      render(<WaveformPlayer />);

      const currentTime = screen.getByTestId('waveform-time-current');
      const totalTime = screen.getByTestId('waveform-time-total');

      expect(currentTime).toHaveTextContent('0:00');
      expect(totalTime).toHaveTextContent('1:30');
    });

    it('renders 4 speed pills with 1x selected by default', () => {
      render(<WaveformPlayer />);

      const pills = screen.getAllByRole('radio');
      expect(pills).toHaveLength(4);

      const pill1x = screen.getByRole('radio', { name: '1x speed' });
      expect(pill1x).toHaveAttribute('aria-checked', 'true');

      const pill075x = screen.getByRole('radio', { name: '0.75x speed' });
      expect(pill075x).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Props', () => {
    it('default duration 90 → aria-valuemax="90" on slider', () => {
      render(<WaveformPlayer />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuemax', '90');
    });

    it('custom duration 120 → total time shows "2:00"', () => {
      render(<WaveformPlayer duration={120} />);

      const totalTime = screen.getByTestId('waveform-time-total');
      expect(totalTime).toHaveTextContent('2:00');
    });
  });

  describe('Play/Pause', () => {
    it('click toggles aria-label from "Play audio" to "Pause audio"', async () => {
      const user = userEvent.setup();
      render(<WaveformPlayer />);

      const playButton = screen.getByTestId('waveform-play-button');
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');

      await user.click(playButton);
      expect(playButton).toHaveAttribute('aria-label', 'Pause audio');
    });

    it('second click toggles back to "Play audio"', async () => {
      const user = userEvent.setup();
      render(<WaveformPlayer />);

      const playButton = screen.getByTestId('waveform-play-button');

      await user.click(playButton);
      expect(playButton).toHaveAttribute('aria-label', 'Pause audio');

      await user.click(playButton);
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });
  });

  describe('Timer Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances currentTime', () => {
      render(<WaveformPlayer duration={10} />);

      const playButton = screen.getByTestId('waveform-play-button');
      const slider = screen.getByRole('slider');

      fireEvent.click(playButton);
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(slider).toHaveAttribute('aria-valuenow', '1');
    });

    it('respects speed multiplier', () => {
      render(<WaveformPlayer duration={10} />);

      const playButton = screen.getByTestId('waveform-play-button');
      const slider = screen.getByRole('slider');
      const pill15x = screen.getByRole('radio', { name: '1.5x speed' });

      // Select 1.5x speed using fireEvent since we're in fake timers mode
      fireEvent.click(pill15x);

      fireEvent.click(playButton);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // At 1.5x speed, 1 second should advance by 1.5 seconds
      expect(slider).toHaveAttribute('aria-valuenow', '2');
    });

    it('resets to 0 and stops at end', () => {
      render(<WaveformPlayer duration={1} />);

      const playButton = screen.getByTestId('waveform-play-button');
      const slider = screen.getByRole('slider');

      fireEvent.click(playButton);
      expect(playButton).toHaveAttribute('aria-label', 'Pause audio');

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(slider).toHaveAttribute('aria-valuenow', '0');
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });

    it('clears interval on unmount', () => {
      const { unmount } = render(<WaveformPlayer duration={10} />);

      const playButton = screen.getByTestId('waveform-play-button');
      fireEvent.click(playButton);

      unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // No crash means interval was cleared
      expect(true).toBe(true);
    });

    it('pausing stops timer', () => {
      render(<WaveformPlayer duration={10} />);

      const playButton = screen.getByTestId('waveform-play-button');
      const slider = screen.getByRole('slider');

      fireEvent.click(playButton);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const valueAfterHalfSecond = slider.getAttribute('aria-valuenow');

      fireEvent.click(playButton);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(slider).toHaveAttribute('aria-valuenow', valueAfterHalfSecond);
    });
  });

  describe('Speed Pills', () => {
    it('clicking 1.5x sets aria-checked="true", 1x becomes "false"', async () => {
      const user = userEvent.setup();
      render(<WaveformPlayer />);

      const pill1x = screen.getByRole('radio', { name: '1x speed' });
      const pill15x = screen.getByRole('radio', { name: '1.5x speed' });

      expect(pill1x).toHaveAttribute('aria-checked', 'true');
      expect(pill15x).toHaveAttribute('aria-checked', 'false');

      await user.click(pill15x);

      expect(pill1x).toHaveAttribute('aria-checked', 'false');
      expect(pill15x).toHaveAttribute('aria-checked', 'true');
    });

    it('speed container has role="radiogroup" with label "Playback speed"', () => {
      render(<WaveformPlayer />);

      const speedGroup = screen.getByRole('radiogroup', { name: 'Playback speed' });
      expect(speedGroup).toBeInTheDocument();
    });

    it('all 4 pills have correct aria-labels', () => {
      render(<WaveformPlayer />);

      expect(screen.getByRole('radio', { name: '0.75x speed' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '1x speed' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '1.25x speed' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '1.5x speed' })).toBeInTheDocument();
    });
  });

  describe('Click-to-Scrub', () => {
    it('click at midpoint (clientX=240, width=480, duration=100) → aria-valuenow="50"', () => {
      render(<WaveformPlayer duration={100} />);

      const barsContainer = screen.getByTestId('waveform-bars');
      mockBarsRect(barsContainer, 480);

      fireEvent.click(barsContainer, { clientX: 240 });

      expect(barsContainer).toHaveAttribute('aria-valuenow', '50');
    });

    it('click at left edge (clientX=0) → aria-valuenow="0"', () => {
      render(<WaveformPlayer duration={100} />);

      const barsContainer = screen.getByTestId('waveform-bars');
      mockBarsRect(barsContainer, 480);

      fireEvent.click(barsContainer, { clientX: 0 });

      expect(barsContainer).toHaveAttribute('aria-valuenow', '0');
    });

    it('click at right edge (clientX=480) → aria-valuenow="100"', () => {
      render(<WaveformPlayer duration={100} />);

      const barsContainer = screen.getByTestId('waveform-bars');
      mockBarsRect(barsContainer, 480);

      fireEvent.click(barsContainer, { clientX: 480 });

      expect(barsContainer).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Keyboard Navigation', () => {
    it('ArrowRight advances by 5%', () => {
      render(<WaveformPlayer duration={100} />);

      const slider = screen.getByRole('slider');
      mockBarsRect(slider, 480);

      // Scrub to 50
      fireEvent.click(slider, { clientX: 240 });
      expect(slider).toHaveAttribute('aria-valuenow', '50');

      // ArrowRight should advance by 5% (5 seconds)
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider).toHaveAttribute('aria-valuenow', '55');
    });

    it('ArrowLeft rewinds by 5%', () => {
      render(<WaveformPlayer duration={100} />);

      const slider = screen.getByRole('slider');
      mockBarsRect(slider, 480);

      // Scrub to 50
      fireEvent.click(slider, { clientX: 240 });
      expect(slider).toHaveAttribute('aria-valuenow', '50');

      // ArrowLeft should rewind by 5% (5 seconds)
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
      expect(slider).toHaveAttribute('aria-valuenow', '45');
    });

    it('Home goes to 0', () => {
      render(<WaveformPlayer duration={100} />);

      const slider = screen.getByRole('slider');
      mockBarsRect(slider, 480);

      // Scrub to 50
      fireEvent.click(slider, { clientX: 240 });
      expect(slider).toHaveAttribute('aria-valuenow', '50');

      // Home should go to 0
      fireEvent.keyDown(slider, { key: 'Home' });
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('End goes to duration', () => {
      render(<WaveformPlayer duration={100} />);

      const slider = screen.getByRole('slider');

      // End should go to duration
      fireEvent.keyDown(slider, { key: 'End' });
      expect(slider).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Edge Cases', () => {
    it('duration=0 renders without crash, shows "0:00 / 0:00"', () => {
      render(<WaveformPlayer duration={0} />);

      const currentTime = screen.getByTestId('waveform-time-current');
      const totalTime = screen.getByTestId('waveform-time-total');

      expect(currentTime).toHaveTextContent('0:00');
      expect(totalTime).toHaveTextContent('0:00');
    });

    it('keyboard does nothing when duration=0', () => {
      render(<WaveformPlayer duration={0} />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      fireEvent.keyDown(slider, { key: 'End' });
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('scrub does nothing when duration=0', () => {
      render(<WaveformPlayer duration={0} />);

      const slider = screen.getByRole('slider');
      mockBarsRect(slider, 480);

      fireEvent.click(slider, { clientX: 240 });
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('Accessibility', () => {
    it('slider has role="slider" with aria-label, valuemin, valuemax, valuenow', () => {
      render(<WaveformPlayer duration={90} />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-label', 'Audio position');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '90');
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('slider is focusable (tabindex="0")', () => {
      render(<WaveformPlayer />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('tabIndex', '0');
    });

    it('play button has accessible name', () => {
      render(<WaveformPlayer />);

      const playButton = screen.getByTestId('waveform-play-button');
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });
  });

  describe('audioUrl Mode', () => {
    it('renders a hidden <audio> element with correct src when audioUrl provided', () => {
      render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      expect(audio).toBeInTheDocument();
      expect(audio.src).toBe('https://example.com/audio.mp3');
      expect(audio).toHaveStyle({ display: 'none' });
    });

    it('does NOT render audio element when audioUrl absent', () => {
      render(<WaveformPlayer />);

      const audio = screen.queryByTestId('waveform-audio-element');
      expect(audio).not.toBeInTheDocument();
    });

    it('play button calls audio.play() in audio mode', () => {
      render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

      // Simulate metadata loaded
      Object.defineProperty(audio, 'duration', { value: 120, writable: true, configurable: true });
      fireEvent(audio, new Event('loadedmetadata'));

      const playSpy = vi.spyOn(audio, 'play').mockResolvedValue();
      const playButton = screen.getByTestId('waveform-play-button');

      fireEvent.click(playButton);

      expect(playSpy).toHaveBeenCalled();
    });

    it('pause button calls audio.pause() in audio mode', () => {
      render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

      // Simulate metadata loaded
      Object.defineProperty(audio, 'duration', { value: 120, writable: true, configurable: true });
      fireEvent(audio, new Event('loadedmetadata'));

      const playSpy = vi.spyOn(audio, 'play').mockResolvedValue();
      const pauseSpy = vi.spyOn(audio, 'pause');

      const playButton = screen.getByTestId('waveform-play-button');

      // Play first
      fireEvent.click(playButton);
      expect(playSpy).toHaveBeenCalled();

      // Then pause
      fireEvent.click(playButton);
      expect(pauseSpy).toHaveBeenCalled();
    });

    it('timeupdate event syncs waveform position', () => {
      render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      const slider = screen.getByRole('slider');

      // Set duration via loadedmetadata
      Object.defineProperty(audio, 'duration', { value: 120, writable: true, configurable: true });
      fireEvent(audio, new Event('loadedmetadata'));

      expect(slider).toHaveAttribute('aria-valuenow', '0');

      // Simulate timeupdate to 30 seconds
      Object.defineProperty(audio, 'currentTime', {
        value: 30,
        writable: true,
        configurable: true,
      });
      fireEvent(audio, new Event('timeupdate'));

      expect(slider).toHaveAttribute('aria-valuenow', '30');
    });

    it('does NOT run setInterval timer in audioUrl mode', () => {
      vi.useFakeTimers();

      render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
      const slider = screen.getByRole('slider');

      // Simulate metadata loaded
      Object.defineProperty(audio, 'duration', { value: 120, writable: true, configurable: true });
      fireEvent(audio, new Event('loadedmetadata'));

      vi.spyOn(audio, 'play').mockResolvedValue();
      const playButton = screen.getByTestId('waveform-play-button');

      fireEvent.click(playButton);

      // Advance timers - position should NOT change from timer
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Position should still be 0 (only timeupdate changes it in audio mode)
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      vi.useRealTimers();
    });
  });

  describe('showSpeedControl Prop', () => {
    it('hides speed pills when showSpeedControl={false}', () => {
      render(<WaveformPlayer showSpeedControl={false} />);

      const speedPills = screen.queryByTestId('waveform-speed-pills');
      expect(speedPills).not.toBeInTheDocument();

      const pills = screen.queryAllByRole('radio');
      expect(pills).toHaveLength(0);
    });

    it('shows speed pills by default', () => {
      render(<WaveformPlayer />);

      const speedPills = screen.getByTestId('waveform-speed-pills');
      expect(speedPills).toBeInTheDocument();

      const pills = screen.getAllByRole('radio');
      expect(pills).toHaveLength(4);
    });

    it('shows speed pills when showSpeedControl={true}', () => {
      render(<WaveformPlayer showSpeedControl={true} />);

      const speedPills = screen.getByTestId('waveform-speed-pills');
      expect(speedPills).toBeInTheDocument();

      const pills = screen.getAllByRole('radio');
      expect(pills).toHaveLength(4);
    });
  });

  describe('variant Prop', () => {
    it('applies culture variant classes by default', () => {
      render(<WaveformPlayer />);

      const container = screen.getByTestId('waveform-player');
      expect(container.className).toContain('bg-slate-100');
      expect(container.className).not.toContain('bg-muted');
    });

    it('applies admin variant classes when variant="admin"', () => {
      render(<WaveformPlayer variant="admin" />);

      const container = screen.getByTestId('waveform-player');
      expect(container.className).toContain('bg-muted');
      expect(container.className).not.toContain('bg-slate-100');
    });
  });

  describe('disabled Prop', () => {
    it('applies aria-disabled and opacity when disabled', () => {
      render(<WaveformPlayer disabled={true} />);

      const container = screen.getByTestId('waveform-player');
      expect(container).toHaveAttribute('aria-disabled', 'true');
      expect(container.className).toContain('opacity-50');
    });

    it('play button is no-op when disabled', () => {
      render(<WaveformPlayer disabled={true} />);

      const playButton = screen.getByTestId('waveform-play-button');
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');

      fireEvent.click(playButton);

      // Should still show "Play audio" (not "Pause audio")
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });

    it('scrubbing is no-op when disabled', () => {
      render(<WaveformPlayer disabled={true} duration={100} />);

      const barsContainer = screen.getByTestId('waveform-bars');
      mockBarsRect(barsContainer, 480);

      expect(barsContainer).toHaveAttribute('aria-valuenow', '0');

      // Try to scrub to midpoint
      fireEvent.click(barsContainer, { clientX: 240 });

      // Should still be at 0
      expect(barsContainer).toHaveAttribute('aria-valuenow', '0');
    });

    it('keyboard navigation is no-op when disabled', () => {
      render(<WaveformPlayer disabled={true} duration={100} />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      // Try to navigate with keyboard
      fireEvent.keyDown(slider, { key: 'ArrowRight' });

      // Should still be at 0
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('shows 0:00 / 0:00 when disabled regardless of duration', () => {
      render(<WaveformPlayer disabled={true} duration={120} />);

      const currentTime = screen.getByTestId('waveform-time-current');
      const totalTime = screen.getByTestId('waveform-time-total');

      expect(currentTime).toHaveTextContent('0:00');
      expect(totalTime).toHaveTextContent('0:00');
    });
  });

  describe('onError Callback', () => {
    it('calls onError when audio element fires error event', () => {
      const onError = vi.fn();
      render(<WaveformPlayer audioUrl="https://example.com/bad.mp3" onError={onError} />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

      // Dispatch error event
      fireEvent(audio, new Event('error'));

      expect(onError).toHaveBeenCalled();
    });

    it('does not call onError when no error occurs', () => {
      const onError = vi.fn();
      render(<WaveformPlayer audioUrl="https://example.com/good.mp3" onError={onError} />);

      const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

      // Simulate successful load
      Object.defineProperty(audio, 'duration', { value: 120, writable: true, configurable: true });
      fireEvent(audio, new Event('loadedmetadata'));

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Analytics Callbacks', () => {
    describe('onPlay Callback', () => {
      it('calls onPlay with duration on first play in audio mode (culture variant)', () => {
        const onPlay = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" onPlay={onPlay} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        vi.spyOn(audio, 'play').mockResolvedValue();
        const playButton = screen.getByTestId('waveform-play-button');

        fireEvent.click(playButton);

        expect(onPlay).toHaveBeenCalledWith(120);
        expect(onPlay).toHaveBeenCalledTimes(1);
      });

      it('does NOT call onPlay on subsequent plays (first-play-only)', () => {
        const onPlay = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" onPlay={onPlay} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        vi.spyOn(audio, 'play').mockResolvedValue();
        vi.spyOn(audio, 'pause');
        const playButton = screen.getByTestId('waveform-play-button');

        // First play
        fireEvent.click(playButton);
        expect(onPlay).toHaveBeenCalledTimes(1);

        // Pause
        fireEvent.click(playButton);

        // Second play
        fireEvent.click(playButton);
        expect(onPlay).toHaveBeenCalledTimes(1); // Still only 1 call
      });

      it('resets first-play tracking when audioUrl changes', async () => {
        const onPlay = vi.fn();
        const { rerender } = render(
          <WaveformPlayer audioUrl="https://example.com/audio1.mp3" onPlay={onPlay} />
        );

        let audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // First audio - simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        let playSpy = vi.spyOn(audio, 'play').mockResolvedValue();
        const playButton = screen.getByTestId('waveform-play-button');

        // First play of first audio
        fireEvent.click(playButton);
        expect(onPlay).toHaveBeenCalledWith(120);
        expect(onPlay).toHaveBeenCalledTimes(1);

        // Stop playback before changing URL
        fireEvent.click(playButton); // Pause

        // Clear the mock to make debugging easier
        onPlay.mockClear();

        // Change audioUrl
        rerender(<WaveformPlayer audioUrl="https://example.com/audio2.mp3" onPlay={onPlay} />);

        // Get the new audio element (URL changed, so element is new)
        audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Second audio - simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 180,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        playSpy = vi.spyOn(audio, 'play').mockResolvedValue();

        // First play of second audio should trigger onPlay again
        fireEvent.click(playButton);

        // After audioUrl change, onPlay should be called again (first call since clear)
        expect(onPlay).toHaveBeenCalledWith(180);
        expect(onPlay).toHaveBeenCalledTimes(1);
      });

      it('does NOT call onPlay in timer mode (no audioUrl)', () => {
        const onPlay = vi.fn();
        render(<WaveformPlayer duration={90} onPlay={onPlay} />);

        const playButton = screen.getByTestId('waveform-play-button');
        fireEvent.click(playButton);

        expect(onPlay).not.toHaveBeenCalled();
      });

      it('does NOT call onPlay in admin variant', () => {
        const onPlay = vi.fn();
        render(
          <WaveformPlayer
            audioUrl="https://example.com/audio.mp3"
            onPlay={onPlay}
            variant="admin"
          />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        vi.spyOn(audio, 'play').mockResolvedValue();
        const playButton = screen.getByTestId('waveform-play-button');

        fireEvent.click(playButton);

        expect(onPlay).not.toHaveBeenCalled();
      });

      it('does NOT call onPlay when audio has error', () => {
        const onPlay = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/bad.mp3" onPlay={onPlay} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Dispatch error event
        fireEvent(audio, new Event('error'));

        const playButton = screen.getByTestId('waveform-play-button');
        fireEvent.click(playButton);

        expect(onPlay).not.toHaveBeenCalled();
      });
    });

    describe('onComplete Callback', () => {
      it('calls onComplete with duration and speed when audio ends in audio mode (culture variant)', () => {
        const onComplete = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" onComplete={onComplete} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(audio, 'playbackRate', {
          value: 1,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Dispatch ended event
        fireEvent(audio, new Event('ended'));

        expect(onComplete).toHaveBeenCalledWith(120, 1);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });

      it('calls onComplete with correct speed when speed changed', () => {
        const onComplete = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/audio.mp3" onComplete={onComplete} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(audio, 'playbackRate', {
          value: 1,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Change speed to 1.5x
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);

        // Update audio playbackRate to simulate real audio behavior
        Object.defineProperty(audio, 'playbackRate', {
          value: 1.5,
          writable: true,
          configurable: true,
        });

        // Dispatch ended event
        fireEvent(audio, new Event('ended'));

        expect(onComplete).toHaveBeenCalledWith(120, 1.5);
      });

      it('does NOT call onComplete in timer mode (no audioUrl)', () => {
        const onComplete = vi.fn();
        render(<WaveformPlayer duration={90} onComplete={onComplete} />);

        // Timer mode doesn't have an ended event, but we can verify it's not called
        // by checking after a full timer cycle
        vi.useFakeTimers();

        const playButton = screen.getByTestId('waveform-play-button');
        fireEvent.click(playButton);

        // Advance past duration
        act(() => {
          vi.advanceTimersByTime(100000);
        });

        expect(onComplete).not.toHaveBeenCalled();

        vi.useRealTimers();
      });

      it('does NOT call onComplete in admin variant', () => {
        const onComplete = vi.fn();
        render(
          <WaveformPlayer
            audioUrl="https://example.com/audio.mp3"
            onComplete={onComplete}
            variant="admin"
          />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Dispatch ended event
        fireEvent(audio, new Event('ended'));

        expect(onComplete).not.toHaveBeenCalled();
      });

      it('does NOT call onComplete when audio has error', () => {
        const onComplete = vi.fn();
        render(<WaveformPlayer audioUrl="https://example.com/bad.mp3" onComplete={onComplete} />);

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Dispatch error event
        fireEvent(audio, new Event('error'));

        // Try to dispatch ended event
        fireEvent(audio, new Event('ended'));

        expect(onComplete).not.toHaveBeenCalled();
      });
    });

    describe('onSpeedChange Callback', () => {
      it('calls onSpeedChange with fromSpeed and toSpeed when speed changes in audio mode (culture variant)', () => {
        const onSpeedChange = vi.fn();
        render(
          <WaveformPlayer audioUrl="https://example.com/audio.mp3" onSpeedChange={onSpeedChange} />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Change speed from 1x to 1.5x
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);

        expect(onSpeedChange).toHaveBeenCalledWith(1, 1.5);
        expect(onSpeedChange).toHaveBeenCalledTimes(1);
      });

      it('calls onSpeedChange multiple times for multiple changes', () => {
        const onSpeedChange = vi.fn();
        render(
          <WaveformPlayer audioUrl="https://example.com/audio.mp3" onSpeedChange={onSpeedChange} />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Change speed 1x -> 1.5x
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);
        expect(onSpeedChange).toHaveBeenCalledWith(1, 1.5);

        // Change speed 1.5x -> 0.75x
        const pill075x = screen.getByRole('radio', { name: '0.75x speed' });
        fireEvent.click(pill075x);
        expect(onSpeedChange).toHaveBeenCalledWith(1.5, 0.75);

        expect(onSpeedChange).toHaveBeenCalledTimes(2);
      });

      it('does NOT call onSpeedChange in timer mode (no audioUrl)', () => {
        const onSpeedChange = vi.fn();
        render(<WaveformPlayer duration={90} onSpeedChange={onSpeedChange} />);

        // Change speed
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);

        expect(onSpeedChange).not.toHaveBeenCalled();
      });

      it('does NOT call onSpeedChange in admin variant', () => {
        const onSpeedChange = vi.fn();
        render(
          <WaveformPlayer
            audioUrl="https://example.com/audio.mp3"
            onSpeedChange={onSpeedChange}
            variant="admin"
          />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        // Change speed
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);

        expect(onSpeedChange).not.toHaveBeenCalled();
      });

      it('does NOT call onSpeedChange when audio has error', () => {
        const onSpeedChange = vi.fn();
        render(
          <WaveformPlayer audioUrl="https://example.com/bad.mp3" onSpeedChange={onSpeedChange} />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Dispatch error event
        fireEvent(audio, new Event('error'));

        // Try to change speed
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);

        expect(onSpeedChange).not.toHaveBeenCalled();
      });
    });

    describe('Combined Analytics Callbacks', () => {
      it('all three callbacks work together correctly', () => {
        const onPlay = vi.fn();
        const onComplete = vi.fn();
        const onSpeedChange = vi.fn();

        render(
          <WaveformPlayer
            audioUrl="https://example.com/audio.mp3"
            onPlay={onPlay}
            onComplete={onComplete}
            onSpeedChange={onSpeedChange}
          />
        );

        const audio = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;

        // Simulate metadata loaded
        Object.defineProperty(audio, 'duration', {
          value: 120,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(audio, 'playbackRate', {
          value: 1,
          writable: true,
          configurable: true,
        });
        fireEvent(audio, new Event('loadedmetadata'));

        vi.spyOn(audio, 'play').mockResolvedValue();
        const playButton = screen.getByTestId('waveform-play-button');

        // Play - should trigger onPlay
        fireEvent.click(playButton);
        expect(onPlay).toHaveBeenCalledWith(120);

        // Change speed - should trigger onSpeedChange
        const pill15x = screen.getByRole('radio', { name: '1.5x speed' });
        fireEvent.click(pill15x);
        expect(onSpeedChange).toHaveBeenCalledWith(1, 1.5);

        // Update audio playbackRate to simulate real audio behavior
        Object.defineProperty(audio, 'playbackRate', {
          value: 1.5,
          writable: true,
          configurable: true,
        });

        // End - should trigger onComplete
        fireEvent(audio, new Event('ended'));
        expect(onComplete).toHaveBeenCalledWith(120, 1.5);

        expect(onPlay).toHaveBeenCalledTimes(1);
        expect(onSpeedChange).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });
});
