import { findDeckCardByTitle, getNavElement, waitForElement } from './tourUtils';

import type { DriveStep } from 'driver.js';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';

interface DeckInfo {
  id: string;
  title: string;
}

export function buildTourSteps(
  navigate: NavigateFunction,
  t: TFunction,
  essentialDeck?: DeckInfo | null
): DriveStep[] {
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

  // Step 3: Vocabulary Decks (navigates to /decks)
  steps.push({
    element: findDeckCardByTitle('Essential Greek Nouns') ?? '[data-testid="deck-list"]',
    popover: {
      title: t('tour.steps.decks.title'),
      description: t('tour.steps.decks.description'),
      side: 'right',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/decks');
      await waitForElement('[data-testid="deck-card"]', 3000);
    },
  });

  // Step 4: Inside a Deck (conditional — only if Essential Greek Nouns found)
  if (essentialDeck) {
    steps.push({
      element: '[data-testid="word-card"]',
      popover: {
        title: t('tour.steps.card.title'),
        description: t('tour.steps.card.description'),
        side: 'top',
        align: 'start',
      },
      onHighlightStarted: async () => {
        navigate(`/decks/${essentialDeck.id}`);
        await waitForElement('[data-testid="word-card"]', 5000);
      },
    });
  }

  // Step 5: Culture Exam (navigates to /practice/culture-exam)
  steps.push({
    element: '[data-testid="start-exam-button"]',
    popover: {
      title: t('tour.steps.culture.title'),
      description: t('tour.steps.culture.description'),
      side: 'top',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/practice/culture-exam');
      await waitForElement('[data-testid="start-exam-button"]', 3000);
    },
  });

  // Step 6: News Feed (navigates to /news)
  steps.push({
    element: '[data-testid="news-filters"]',
    popover: {
      title: t('tour.steps.news.title'),
      description: t('tour.steps.news.description'),
      side: 'bottom',
      align: 'start',
    },
    onHighlightStarted: async () => {
      navigate('/news');
      await waitForElement('[data-testid="news-filters"]', 3000);
    },
  });

  return steps;
}
