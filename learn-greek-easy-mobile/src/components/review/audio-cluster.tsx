/**
 * AudioCluster — speed toggle pill + speaker button for the card-review screen (MOB-09).
 *
 * - Speed cycles: 0.5 → 0.75 → 1× on each press.
 * - Speaker plays the audio at the current speed using expo-audio.
 * - Shows nothing if audioUrl is null.
 *
 * MOB-13: no /NN opacity modifier on var-backed tokens.
 */
import { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { Volume2 } from 'lucide-react-native';

const SPEEDS: (0.5 | 0.75 | 1)[] = [0.5, 0.75, 1];

// MOB-13: explicit rgba for icon tint
const SPEAKER_ICON = 'rgb(100,116,139)'; // --practice-text-muted light

export interface AudioClusterProps {
  audioUrl: string | null;
  isDark?: boolean;
  testID?: string;
}

export function AudioCluster({ audioUrl, isDark = false, testID }: AudioClusterProps) {
  const [speedIndex, setSpeedIndex] = useState(2); // default 1×
  const player = useAudioPlayer(audioUrl ?? '');
  const iconColor = isDark ? 'rgb(148,163,184)' : SPEAKER_ICON;

  const handleSpeedToggle = useCallback(() => {
    setSpeedIndex((prev) => (prev + 1) % SPEEDS.length);
  }, []);

  const handlePlay = useCallback(() => {
    if (!audioUrl) return;
    try {
      // Set speed before playing — expo-audio AudioPlayer property
      if (typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(SPEEDS[speedIndex]);
      }
      void player.play();
    } catch {
      // Gracefully handle any audio errors (stale presigned URL, etc.)
    }
  }, [audioUrl, player, speedIndex]);

  if (!audioUrl) return null;

  const borderColor = isDark ? 'rgba(148,163,184,0.20)' : 'rgba(100,116,139,0.18)';
  const bgColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)';

  return (
    <View
      testID={testID ?? 'review-audio-cluster'}
      className="flex-row items-center gap-2"
    >
      {/* Speed toggle pill */}
      <Pressable
        testID="review-audio-speed"
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${SPEEDS[speedIndex]}×`}
        onPress={handleSpeedToggle}
        className="px-3 py-1.5 rounded-full active:opacity-70"
        style={{ backgroundColor: bgColor, borderWidth: 1, borderColor }}
      >
        <Text
          className="text-practice-text-muted text-[11px] font-bold"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {SPEEDS[speedIndex]}×
        </Text>
      </Pressable>

      {/* Speaker button */}
      <Pressable
        testID="review-audio-play"
        accessibilityRole="button"
        accessibilityLabel="Play audio"
        onPress={handlePlay}
        className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
        style={{ backgroundColor: bgColor, borderWidth: 1, borderColor }}
      >
        <Volume2 size={16} color={iconColor} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
