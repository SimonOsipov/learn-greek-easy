import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
}

export function useAudioPlayer(audioUrl: string | null | undefined): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef({ isPlaying: false });
  const urlRef = useRef<string | null | undefined>(audioUrl);

  // Update refs synchronously during render so callbacks always read current values
  stateRef.current.isPlaying = isPlaying;
  urlRef.current = audioUrl;

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

  return { isPlaying, isLoading, error, play, pause, toggle };
}
