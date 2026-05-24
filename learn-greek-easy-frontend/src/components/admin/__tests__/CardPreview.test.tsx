// CER-55 — CardPreview unit tests
// Covers WORD + CULTURE variants, compact vs full padding, lang="el" coverage,
// graceful missing-field handling, markedCorrect highlight + tag.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type { CardErrorCardSnapshot } from '@/types/cardError';

import { CardPreview } from '../CardPreview';

// ── Fixture builders ──────────────────────────────────────────────────────────

function buildWordPayload(overrides?: Partial<CardErrorCardSnapshot>): CardErrorCardSnapshot {
  return {
    word: 'μήλο',
    article: 'το',
    gender: 'n',
    translation_en: 'apple',
    translation_ru: 'яблоко',
    plural: 'μήλα',
    ipa: 'ˈmilo',
    ...overrides,
  };
}

function buildCulturePayload(overrides?: Partial<CardErrorCardSnapshot>): CardErrorCardSnapshot {
  return {
    question_en: 'What is the capital of Greece?',
    question_el: 'Ποια είναι η πρωτεύουσα της Ελλάδας;',
    options: ['Athens', 'Sparta', 'Thebes', 'Corinth'],
    correct_index: 0,
    level: 'A2',
    ...overrides,
  };
}

// ── WORD variant ──────────────────────────────────────────────────────────────

describe('CardPreview — WORD', () => {
  // AC #1: article has lang="el", Greek word has lang="el", IPA renders
  it('renders article with lang="el", Greek word with lang="el", IPA stacked below', () => {
    renderWithProviders(<CardPreview card={buildWordPayload()} cardType="WORD" />);

    // Greek article
    const article = screen.getByText('το');
    expect(article).toHaveAttribute('lang', 'el');

    // Greek word
    const word = screen.getByText('μήλο');
    expect(word).toHaveAttribute('lang', 'el');

    // IPA rendered (component wraps in /.../ so fixture 'ˈmilo' → '/ˈmilo/')
    expect(screen.getByText('/ˈmilo/')).toBeInTheDocument();
  });

  // AC #2: gender chip renders the literal glyph
  it.each([['f'], ['m'], ['n']] as const)(
    'renders gender chip with literal glyph "%s"',
    (gender) => {
      renderWithProviders(<CardPreview card={buildWordPayload({ gender })} cardType="WORD" />);
      // Gender chip: the component renders the gender value directly
      const { container } = render(
        <CardPreview card={buildWordPayload({ gender })} cardType="WORD" />
      );
      const chip = container.querySelector(`.ce-gender-${gender}`);
      expect(chip).not.toBeNull();
      expect(chip?.textContent).toBe(gender);
    }
  );

  // AC #3: 3-cell grid renders EN translation, RU translation, and plural form
  it('renders 3-cell grid with EN, RU, and plural', () => {
    renderWithProviders(<CardPreview card={buildWordPayload()} cardType="WORD" />);
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('яблоко')).toBeInTheDocument();
    expect(screen.getByText('μήλα')).toBeInTheDocument();
    // Labels
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('RU')).toBeInTheDocument();
    expect(screen.getByText('Plural')).toBeInTheDocument();
  });

  // AC #4: missing optional fields — no "undefined" in DOM, no crash
  it('renders gracefully when IPA and plural are absent', () => {
    const payload = buildWordPayload({ ipa: undefined, plural: undefined });
    const { container } = renderWithProviders(<CardPreview card={payload} cardType="WORD" />);
    // No 'undefined' literal
    expect(container.textContent).not.toMatch(/undefined/i);

    // IPA element should be absent
    expect(container.querySelector('.ce-ipa')).toBeNull();

    // Plural cell shows dash fallback
    const dashes = container.querySelectorAll('.ce-grid-cell dd');
    const pluralCell = Array.from(dashes).find((el) => {
      const dt = el.previousElementSibling;
      return dt?.textContent === 'Plural';
    });
    expect(pluralCell?.textContent).toBe('—');

    // Container still renders (no crash)
    expect(container.querySelector('.ce-preview-word')).not.toBeNull();
  });
});

// ── CULTURE variant ───────────────────────────────────────────────────────────

