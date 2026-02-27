import { useCallback, useEffect, useRef, useState } from 'react';

import { AudioSpeed, getPersistedAudioSpeed, setPersistedAudioSpeed } from '@/utils/audioSpeed';

export type { AudioSpeed } from '@/utils/audioSpeed';

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  speed: AudioSpeed;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: AudioSpeed) => void;
}

export function useAudioPlayer(audioUrl: string | null | undefined): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeedState] = useState<AudioSpeed>(getPersistedAudioSpeed);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef({ isPlaying: false });
  const urlRef = useRef<string | null | undefined>(audioUrl);
  const speedRef = useRef<AudioSpeed>(speed);

  // Update refs synchronously during render so callbacks always read current values
  stateRef.current.isPlaying = isPlaying;
  urlRef.current = audioUrl;
  speedRef.current = speed;

  const play = useCallback(() => {
    const url = urlRef.current;
    if (!url) return;

    setError(null);
    setIsLoading(true);

    if (!audioRef.current) {
      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audioRef.current = audio;
    }

    audioRef.current.playbackRate = speedRef.current;

    audioRef.current
      .play()
      .then(() => {
        setIsLoading(false);
        setIsPlaying(true);
      })
      .catch((err: Error) => {
        setIsLoading(false);
        setIsPlaying(false);
        setError(err.message || 'Failed to play audio');
      });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (stateRef.current.isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      const url = urlRef.current;
      if (!url) return;

      setError(null);
      setIsLoading(true);

      if (!audioRef.current) {
        const audio = new Audio(url);
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
        });
        audioRef.current = audio;
      }

      audioRef.current.playbackRate = speedRef.current;

      audioRef.current
        .play()
        .then(() => {
          setIsLoading(false);
          setIsPlaying(true);
        })
        .catch((err: Error) => {
          setIsLoading(false);
          setIsPlaying(false);
          setError(err.message || 'Failed to play audio');
        });
    }
  }, []);

  const setSpeed = useCallback((s: AudioSpeed) => {
    setSpeedState(s);
    setPersistedAudioSpeed(s);
    if (stateRef.current.isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = s;
      audioRef.current.play().catch(() => {
        // ignore replay errors
      });
    } else if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  }, []);

  // Reset when audioUrl changes
  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
    setIsLoading(false);
    setError(null);
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return { isPlaying, isLoading, error, speed, play, pause, toggle, setSpeed };
}
