/**
 * usePracticeKeyboard Hook Tests
 *
 * Tests for the generic keyboard shortcut hook for practice pages.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePracticeKeyboard } from '../usePracticeKeyboard';

describe('usePracticeKeyboard', () => {
  const mockHandler1 = vi.fn();
  const mockHandler2 = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls handler when matching key is pressed', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { '1': mockHandler1 },
        deps: [],
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

    expect(mockHandler1).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault by default', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { Enter: mockHandler1 },
        deps: [],
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not call preventDefault when preventDefault: false', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { Enter: mockHandler1 },
        deps: [],
        preventDefault: false,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(mockHandler1).toHaveBeenCalledTimes(1);
  });

  it('ignores keypress when target is input element', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { '1': mockHandler1 },
        deps: [],
      })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(mockHandler1).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('ignores keypress when target is textarea element', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { '1': mockHandler1 },
        deps: [],
      })
    );

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(mockHandler1).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('ignores keypress when target is select element', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { '1': mockHandler1 },
        deps: [],
      })
    );

    const select = document.createElement('select');
    document.body.appendChild(select);

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: select });
    window.dispatchEvent(event);

    expect(mockHandler1).not.toHaveBeenCalled();

    document.body.removeChild(select);
  });

  it('does not call handler for unmatched keys', () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { Enter: mockHandler1, '1': mockHandler2 },
        deps: [],
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(mockHandler1).not.toHaveBeenCalled();
    expect(mockHandler2).not.toHaveBeenCalled();
  });

  it("handles Space key via e.key === ' '", () => {
    renderHook(() =>
      usePracticeKeyboard({
        keymap: { Space: mockHandler1 },
        deps: [],
      })
    );

    // e.key for space bar is ' ' (single space character)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(mockHandler1).toHaveBeenCalledTimes(1);
  });

  it('removes event listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() =>
      usePracticeKeyboard({
        keymap: { Enter: mockHandler1 },
        deps: [],
      })
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
