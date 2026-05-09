/**
 * MobileNav Component Tests
 *
 * Tests for the MobileNav component — Decks dropdown Culture entry and prefix-aware active state.
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { MobileNav } from '../MobileNav';

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.home': 'Home',
        'nav.decks': 'Decks',
        'nav.decksDropdown.allDecks': 'Public Decks',
        'nav.decksDropdown.myDecks': 'My Decks',
        'nav.decksDropdown.situations': 'Situations',
        'nav.decksDropdown.culture': 'Culture',
        'nav.practice': 'Practice',
        'nav.practiceDropdown.cultureExam': 'Culture Exam',
        'nav.practiceDropdown.exercises': 'Exercises',
        'nav.practiceDropdown.newsFeed': 'News Feed',
        'nav.stats': 'Stats',
        'nav.feedback': 'Support',
        'nav.feedbackDropdown.feedback': 'Submit Feedback',
        'nav.feedbackDropdown.changelog': 'New Features & Changes',
        'nav.profile': 'Profile',
      };
      return translations[key] || key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

describe('MobileNav — Decks dropdown Culture entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMobileNavAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <MobileNav />
      </MemoryRouter>
    );

  it('should show 4 children in order when Decks is clicked', async () => {
    const user = userEvent.setup();
    renderMobileNavAt('/dashboard');

    const decksButton = screen.getByRole('button', { name: 'Decks' });
    await user.click(decksButton);

    const subMenu = screen.getByTestId('mobile-submenu-decks');
    const items = within(subMenu).getAllByRole('menuitem');
    const texts = items.map((el) => el.textContent);
    expect(texts).toEqual(['Public Decks', 'My Decks', 'Situations', 'Culture']);
  });

  it('should have Culture child with href /culture', async () => {
    const user = userEvent.setup();
    renderMobileNavAt('/dashboard');

    const decksButton = screen.getByRole('button', { name: 'Decks' });
    await user.click(decksButton);

    const subMenu = screen.getByTestId('mobile-submenu-decks');
    const cultureLink = within(subMenu).getByText('Culture');
    expect(cultureLink.closest('a')).toHaveAttribute('href', '/culture');
  });

  it('should apply text-primary to Decks button on /culture/decks/abc (parent active)', () => {
    renderMobileNavAt('/culture/decks/abc');

    const decksButton = screen.getByRole('button', { name: 'Decks' });
    expect(decksButton).toHaveClass('text-primary');
  });

  it('should apply bg-primary/10 text-primary to Culture child on /culture/decks/abc', async () => {
    const user = userEvent.setup();
    renderMobileNavAt('/culture/decks/abc');

    const decksButton = screen.getByRole('button', { name: 'Decks' });
    await user.click(decksButton);

    const subMenu = screen.getByTestId('mobile-submenu-decks');
    const cultureLink = within(subMenu).getByText('Culture').closest('a');
    expect(cultureLink).toHaveClass('bg-primary/10');
    expect(cultureLink).toHaveClass('text-primary');
  });

  it('should NOT apply text-primary to Decks button on /cultural-foo', () => {
    renderMobileNavAt('/cultural-foo');

    const decksButton = screen.getByRole('button', { name: 'Decks' });
    expect(decksButton).not.toHaveClass('text-primary');
  });
});
