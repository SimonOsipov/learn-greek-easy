import { waitForElement, findDeckCardByTitle } from './tourUtils';

import type { DriveStep } from 'driver.js';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';

export function buildTourSteps(navigate: NavigateFunction, t: TFunction): DriveStep[] {
  return [
    // TOUR-02: Essential Greek Nouns Deck
    {
      element: () => findDeckCardByTitle('Essential Greek Nouns'),
      popover: {
        title: t('tour.decks.title'),
        description: t('tour.decks.description'),
        side: 'right' as const,
        align: 'start' as const,
      },
      onHighlightStarted: async () => {
        if (window.location.pathname !== '/decks') {
          navigate('/decks');
          await waitForElement('[data-testid="deck-card"]', 3000);
        }
      },
    },
  ];
}
