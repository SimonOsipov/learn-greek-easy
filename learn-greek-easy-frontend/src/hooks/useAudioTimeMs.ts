import { useEffect, useState } from 'react';

/**
 * Tracks audio playback time in milliseconds via requestAnimationFrame.
 *
 * Queries for `[data-testid="waveform-audio-element"]` inside the given container,
 * then polls `audio.currentTime` at ~60fps while audio is playing.
 *
 * Accepts `HTMLElement | null` directly (NOT a RefObject) so the effect re-runs
 * when the container mounts/unmounts (e.g. when switching tabs).
 * Consumers should use a callback ref via `useState` + `ref={setContainer}`.
 *
 * Returns 0 when disabled or when audio is not playing.
 */
export function useAudioTimeMs(container: HTMLElement | null, enabled: boolean): number {
  const [audioCurrentTimeMs, setAudioCurrentTimeMs] = useState(0);

  // Reset to 0 when disabled
  useEffect(() => {
    if (!enabled) {
      setAudioCurrentTimeMs(0);
    }
  }, [enabled]);

  // rAF polling loop
  useEffect(() => {
    if (!enabled || !container) return;

    let rafId: number | null = null;
    let lastUpdateMs = 0;
    let audio: HTMLAudioElement | null = null;
    let observer: MutationObserver | null = null;

    const tick = () => {
      if (!audio) return;
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
      if (!audio) return;
      const nowMs = audio.currentTime * 1000;
      setAudioCurrentTimeMs(nowMs);
      lastUpdateMs = nowMs;
    };

    const handleEnded = () => {
      syncCurrentTime();
      stopLoop();
    };

    const attachToAudio = (el: HTMLAudioElement) => {
      audio = el;
      audio.addEventListener('play', startLoop);
      audio.addEventListener('pause', stopLoop);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('seeked', syncCurrentTime);
      if (!audio.paused) {
        startLoop();
      }
    };

    const detachFromAudio = () => {
      if (audio) {
        stopLoop();
        audio.removeEventListener('play', startLoop);
        audio.removeEventListener('pause', stopLoop);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('seeked', syncCurrentTime);
        audio = null;
      }
    };

    // Try to find audio element immediately
    const found = container.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    if (found) {
      attachToAudio(found);
    } else {
      // Audio element not yet in DOM — observe for it
      observer = new MutationObserver(() => {
        const el = container.querySelector<HTMLAudioElement>(
          '[data-testid="waveform-audio-element"]'
        );
        if (el) {
          observer?.disconnect();
          observer = null;
          attachToAudio(el);
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      detachFromAudio();
      observer?.disconnect();
    };
  }, [container, enabled]);

  return audioCurrentTimeMs;
}
