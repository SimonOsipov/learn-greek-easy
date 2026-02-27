import { useState } from 'react';

import { cn } from '@/lib/utils';
import {
  type AudioSpeed,
  getPersistedAudioSpeed,
  setPersistedAudioSpeed,
} from '@/utils/audioSpeed';

export interface AudioSpeedToggleProps {
  speed?: AudioSpeed;
  onSpeedChange?: (speed: AudioSpeed) => void;
  className?: string;
}

const SPEED_OPTIONS: AudioSpeed[] = [1, 0.75];

export function AudioSpeedToggle({ speed, onSpeedChange, className }: AudioSpeedToggleProps) {
  const isControlled = speed !== undefined && onSpeedChange !== undefined;
  const [internalSpeed, setInternalSpeed] = useState<AudioSpeed>(getPersistedAudioSpeed);
  const activeSpeed = isControlled ? speed : internalSpeed;

  function handleChange(newSpeed: AudioSpeed) {
    if (newSpeed === activeSpeed) return;
    setPersistedAudioSpeed(newSpeed);
    if (isControlled) {
      onSpeedChange(newSpeed);
    } else {
      setInternalSpeed(newSpeed);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Playback speed"
      className={cn('flex gap-1', className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid="audio-speed-toggle"
    >
      {SPEED_OPTIONS.map((opt) => {
        const isSelected = opt === activeSpeed;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${opt}x speed`}
            data-testid={`speed-option-${opt}`}
            onClick={(e) => {
              e.stopPropagation();
              handleChange(opt);
            }}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            x{opt}
          </button>
        );
      })}
    </div>
  );
}
