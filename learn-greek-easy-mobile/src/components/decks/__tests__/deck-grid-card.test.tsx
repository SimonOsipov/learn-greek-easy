/// <reference types="jest" />
/**
 * MOB-07 — RNTL tests for DeckGridCard + WordRow + StatsStrip presentational
 * components.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('nativewind');

// expo-linear-gradient — render children inside a plain View
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => ce(View, { testID }, children),
  };
});

// lucide-react-native — stub icons to plain Views
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = (props: { testID?: string } = {}) =>
    ce(View, { testID: props.testID ?? 'icon-stub' });
  return { Check: stub, ChevronRight: stub, ChevronLeft: stub, Play: stub };
});

import { DeckGridCard } from '@/components/decks/deck-grid-card';
import { WordRow } from '@/components/decks/word-row';
import { StatsStrip } from '@/components/decks/stats-strip';
import type { DeckResponse, WordEntryResponse } from '@/types/deck';

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    name: 'Greek House',
    name_el: 'Το ελληνικό σπίτι',
    description: 'Things we have in the house.',
    level: 'A1',
    is_active: true,
    card_count: 7,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeWord(overrides: Partial<WordEntryResponse> = {}): WordEntryResponse {
  return {
    id: 'w-1',
    deck_id: 'deck-1',
    lemma: 'δωμάτιο',
    part_of_speech: 'noun',
    translation_en: 'room',
    translation_ru: null,
    pronunciation: '/do·má·ti·o/',
    grammar_data: { gender: 'neuter' },
    is_active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DeckGridCard
// ---------------------------------------------------------------------------

describe('DeckGridCard', () => {
  it('renders title, Greek subtitle, level and card-count caption', () => {
    render(
      <DeckGridCard deck={makeDeck()} progressRatio={0} due={0} onPress={jest.fn()} />,
    );
    expect(screen.getByTestId('deck-grid-title')).toHaveTextContent('Greek House');
    expect(screen.getByTestId('deck-grid-title-el')).toHaveTextContent('Το ελληνικό σπίτι');
    expect(screen.getByTestId('deck-grid-level')).toHaveTextContent('A1');
    expect(screen.getByTestId('deck-grid-caption')).toHaveTextContent('7 cards');
  });

  it('not started: no progress bar, no check, no due pill', () => {
    render(
      <DeckGridCard deck={makeDeck()} progressRatio={0} due={0} onPress={jest.fn()} />,
    );
    expect(screen.queryByTestId('deck-grid-progress-fill')).toBeNull();
    expect(screen.queryByTestId('deck-grid-check')).toBeNull();
    expect(screen.queryByTestId('deck-grid-due')).toBeNull();
  });

  it('in progress: progress bar + due pill, no check disc', () => {
    render(
      <DeckGridCard deck={makeDeck()} progressRatio={0.25} due={8} onPress={jest.fn()} />,
    );
    expect(screen.getByTestId('deck-grid-progress-fill')).toBeTruthy();
    expect(screen.getByTestId('deck-grid-due')).toHaveTextContent('8 due');
    expect(screen.queryByTestId('deck-grid-check')).toBeNull();
  });

  it('complete: check disc, no progress bar', () => {
    render(
      <DeckGridCard deck={makeDeck()} progressRatio={1} due={0} onPress={jest.fn()} />,
    );
    expect(screen.getByTestId('deck-grid-check')).toBeTruthy();
    expect(screen.queryByTestId('deck-grid-progress-fill')).toBeNull();
  });

  it('press fires onPress with the deck id', () => {
    const onPress = jest.fn();
    render(<DeckGridCard deck={makeDeck()} progressRatio={0} due={0} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('deck-grid-card-deck-1'));
    expect(onPress).toHaveBeenCalledWith('deck-1');
  });
});

// ---------------------------------------------------------------------------
// WordRow
// ---------------------------------------------------------------------------

describe('WordRow', () => {
  it('renders the gendered article, lemma, pronunciation + gloss and status', () => {
    render(
      <WordRow word={makeWord()} status="new" showDivider onPress={jest.fn()} />,
    );
    expect(screen.getByTestId('word-article-w-1')).toHaveTextContent('το');
    expect(screen.getByTestId('word-lemma-w-1')).toHaveTextContent('δωμάτιο');
    expect(screen.getByText(/\/do·má·ti·o\//)).toBeTruthy();
    expect(screen.getByText(/room/)).toBeTruthy();
    expect(screen.getByTestId('word-status-w-1')).toHaveTextContent('new');
  });

  it('falls back to the lemma initial when there is no noun gender', () => {
    render(
      <WordRow
        word={makeWord({ id: 'w-2', lemma: 'τρέχω', grammar_data: null })}
        status="learning"
        showDivider={false}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('word-article-w-2')).toHaveTextContent('τ');
  });

  it('press fires onPress with the word id', () => {
    const onPress = jest.fn();
    render(<WordRow word={makeWord()} status="mastered" showDivider onPress={onPress} />);
    fireEvent.press(screen.getByTestId('word-row-w-1'));
    expect(onPress).toHaveBeenCalledWith('w-1');
  });
});

// ---------------------------------------------------------------------------
// StatsStrip
// ---------------------------------------------------------------------------

describe('StatsStrip', () => {
  it('renders the three stats', () => {
    render(<StatsStrip due={8} mastered={12} cards={48} />);
    expect(screen.getByTestId('deck-stat-due')).toHaveTextContent('8');
    expect(screen.getByTestId('deck-stat-mastered')).toHaveTextContent('12');
    expect(screen.getByTestId('deck-stat-cards')).toHaveTextContent('48');
  });
});
