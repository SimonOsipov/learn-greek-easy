/**
 * RelatedWordsSection Component Tests
 *
 * DX-10 (R7): clickable chip row sourced from same-deck neighbours via useWordEntries.
 */

import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock react-router-dom so tests don't need a Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock useWordEntries
const mockUseWordEntries = vi.fn();
vi.mock('@/features/decks/hooks/useWordEntries', () => ({
  useWordEntries: (opts: unknown) => mockUseWordEntries(opts),
}));

import { RelatedWordsSection } from '../RelatedWordsSection';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeEntry(id: string, lemma: string, i: number) {
  return {
    id,
    lemma,
    translation_en: `meaning-en-${i}`,
    translation_ru: `meaning-ru-${i}`,
    part_of_speech: 'noun',
  };
}

/** Build a deck of N words and return the entries + the id at position `currentIdx`. */
function makeDeck(n: number, currentIdx: number) {
  const entries = Array.from({ length: n }, (_, i) => makeEntry(`w${i}`, `word-${i}`, i));
  return { entries, currentId: entries[currentIdx].id };
}

function defaultHook(overrides = {}) {
  return {
    wordEntries: [],
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RelatedWordsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mockUseWordEntries.mockReturnValue(defaultHook());
  });

  // (a) multi-word deck → renders neighbour chips in deck order, correct count (≤3)
  it('renders neighbour chips in ascending deck order for a middle word', () => {
    // 5-word deck, current word at index 2 → neighbours [0,1,3,4] → up to 3 collected: [3,1,4]
    // forward-first: d=1 → idx+1=3, idx-1=1; d=2 → idx+2=4 (3 collected). Stop.
    // Sort by deck index ascending: [1,3,4]
    const { entries, currentId } = makeDeck(5, 2);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    expect(chips).toHaveLength(3);

    // Chips should appear in ascending deck-index order: word-1, word-3, word-4
    const greekSpans = chips.map((chip) => chip.querySelector('[lang="el"]')!.textContent);
    expect(greekSpans).toEqual(['word-1', 'word-3', 'word-4']);
  });

  // (b) clicking a chip calls navigate with the correct URL and scrolls to top
  it('clicking a chip calls navigate to the sibling word URL', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.spyOn(window, 'scrollTo');
    const { entries, currentId } = makeDeck(3, 1); // middle of [0,1,2]
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck42" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    await user.click(chips[0]);

    expect(mockNavigate).toHaveBeenCalledOnce();
    // First chip in ascending deck order is w0
    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck42/words/w0');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0 });
  });

  // (c) no UnwiredDot and no placeholder dashes
  it('does not render any UnwiredDot or placeholder dashes', () => {
    const { entries, currentId } = makeDeck(3, 1);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    expect(screen.queryByTestId('unwired-dot')).toBeNull();
    // No placeholder dash spans
    const allText = screen.getAllByTestId('related-word-chip').map((c) => c.textContent ?? '');
    allText.forEach((text) => expect(text).not.toContain('—'));
  });

  // (d) single-word deck → renders nothing
  it('renders nothing when the deck has only the current word', () => {
    const { entries, currentId } = makeDeck(1, 0);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    const { container } = render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);
    expect(container).toBeEmptyDOMElement();
  });

  // (e) edge: current word is FIRST → neighbours are the next up-to-3
  it('when current word is first, shows up to 3 forward neighbours in order', () => {
    const { entries, currentId } = makeDeck(5, 0); // current=word-0
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    expect(chips).toHaveLength(3);
    const greekSpans = chips.map((chip) => chip.querySelector('[lang="el"]')!.textContent);
    expect(greekSpans).toEqual(['word-1', 'word-2', 'word-3']);
  });

  // (e) edge: current word is LAST → previous up-to-3
  it('when current word is last, shows up to 3 previous neighbours in descending-→-ascending order', () => {
    const { entries, currentId } = makeDeck(5, 4); // current=word-4
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    expect(chips).toHaveLength(3);
    // Ascending deck index: word-1, word-2, word-3
    const greekSpans = chips.map((chip) => chip.querySelector('[lang="el"]')!.textContent);
    expect(greekSpans).toEqual(['word-1', 'word-2', 'word-3']);
  });

  // (f) empty deckId → renders nothing
  it('renders nothing when deckId is empty', () => {
    mockUseWordEntries.mockReturnValue(defaultHook());
    const { container } = render(<RelatedWordsSection deckId="" wordId="w1" />);
    expect(container).toBeEmptyDOMElement();
  });

  // (f) empty wordId → renders nothing
  it('renders nothing when wordId is empty', () => {
    const { entries } = makeDeck(3, 0);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));
    const { container } = render(<RelatedWordsSection deckId="deck1" wordId="" />);
    expect(container).toBeEmptyDOMElement();
  });

  // (f) isLoading=true → renders nothing
  it('renders nothing while loading', () => {
    mockUseWordEntries.mockReturnValue(defaultHook({ isLoading: true }));
    const { container } = render(<RelatedWordsSection deckId="deck1" wordId="w0" />);
    expect(container).toBeEmptyDOMElement();
  });

  // section wrapper and heading are present when chips render
  it('renders .dx-section wrapper with the section heading', () => {
    const { entries, currentId } = makeDeck(3, 1);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    expect(screen.getByTestId('related-words-section')).toHaveClass('dx-section');
    expect(screen.getByTestId('related-words-chips')).toBeInTheDocument();
  });

  // eyebrow kicker renders above the heading
  it('renders the "Vocabulary network" eyebrow kicker above the heading', () => {
    const { entries, currentId } = makeDeck(3, 1);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const eyebrow = screen.getByTestId('related-words-eyebrow');
    expect(eyebrow).toBeInTheDocument();
    expect(eyebrow).toHaveTextContent('Vocabulary network');
  });

  // Greek chip text carries lang="el"
  it('Greek chip text carries lang="el"', () => {
    const { entries, currentId } = makeDeck(3, 1);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const greekEls = screen
      .getAllByRole('button')
      .flatMap((btn) => Array.from(btn.querySelectorAll('[lang="el"]')));
    expect(greekEls.length).toBeGreaterThan(0);
  });

  // chips are <button> elements (navigable)
  it('chips are <button> elements', () => {
    const { entries, currentId } = makeDeck(3, 1);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    chips.forEach((chip) => expect(chip.tagName).toBe('BUTTON'));
  });

  // deck-order assertion: 5-word deck, current at index 2 → chips at deck indices 1,3,4
  it('forward-first tie-break: 5-word deck middle word yields chips at indices 1, 3, 4', () => {
    const { entries, currentId } = makeDeck(5, 2);
    mockUseWordEntries.mockReturnValue(defaultHook({ wordEntries: entries }));

    render(<RelatedWordsSection deckId="deck1" wordId={currentId} />);

    const chips = screen.getAllByTestId('related-word-chip');
    // Ascending: word-1 (idx 1), word-3 (idx 3), word-4 (idx 4)
    const greekSpans = chips.map((chip) => chip.querySelector('[lang="el"]')!.textContent);
    expect(greekSpans).toEqual(['word-1', 'word-3', 'word-4']);
  });
});
