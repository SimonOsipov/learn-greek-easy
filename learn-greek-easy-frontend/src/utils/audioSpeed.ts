export type AudioSpeed = 1 | 0.75;
export const AUDIO_SPEED_KEY = 'greekly_audio_speed';
export function getPersistedAudioSpeed(): AudioSpeed {
  const stored = localStorage.getItem(AUDIO_SPEED_KEY);
  return stored === '0.75' ? 0.75 : 1;
}
export function setPersistedAudioSpeed(speed: AudioSpeed): void {
  localStorage.setItem(AUDIO_SPEED_KEY, String(speed));
}
