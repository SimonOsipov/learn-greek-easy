import { describe, it, expect, vi, afterEach } from 'vitest';
import { findDeckCardByTitle } from '../tourUtils';
import { buildTourSteps } from '../tourSteps';

describe('tourUtils', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('findDeckCardByTitle', () => {
    it('finds matching card by title', () => {
      const card = document.createElement('div');
      card.setAttribute('data-testid', 'deck-card');
      const title = document.createElement('span');
      title.setAttribute('data-testid', 'deck-card-title');
      title.textContent = 'Essential Greek Nouns';
      card.appendChild(title);
      document.body.appendChild(card);

      expect(findDeckCardByTitle('Essential Greek Nouns')).toBe(card);
    });

    it('returns null when not found', () => {
      expect(findDeckCardByTitle('Nonexistent')).toBeNull();
    });

    it('returns null with non-matching title', () => {
      const card = document.createElement('div');
      card.setAttribute('data-testid', 'deck-card');
      const title = document.createElement('span');
      title.setAttribute('data-testid', 'deck-card-title');
      title.textContent = 'Other Deck';
      card.appendChild(title);
      document.body.appendChild(card);

      expect(findDeckCardByTitle('Essential Greek Nouns')).toBeNull();
    });
  });

  describe('buildTourSteps', () => {
    it('returns array with decks step', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(steps).toHaveLength(2);
      expect(steps[0].popover).toBeDefined();
      expect(mockT).toHaveBeenCalledWith('tour.decks.title');
      expect(mockT).toHaveBeenCalledWith('tour.decks.description');
    });

    it('step has correct popover position', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      const popover = steps[0].popover;
      expect(popover?.side).toBe('right');
      expect(popover?.align).toBe('start');
    });
  });

  describe('buildTourSteps - culture step', () => {
    it('returns culture step at index 1', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(mockT).toHaveBeenCalledWith('tour.culture.title');
      expect(mockT).toHaveBeenCalledWith('tour.culture.description');
    });

    it('culture step element function returns start-exam-button when present', () => {
      const el = document.createElement('button');
      el.setAttribute('data-testid', 'start-exam-button');
      document.body.appendChild(el);

      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      const elementFn = steps[1].element as () => Element | null;
      expect(elementFn()).toBe(el);
    });

    it('culture step element function falls back to mock-exam-page', () => {
      const page = document.createElement('div');
      page.setAttribute('data-testid', 'mock-exam-page');
      document.body.appendChild(page);

      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      const elementFn = steps[1].element as () => Element | null;
      expect(elementFn()).toBe(page);
    });
  });
});
