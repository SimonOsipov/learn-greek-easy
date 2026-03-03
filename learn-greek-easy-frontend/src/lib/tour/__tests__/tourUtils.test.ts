import { describe, it, expect, vi, afterEach } from 'vitest';
import { findDeckCardByTitle, getNavElement } from '../tourUtils';
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

  describe('getNavElement', () => {
    it('returns desktop nav when visible (width > 0)', () => {
      const nav = document.createElement('nav');
      nav.setAttribute('data-testid', 'main-nav');
      document.body.appendChild(nav);

      // Mock getBoundingClientRect to return non-zero width
      vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({
        width: 500,
        height: 50,
        top: 0,
        left: 0,
        right: 500,
        bottom: 50,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      expect(getNavElement()).toBe(nav);
    });

    it('returns mobile nav when desktop has zero width', () => {
      const desktopNav = document.createElement('nav');
      desktopNav.setAttribute('data-testid', 'main-nav');
      document.body.appendChild(desktopNav);

      vi.spyOn(desktopNav, 'getBoundingClientRect').mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const mobileNav = document.createElement('nav');
      mobileNav.classList.add('fixed', 'bottom-0');
      document.body.appendChild(mobileNav);

      expect(getNavElement()).toBe(mobileNav);
    });

    it('returns null when no nav elements exist', () => {
      expect(getNavElement()).toBeNull();
    });
  });

  describe('buildTourSteps', () => {
    it('returns 6 steps when essentialDeck is provided', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any, {
        id: 'deck-1',
        title: 'Essential Greek Nouns',
      });
      expect(steps).toHaveLength(6);
    });

    it('returns 5 steps when essentialDeck is null', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any, null);
      expect(steps).toHaveLength(5);
    });

    it('returns 5 steps when essentialDeck is omitted', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(steps).toHaveLength(5);
    });

    it('step 1 uses tour.steps.navigation keys', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(mockT).toHaveBeenCalledWith('tour.steps.navigation.title');
      expect(mockT).toHaveBeenCalledWith('tour.steps.navigation.description');
      expect(steps[0].popover?.side).toBe('bottom');
      expect(steps[0].popover?.align).toBe('center');
    });

    it('step 2 targets metrics-section with tour.steps.progress keys', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(mockT).toHaveBeenCalledWith('tour.steps.progress.title');
      expect(mockT).toHaveBeenCalledWith('tour.steps.progress.description');
      expect(steps[1].element).toBe('[data-testid="metrics-section"]');
    });

    it('step 3 uses tour.steps.decks keys', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any);
      expect(mockT).toHaveBeenCalledWith('tour.steps.decks.title');
      expect(mockT).toHaveBeenCalledWith('tour.steps.decks.description');
    });

    it('all steps have title and description in popover', () => {
      const mockNavigate = vi.fn();
      const mockT = vi.fn((key: string) => key);
      const steps = buildTourSteps(mockNavigate, mockT as any, {
        id: 'deck-1',
        title: 'Essential Greek Nouns',
      });
      for (const step of steps) {
        expect(step.popover).toBeDefined();
        expect(step.popover?.title).toBeDefined();
        expect(step.popover?.description).toBeDefined();
      }
    });
  });
});
