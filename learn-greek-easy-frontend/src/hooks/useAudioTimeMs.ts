import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks audio playback time in milliseconds via requestAnimationFrame.
 *
 * Queries for `[data-testid="waveform-audio-element"]` inside the given container,
 * then polls `audio.currentTime` at ~60fps while audio is playing.
 *
 * Returns 0 when disabled or when audio is not playing.
 */
export function useAudioTimeMs(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
): number {
  const [audioCurrentTimeMs, setAudioCurrentTimeMs] = useState(0);

  // Reset to 0 when disabled
  useEffect(() => {
    if (!enabled) {
      setAudioCurrentTimeMs(0);
    }
  }, [enabled]);

  // rAF polling loop
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const audio = container.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    if (!audio) return;

    let rafId: number | null = null;
    let lastUpdateMs = 0;

    const tick = () => {
      const nowMs = audio.currentTime * 1000;
      if (Math.abs(nowMs - lastUpdateMs) > 10) {
        setAudioCurrentTimeMs(nowMs);
        lastUpdateMs = nowMs;
      }
      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const syncCurrentTime = () => {
      const nowMs = audio.currentTime * 1000;
      setAudioCurrentTimeMs(nowMs);
      lastUpdateMs = nowMs;
    };

    audio.addEventListener('play', startLoop);
    audio.addEventListener('pause', stopLoop);
    audio.addEventListener('ended', stopLoop);
    audio.addEventListener('seeked', syncCurrentTime);

    if (!audio.paused) {
      startLoop();
    }

    return () => {
      stopLoop();
      audio.removeEventListener('play', startLoop);
      audio.removeEventListener('pause', stopLoop);
      audio.removeEventListener('ended', stopLoop);
      audio.removeEventListener('seeked', syncCurrentTime);
    };
  }, [containerRef, enabled]);

  return audioCurrentTimeMs;
}
