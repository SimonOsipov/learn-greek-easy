/**
 * AudioPlayer — play/pause button + waveform bars + duration (MOB-08).
 *
 * Uses expo-audio for native playback. The waveform is a static bar pattern
 * that animates (bars pulse) when playing, collapses to near-zero when
 * reduced motion is enabled.
 *
 * Bar colours: left portion (played) = primary, right = fg-3 at 35% opacity.
 * Primary is hsl(221 83% 53%) = rgb(36,99,235). No /NN modifier — MOB-13.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { formatDuration } from '@/lib/situations/presentation';

// MOB-13: explicit rgba — no /NN modifier on var-backed tokens
const PRIMARY_COLOR = 'rgb(36,99,235)';   // --primary hsl(221 83% 53%)
const WAVE_MUTED    = 'rgba(100,116,139,0.35)'; // --fg-3 at 35% alpha

/** Waveform bar heights (0–10 scale, 35 bars). Same pattern as the handoff mock. */
const WAVE_HEIGHTS = [3, 5, 6, 8, 7, 9, 6, 7, 5, 4, 6, 8, 9, 7, 5, 4, 6, 7, 8, 6, 5, 4, 3, 5, 7, 8, 6, 4, 3, 5, 7, 6, 5, 4, 3];

export interface AudioPlayerProps {
  audioUrl: string | null;
  durationSeconds: number | null;
  testID?: string;
}

export function AudioPlayer({ audioUrl, durationSeconds, testID }: AudioPlayerProps) {
  const reduceMotion = useReducedMotion();
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const player = useAudioPlayer(audioUrl ?? '');
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Start/stop pulse animation when playing state changes
  useEffect(() => {
    if (isPlaying && !reduceMotion) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoop.current?.stop();
    };
  }, [isPlaying, reduceMotion, pulseAnim]);

  // Track elapsed time via polling
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setElapsed(Math.floor(player.currentTime ?? 0));
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, player]);

  const handleToggle = useCallback(() => {
    if (!audioUrl) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      void player.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying, player]);

  // Playback progress ratio (0–1)
  const total = durationSeconds ?? 0;
  const progressRatio = total > 0 ? Math.min(elapsed / total, 1) : 0;
  const playedBars = Math.floor(progressRatio * WAVE_HEIGHTS.length);

  const displayTime = isPlaying
    ? formatDuration(elapsed)
    : formatDuration(durationSeconds);

  return (
    <View
      testID={testID ?? 'audio-player'}
      className="flex-row items-center gap-3 p-3.5 rounded-[14px] bg-card border border-line"
    >
      {/* Play / pause button */}
      <Pressable
        testID="audio-player-toggle"
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        onPress={handleToggle}
        className="w-11 h-11 rounded-full bg-primary items-center justify-center active:opacity-70"
        style={{ flexShrink: 0 }}
      >
        {isPlaying ? (
          <Pause size={18} color="#fff" fill="#fff" />
        ) : (
          <Play size={18} color="#fff" fill="#fff" />
        )}
      </Pressable>

      {/* Waveform bars */}
      <View
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 36 }}
      >
        {WAVE_HEIGHTS.map((v, i) => {
          const barPlayed = i < playedBars;
          const barHeight = reduceMotion ? Math.min(v, 4) : v;

          return (
            <Animated.View
              key={i}
              style={{
                width: 3,
                height: `${(barHeight / 10) * 100}%`,
                minHeight: 3,
                borderRadius: 2,
                backgroundColor: barPlayed ? PRIMARY_COLOR : WAVE_MUTED,
                transform: isPlaying && !reduceMotion ? [{ scaleY: pulseAnim }] : [],
              }}
            />
          );
        })}
      </View>

      {/* Duration label */}
      <Text
        testID="audio-player-duration"
        className="text-fg2 text-[12px] font-bold"
        style={{ fontFamily: 'SpaceMono_400Regular', flexShrink: 0 }}
      >
        {displayTime}
      </Text>
    </View>
  );
}