describe('CardPreview — CULTURE', () => {
  // AC #5: kicker violet dot renders; ce-q-en always renders
  it('renders violet dot kicker and EN question', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" />
    );
    // Violet dot
    expect(container.querySelector('.ce-dot-violet')).not.toBeNull();
    // EN question
    expect(container.querySelector('.ce-q-en')).not.toBeNull();
    expect(container.querySelector('.ce-q-en')?.textContent).toBe('What is the capital of Greece?');
  });

  // AC #5: ce-q-el renders with lang="el" when Greek question supplied
  it('renders ce-q-el with lang="el" when Greek question is present', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" />
    );
    const el = container.querySelector('.ce-q-el');
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('lang', 'el');
  });

  // AC #5: ce-q-el absent when no Greek question
  it('does not render ce-q-el when Greek question is absent', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload({ question_el: null })} cardType="CULTURE" />
    );
    expect(container.querySelector('.ce-q-el')).toBeNull();
  });

  // AC #6: level badge renders when level is set; absent when not supplied
  it('renders level badge when level is set', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload({ level: 'A2' })} cardType="CULTURE" />
    );
    expect(container.querySelector('.ce-level-badge')).not.toBeNull();
    expect(container.querySelector('.ce-level-badge')?.textContent).toBe('A2');
  });

  it('does not render level badge when level is absent', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload({ level: undefined })} cardType="CULTURE" />
    );
    expect(container.querySelector('.ce-level-badge')).toBeNull();
  });

  // AC #7: exactly 4 option rows with A/B/C/D prefix in order
  it('renders exactly 4 options with A/B/C/D prefixes', () => {
    const { container } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" />
    );
    const opts = container.querySelectorAll('.ce-opt');
    expect(opts).toHaveLength(4);
    const letters = Array.from(container.querySelectorAll('.ce-opt-letter')).map(
      (el) => el.textContent
    );
    expect(letters).toEqual(['A', 'B', 'C', 'D']);
  });

  // AC #8: markedCorrect option has .is-correct class AND trailing tag; others do not
  it.each([[0], [1], [2], [3]] as const)(
    'marks only option at index %d with .is-correct and "marked correct" tag',
    (markedIndex) => {
      const { container } = renderWithProviders(
        <CardPreview
          card={buildCulturePayload({ correct_index: markedIndex })}
          cardType="CULTURE"
        />
      );
      const opts = container.querySelectorAll('.ce-opt');
      expect(opts).toHaveLength(4);

      opts.forEach((opt, i) => {
        if (i === markedIndex) {
          expect(opt.classList.contains('is-correct')).toBe(true);
          expect(opt.textContent).toContain('marked correct');
        } else {
          expect(opt.classList.contains('is-correct')).toBe(false);
          expect(opt.textContent).not.toContain('marked correct');
        }
      });
    }
  );
});

// ── Compact vs full padding ───────────────────────────────────────────────────

describe('CardPreview — padding', () => {
  it('compact prop adds is-compact class; omitting it does not', () => {
    const { container: full } = renderWithProviders(
      <CardPreview card={buildWordPayload()} cardType="WORD" />
    );
    const { container: compact } = renderWithProviders(
      <CardPreview card={buildWordPayload()} cardType="WORD" compact />
    );

    const fullRoot = full.querySelector('.ce-preview-word');
    const compactRoot = compact.querySelector('.ce-preview-word');

    expect(fullRoot?.classList.contains('is-compact')).toBe(false);
    expect(compactRoot?.classList.contains('is-compact')).toBe(true);
  });

  it('compact applies to CULTURE variant too', () => {
    const { container: full } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" />
    );
    const { container: compact } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" compact />
    );

    expect(full.querySelector('.ce-preview-culture')?.classList.contains('is-compact')).toBe(false);
    expect(compact.querySelector('.ce-preview-culture')?.classList.contains('is-compact')).toBe(
      true
    );
  });
});

// ── lang="el" coverage ────────────────────────────────────────────────────────

describe('CardPreview — lang="el" coverage (CER-42)', () => {
  it('Greek-bearing nodes (word, plural, Greek question) carry lang="el"', () => {
    // WORD: check word element
    const { container: wordContainer } = renderWithProviders(
      <CardPreview card={buildWordPayload()} cardType="WORD" />
    );
    const greekWord = wordContainer.querySelector('.ce-word');
    expect(greekWord).toHaveAttribute('lang', 'el');

    const greekPlural = wordContainer.querySelector('.ce-grid-cell dd[lang="el"]');
    expect(greekPlural).not.toBeNull();

    // CULTURE: Greek question has lang="el"
    const { container: cultureContainer } = renderWithProviders(
      <CardPreview card={buildCulturePayload()} cardType="CULTURE" />
    );
    const greekQuestion = cultureContainer.querySelector('.ce-q-el');
    expect(greekQuestion).toHaveAttribute('lang', 'el');
  });
});
