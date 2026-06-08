/// <reference types="jest" />
/**
 * DASH-08 — RNTL component tests for NewUserStart ("Three ways to start").
 *
 * Tests:
 *   1. Renders the heading verbatim: "Three ways to start".
 *   2. Renders the lede verbatim: "Pick one. Most people start with the first deck."
 *   3. Renders all three row titles verbatim.
 *   4. Renders all three row subs verbatim.
 *   5. Renders all three row metas verbatim (including Greek "καφενείο").
 *   6. Pressing row 1 calls onPickDeck and only onPickDeck.
 *   7. Pressing row 2 calls onReadArticle and only onReadArticle.
 *   8. Pressing row 3 calls onTryConversation and only onTryConversation.
 *   9. No progress-band / stat / streak surfaces appear in this component.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — must precede imports of the subjects.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// lucide-react-native — stub icons to plain Views.
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = ({ testID }: { testID?: string } = {}) =>
    ce(View, { testID: testID ?? 'icon-stub' });
  return { ChevronRight: stub };
});

// ---------------------------------------------------------------------------
// Import subject AFTER mocks.
// ---------------------------------------------------------------------------
import { NewUserStart } from '@/components/dashboard/new-user-start';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderComponent(overrides?: {
  onPickDeck?: () => void;
  onReadArticle?: () => void;
  onTryConversation?: () => void;
}) {
  const onPickDeck = overrides?.onPickDeck ?? jest.fn();
  const onReadArticle = overrides?.onReadArticle ?? jest.fn();
  const onTryConversation = overrides?.onTryConversation ?? jest.fn();
  const result = render(
    <NewUserStart
      onPickDeck={onPickDeck}
      onReadArticle={onReadArticle}
      onTryConversation={onTryConversation}
    />,
  );
  return { ...result, onPickDeck, onReadArticle, onTryConversation };
}

// ---------------------------------------------------------------------------
// 1. Heading
// ---------------------------------------------------------------------------

describe('NewUserStart — heading and lede', () => {
  it('renders the heading verbatim: "Three ways to start"', () => {
    renderComponent();
    expect(screen.getByTestId('new-user-start-heading').props.children).toBe(
      'Three ways to start',
    );
  });

  it('renders the lede verbatim', () => {
    renderComponent();
    expect(screen.getByTestId('new-user-start-lede').props.children).toBe(
      'Pick one. Most people start with the first deck.',
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Row copy — titles, subs, metas
// ---------------------------------------------------------------------------

describe('NewUserStart — row copy', () => {
  it('renders row 1 title: "First Greek words"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-title-pick-deck').props.children,
    ).toBe('First Greek words');
  });

  it('renders row 2 title: "Read your first article"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-title-read-article').props.children,
    ).toBe('Read your first article');
  });

  it('renders row 3 title: "Try a real conversation"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-title-try-conversation').props.children,
    ).toBe('Try a real conversation');
  });

  it('renders row 1 sub: "20 cards · 15 min · A1"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-sub-pick-deck').props.children,
    ).toBe('20 cards · 15 min · A1');
  });

  it('renders row 2 sub: "1 min audio · B2"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-sub-read-article').props.children,
    ).toBe('1 min audio · B2');
  });

  it('renders row 3 sub: "Coffee shop · A2"', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-sub-try-conversation').props.children,
    ).toBe('Coffee shop · A2');
  });

  it('renders row 1 meta: "Greetings, family, food."', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-meta-pick-deck').props.children,
    ).toBe('Greetings, family, food.');
  });

  it('renders row 2 meta: "Listen along, tap for translation."', () => {
    renderComponent();
    expect(
      screen.getByTestId('new-user-row-meta-read-article').props.children,
    ).toBe('Listen along, tap for translation.');
  });

  it('renders row 3 meta with Greek καφενείο inline', () => {
    renderComponent();
    const meta = screen.getByTestId(
      'new-user-row-meta-try-conversation',
    ).props.children as string;
    expect(meta).toContain('καφενείο');
  });
});

// ---------------------------------------------------------------------------
// 3. Interaction — each row calls only its handler
// ---------------------------------------------------------------------------

describe('NewUserStart — row press handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pressing row 1 calls onPickDeck', () => {
    const { onPickDeck, onReadArticle, onTryConversation } = renderComponent();
    fireEvent.press(screen.getByTestId('new-user-row-pick-deck'));
    expect(onPickDeck).toHaveBeenCalledTimes(1);
    expect(onReadArticle).not.toHaveBeenCalled();
    expect(onTryConversation).not.toHaveBeenCalled();
  });

  it('pressing row 2 calls onReadArticle', () => {
    const { onPickDeck, onReadArticle, onTryConversation } = renderComponent();
    fireEvent.press(screen.getByTestId('new-user-row-read-article'));
    expect(onReadArticle).toHaveBeenCalledTimes(1);
    expect(onPickDeck).not.toHaveBeenCalled();
    expect(onTryConversation).not.toHaveBeenCalled();
  });

  it('pressing row 3 calls onTryConversation', () => {
    const { onPickDeck, onReadArticle, onTryConversation } = renderComponent();
    fireEvent.press(screen.getByTestId('new-user-row-try-conversation'));
    expect(onTryConversation).toHaveBeenCalledTimes(1);
    expect(onPickDeck).not.toHaveBeenCalled();
    expect(onReadArticle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. No progress-band / stat / streak surfaces
// ---------------------------------------------------------------------------

describe('NewUserStart — no progress/stat/streak surfaces', () => {
  it('renders no progress-band element', () => {
    renderComponent();
    expect(screen.queryByTestId('progress-band')).toBeNull();
  });

  it('renders no stat-grid element', () => {
    renderComponent();
    expect(screen.queryByTestId('stat-grid')).toBeNull();
  });

  it('renders no streak chip element', () => {
    renderComponent();
    expect(screen.queryByTestId('streak-chip')).toBeNull();
  });
});
