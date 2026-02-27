/**
 * AudioSpeedToggle Component Tests
 */

import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioSpeedToggle } from '@/components/ui/AudioSpeedToggle';
import { render, screen } from '@/lib/test-utils';
import { AUDIO_SPEED_KEY } from '@/utils/audioSpeed';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AudioSpeedToggle', () => {
  it('1. renders two options (x1, x0.75)', () => {
    render(<AudioSpeedToggle />);

    const opt1 = screen.getByTestId('speed-option-1');
    const opt075 = screen.getByTestId('speed-option-0.75');

    expect(opt1).toBeInTheDocument();
    expect(opt075).toBeInTheDocument();
    expect(opt1).toHaveTextContent('x1');
    expect(opt075).toHaveTextContent('x0.75');
  });

  it('2. default selection x1 when localStorage empty', () => {
    localStorage.clear();
    render(<AudioSpeedToggle />);

    expect(screen.getByTestId('speed-option-1')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('speed-option-0.75')).toHaveAttribute('aria-checked', 'false');
  });

  it('3. reads initial speed from localStorage', () => {
    localStorage.setItem(AUDIO_SPEED_KEY, '0.75');
    render(<AudioSpeedToggle />);

    expect(screen.getByTestId('speed-option-0.75')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('speed-option-1')).toHaveAttribute('aria-checked', 'false');
  });

  it('4. click x0.75 updates selection + writes localStorage', async () => {
    const user = userEvent.setup();
    render(<AudioSpeedToggle />);

    await user.click(screen.getByTestId('speed-option-0.75'));

    expect(screen.getByTestId('speed-option-0.75')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(AUDIO_SPEED_KEY)).toBe('0.75');
  });

  it('5. click already-selected is no-op', async () => {
    const user = userEvent.setup();
    render(<AudioSpeedToggle />);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    await user.click(screen.getByTestId('speed-option-1'));

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('speed-option-1')).toHaveAttribute('aria-checked', 'true');
  });

  it('6. controlled: speed prop determines selection, onSpeedChange fires', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AudioSpeedToggle speed={1} onSpeedChange={onChange} />);

    expect(screen.getByTestId('speed-option-1')).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByTestId('speed-option-0.75'));

    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('7. controlled does NOT use internal state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AudioSpeedToggle speed={1} onSpeedChange={onChange} />);

    await user.click(screen.getByTestId('speed-option-0.75'));

    // Parent hasn't changed speed prop, so x1 should still be selected
    expect(screen.getByTestId('speed-option-1')).toHaveAttribute('aria-checked', 'true');
  });

  it('8. accessibility: radiogroup + radio + aria-checked', () => {
    render(<AudioSpeedToggle />);

    expect(screen.getByRole('radiogroup', { name: 'Playback speed' })).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);

    expect(screen.getByRole('radio', { name: '1x speed' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '0.75x speed' })).toBeInTheDocument();
  });

  it('9. click does not propagate', async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <AudioSpeedToggle />
      </div>
    );

    await user.click(screen.getByTestId('speed-option-0.75'));

    expect(parentClick).not.toHaveBeenCalled();
  });

  it('10. keyboard event does not propagate', () => {
    const parentKeyDown = vi.fn();

    render(
      <div onKeyDown={parentKeyDown}>
        <AudioSpeedToggle />
      </div>
    );

    fireEvent.keyDown(screen.getByTestId('audio-speed-toggle'), { key: 'Enter' });

    expect(parentKeyDown).not.toHaveBeenCalled();
  });
});
