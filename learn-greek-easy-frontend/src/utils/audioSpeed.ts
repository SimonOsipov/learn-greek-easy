export type AudioSpeed = 1 | 0.75;
export const AUDIO_SPEED_KEY = 'greekly_audio_speed';
export function getPersistedAudioSpeed(): AudioSpeed {
  try {
    if (typeof window === 'undefined') return 1;
    const stored = window.localStorage.getItem(AUDIO_SPEED_KEY);
    return stored === '0.75' ? 0.75 : 1;
  } catch {
    return 1;
  }
}
export function setPersistedAudioSpeed(speed: AudioSpeed): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_SPEED_KEY, String(speed));
  } catch {
    // best-effort persistence
  }
}
