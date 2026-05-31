/**
 * useMockExamKeyboardShortcuts Hook Tests
 *
 * Tests for the keyboard shortcuts hook used in the mock exam session.
 * These tests verify:
 * - Space/ArrowRight only act when isInFeedback is true
 * - Escape always acts (unless disabled)
 * - Escape does not act when disabled
 * - Targets inside input/textarea are ignored
 * - Modifier-key combos (Ctrl, Meta, Alt) are ignored
 * - Cleans up event listener on unmount
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useMockExamKeyboardShortcuts } from '../useMockExamKeyboardShortcuts';

describe('useMockExamKeyboardShortcuts', () => {
  const mockOnEscape = vi.fn();
  const mockOnNextQuestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Space / ArrowRight — only when isInFeedback
  // ---------------------------------------------------------------------------

  describe('Space key', () => {
    it('calls onNextQuestion when Space is pressed and isInFeedback is true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

      expect(mockOnNextQuestion).toHaveBeenCalledTimes(1);
      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('does NOT call onNextQuestion when Space is pressed and isInFeedback is false', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });

  describe('ArrowRight key', () => {
    it('calls onNextQuestion when ArrowRight is pressed and isInFeedback is true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));

      expect(mockOnNextQuestion).toHaveBeenCalledTimes(1);
      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('does NOT call onNextQuestion when ArrowRight is pressed and isInFeedback is false', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Escape — always acts (unless disabled)
  // ---------------------------------------------------------------------------

  describe('Escape key', () => {
    it('calls onEscape when Escape is pressed regardless of isInFeedback=false', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(mockOnEscape).toHaveBeenCalledTimes(1);
      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });

    it('calls onEscape when Escape is pressed regardless of isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(mockOnEscape).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onEscape when disabled is true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
          disabled: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('does NOT call onNextQuestion when disabled is true even if isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
          disabled: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Input / textarea targets — always ignored
  // ---------------------------------------------------------------------------

  describe('Input field handling', () => {
    it('ignores Escape when target is an input element', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { code: 'Escape', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(mockOnEscape).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('ignores Space when target is a textarea element and isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
      Object.defineProperty(event, 'target', { value: textarea });
      window.dispatchEvent(event);

      expect(mockOnNextQuestion).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('ignores ArrowRight when target is an input element and isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(mockOnNextQuestion).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  // ---------------------------------------------------------------------------
  // Modifier key combos — always ignored
  // ---------------------------------------------------------------------------

  describe('Modifier keys', () => {
    it('ignores Escape with Ctrl modifier', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', ctrlKey: true }));

      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('ignores Escape with Meta modifier', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', metaKey: true }));

      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('ignores Escape with Alt modifier', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', altKey: true }));

      expect(mockOnEscape).not.toHaveBeenCalled();
    });

    it('ignores Space with Ctrl modifier even when isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });

    it('ignores ArrowRight with Meta modifier even when isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', metaKey: true }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });

    it('ignores ArrowRight with Alt modifier even when isInFeedback=true', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', altKey: true }));

      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('Cleanup', () => {
    it('removes the event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: false,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('does not fire callbacks after unmount', () => {
      const { unmount } = renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      unmount();

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

      expect(mockOnEscape).not.toHaveBeenCalled();
      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Unrelated keys — no callbacks fired
  // ---------------------------------------------------------------------------

  describe('Unrelated keys', () => {
    it('does not fire any callback for unrelated keys', () => {
      renderHook(() =>
        useMockExamKeyboardShortcuts({
          onEscape: mockOnEscape,
          onNextQuestion: mockOnNextQuestion,
          isInFeedback: true,
        })
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));

      expect(mockOnEscape).not.toHaveBeenCalled();
      expect(mockOnNextQuestion).not.toHaveBeenCalled();
    });
  });
});
