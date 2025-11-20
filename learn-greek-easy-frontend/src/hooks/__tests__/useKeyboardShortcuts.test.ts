/**
 * useKeyboardShortcuts Hook Tests
 * Tests keyboard shortcuts for flashcard review
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Mock the review store
const mockFlipCard = vi.fn();
const mockRateCard = vi.fn();
const mockCanRate = vi.fn(() => true);

vi.mock('@/stores/reviewStore', () => ({
  useReviewStore: () => ({
    flipCard: mockFlipCard,
    rateCard: mockRateCard,
    canRate: mockCanRate(),
  }),
}));

describe('useKeyboardShortcuts Hook', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFlipCard.mockClear();
    mockRateCard.mockClear();
    mockCanRate.mockReturnValue(true);

    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('Event Listener Management', () => {
    it('should register keydown event listener on mount', () => {
      renderHook(() => useKeyboardShortcuts());

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts());

      const handler = addEventListenerSpy.mock.calls[0]?.[1];

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', handler);
    });
  });

  describe('Help Dialog', () => {
    it('should initialize with showHelp false', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());
      expect(result.current.showHelp).toBe(false);
    });

    it('should toggle help dialog on "?" key', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      });

      expect(result.current.showHelp).toBe(true);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      });

      expect(result.current.showHelp).toBe(false);
    });

    it('should provide setShowHelp function', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      act(() => {
        result.current.setShowHelp(true);
      });

      expect(result.current.showHelp).toBe(true);

      act(() => {
        result.current.setShowHelp(false);
      });

      expect(result.current.showHelp).toBe(false);
    });

    it('should close help dialog on Escape key when help is open', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      // Open help dialog
      act(() => {
        result.current.setShowHelp(true);
      });

      expect(result.current.showHelp).toBe(true);

      // Press Escape
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.showHelp).toBe(false);
    });
  });

  describe('Flip Card Shortcut', () => {
    it('should flip card on Space key', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      });

      expect(mockFlipCard).toHaveBeenCalledTimes(1);
    });

    it('should prevent default behavior on Space key', () => {
      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Rating Shortcuts', () => {
    it('should rate card as "again" on key 1', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
      });

      expect(mockRateCard).toHaveBeenCalledWith('again');
    });

    it('should rate card as "hard" on key 2', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2' }));
      });

      expect(mockRateCard).toHaveBeenCalledWith('hard');
    });

    it('should rate card as "good" on key 3', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', key: '3' }));
      });

      expect(mockRateCard).toHaveBeenCalledWith('good');
    });

    it('should rate card as "easy" on key 4', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', key: '4' }));
      });

      expect(mockRateCard).toHaveBeenCalledWith('easy');
    });

    it('should not rate card when canRate is false', () => {
      mockCanRate.mockReturnValue(false);

      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
      });

      expect(mockRateCard).not.toHaveBeenCalled();
    });

    it('should prevent default on rating keys when canRate is true', () => {
      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { code: 'Digit1', key: '1' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Input Field Exclusion', () => {
    it('should ignore shortcuts when typing in input field', () => {
      renderHook(() => useKeyboardShortcuts());

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        bubbles: true,
      });

      Object.defineProperty(event, 'target', {
        value: input,
        enumerable: true,
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockFlipCard).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should ignore shortcuts when typing in textarea', () => {
      renderHook(() => useKeyboardShortcuts());

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        code: 'Digit1',
        key: '1',
        bubbles: true,
      });

      Object.defineProperty(event, 'target', {
        value: textarea,
        enumerable: true,
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockRateCard).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });
  });

  describe('Modifier Keys', () => {
    it('should ignore shortcuts when Ctrl is pressed', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'Space',
            key: ' ',
            ctrlKey: true,
          })
        );
      });

      expect(mockFlipCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts when Meta is pressed', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'Space',
            key: ' ',
            metaKey: true,
          })
        );
      });

      expect(mockFlipCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts when Alt is pressed', () => {
      renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'Space',
            key: ' ',
            altKey: true,
          })
        );
      });

      expect(mockFlipCard).not.toHaveBeenCalled();
    });

    it('should handle "?" even though it requires Shift', () => {
      const { result } = renderHook(() => useKeyboardShortcuts());

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: '?',
            shiftKey: true,
          })
        );
      });

      expect(result.current.showHelp).toBe(true);
    });
  });

  describe('Multiple Shortcut Sequence', () => {
    it('should handle multiple shortcuts in sequence', () => {
      renderHook(() => useKeyboardShortcuts());

      // Flip card
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      });

      expect(mockFlipCard).toHaveBeenCalledTimes(1);

      // Rate as good
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', key: '3' }));
      });

      expect(mockRateCard).toHaveBeenCalledWith('good');

      // Flip next card
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      });

      expect(mockFlipCard).toHaveBeenCalledTimes(2);
    });

    it('should handle all rating options in sequence', () => {
      renderHook(() => useKeyboardShortcuts());

      const ratings = [
        { code: 'Digit1', key: '1', expected: 'again' },
        { code: 'Digit2', key: '2', expected: 'hard' },
        { code: 'Digit3', key: '3', expected: 'good' },
        { code: 'Digit4', key: '4', expected: 'easy' },
      ];

      ratings.forEach(({ code, key, expected }) => {
        mockRateCard.mockClear();

        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code, key }));
        });

        expect(mockRateCard).toHaveBeenCalledWith(expected);
      });
    });
  });
});
