import { findDeckCardByTitle, getNavElement, waitForElement } from './tourUtils';

import type { DriveStep } from 'driver.js';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';

export function buildTourSteps(navigate: NavigateFunction, t: TFunction): DriveStep[] {
  const steps: DriveStep[] = [];

  // Step 1: Navigation Bar (dashboard page)
  steps.push({
    element: getNavElement() ?? undefined,
    popover: {
      title: t('tour.steps.navigation.title'),
      description: t('tour.steps.navigation.description'),
      side: 'bottom',
      align: 'center',
    },
    onHighlightStarted: async () => {
      navigate('/dashboard');
      await waitForElement('[data-testid="metrics-section"]', 3000);
    },
  });

  // Step 2: Progress Metrics (dashboard page)
  steps.push({
    element: '[data-testid="metrics-section"]',
    popover: {
      title: t('tour.steps.progress.title'),
      description: t('tour.steps.progress.description'),
      side: 'bottom',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/dashboard');
      await waitForElement('[data-testid="metrics-section"]', 3000);
    },
  });

  steps.push({
    element: '[data-testid="news-section"]',
    popover: {
      title: t('tour.steps.news_section.title'),
      description: t('tour.steps.news_section.description'),
      side: 'top',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid="news-country-filters"]',
    popover: {
      title: t('tour.steps.news_country.title'),
      description: t('tour.steps.news_country.description'),
      side: 'bottom',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid="news-difficulty-selector"]',
    popover: {
      title: t('tour.steps.news_difficulty.title'),
      description: t('tour.steps.news_difficulty.description'),
      side: 'bottom',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid^="news-card-"]',
    popover: {
      title: t('tour.steps.news_card.title'),
      description: t('tour.steps.news_card.description'),
      side: 'top',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid="news-section-see-all"]',
    popover: {
      title: t('tour.steps.news_all.title'),
      description: t('tour.steps.news_all.description'),
      side: 'bottom',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid="decks-dropdown-trigger"]',
    popover: {
      title: t('tour.steps.decks_dropdown.title'),
      description: t('tour.steps.decks_dropdown.description'),
      side: 'bottom',
      align: 'start',
    },
  });

  steps.push({
    element: '[data-testid="deck-filters"]',
    popover: {
      title: t('tour.steps.deck_filters.title'),
      description: t('tour.steps.deck_filters.description'),
      side: 'bottom',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/decks');
      await waitForElement('[data-testid="deck-filters"]', 5000);
    },
  });

  steps.push({
    element: () =>
      findDeckCardByTitle('Essential Greek Nouns') ??
      document.querySelector('[data-testid="deck-card"]')!,
    popover: {
      title: t('tour.steps.vocab_deck.title'),
      description: t('tour.steps.vocab_deck.description'),
      side: 'top',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/decks');
      await waitForElement('[data-testid="deck-card"]', 5000);
    },
  });

  return steps;
}
