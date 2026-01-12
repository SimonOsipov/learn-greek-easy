/**
 * useMCQKeyboardShortcuts Hook Tests
 *
 * Tests for the keyboard shortcuts hook used in MCQ components.
 * These tests verify:
 * - Digit 1-N keys call onSelectOption with correct values (where N = optionCount)
 * - Digit keys beyond optionCount are ignored
 * - Enter key calls onSubmit when canSubmit is true
 * - Enter key does nothing when canSubmit is false
 * - Ignores keypresses in input/textarea fields
 * - Ignores keypresses with modifier keys
 * - Cleans up event listener on unmount
 * - Does nothing when disabled
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useMCQKeyboardShortcuts } from '../useMCQKeyboardShortcuts';

describe('useMCQKeyboardShortcuts', () => {
  const mockOnSelectOption = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any lingering event listeners
    vi.restoreAllMocks();
  });

  describe('Option Selection (Digit 1-4 with optionCount=4)', () => {
    it('should call onSelectOption with 1 when Digit1 is pressed', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Digit1' });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).toHaveBeenCalledWith(1);
      expect(mockOnSelectOption).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectOption with 2 when Digit2 is pressed', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Digit2' });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).toHaveBeenCalledWith(2);
      expect(mockOnSelectOption).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectOption with 3 when Digit3 is pressed', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Digit3' });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).toHaveBeenCalledWith(3);
      expect(mockOnSelectOption).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectOption with 4 when Digit4 is pressed', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Digit4' });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).toHaveBeenCalledWith(4);
      expect(mockOnSelectOption).toHaveBeenCalledTimes(1);
    });
  });

  describe('Option Selection with variable optionCount', () => {
    it('should only allow Digit1-2 when optionCount is 2', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 2,
        })
      );

      // Digit1 and Digit2 should work
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
      expect(mockOnSelectOption).toHaveBeenCalledWith(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
      expect(mockOnSelectOption).toHaveBeenCalledWith(2);

      // Digit3 and Digit4 should NOT work
      vi.clearAllMocks();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
      expect(mockOnSelectOption).not.toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });

    it('should only allow Digit1-3 when optionCount is 3', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 3,
        })
      );

      // Digit1, Digit2, Digit3 should work
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
      expect(mockOnSelectOption).toHaveBeenCalledWith(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
      expect(mockOnSelectOption).toHaveBeenCalledWith(2);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
      expect(mockOnSelectOption).toHaveBeenCalledWith(3);

      // Digit4 should NOT work
      vi.clearAllMocks();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });
  });

  describe('Submit (Enter key)', () => {
    it('should call onSubmit when Enter is pressed and canSubmit is true', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Enter' });
      window.dispatchEvent(event);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onSubmit when Enter is pressed and canSubmit is false', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: false,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Enter' });
      window.dispatchEvent(event);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit regardless of optionCount', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 2,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Enter' });
      window.dispatchEvent(event);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input Field Handling', () => {
    it('should ignore keypresses when target is an input element', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      // Create an input element to be the target
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();

      // Clean up
      document.body.removeChild(input);
    });

    it('should ignore keypresses when target is a textarea element', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      // Create a textarea element to be the target
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: textarea });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();

      // Clean up
      document.body.removeChild(textarea);
    });
  });

  describe('Modifier Keys', () => {
    it('should ignore keypresses with Ctrl modifier', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        ctrlKey: true,
      });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });

    it('should ignore keypresses with Meta modifier', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        metaKey: true,
      });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });

    it('should ignore keypresses with Alt modifier', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        altKey: true,
      });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Disabled State', () => {
    it('should not call onSelectOption when disabled is true', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          disabled: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Digit1' });
      window.dispatchEvent(event);

      expect(mockOnSelectOption).not.toHaveBeenCalled();
    });

    it('should not call onSubmit when disabled is true', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          disabled: true,
          optionCount: 4,
        })
      );

      const event = new KeyboardEvent('keydown', { code: 'Enter' });
      window.dispatchEvent(event);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Unrelated Keys', () => {
    it('should ignore unrelated key presses', () => {
      renderHook(() =>
        useMCQKeyboardShortcuts({
          onSelectOption: mockOnSelectOption,
          onSubmit: mockOnSubmit,
          canSubmit: true,
          optionCount: 4,
        })
      );

      // Press 'a', 'Space', 'Escape' - none should trigger callbacks
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(mockOnSelectOption).not.toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
