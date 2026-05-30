/**
 * pf/questions/Declension.tsx -- unit tests (PRACT2-1-05)
 *
 * Covers:
 * - Full paradigm: all 4 case rows render
 * - Non-target cells show their real form
 * - Target cell (highlight_singular) shows "?" when revealed=false
 * - Target cell (highlight_singular) shows real form when revealed=true
 * - Target cell (highlight_plural) shows "?" when revealed=false
 * - Target cell (highlight_plural) shows real form when revealed=true
 * - Target cell has class pf-cell-target + is-blank when not revealed
 * - Target cell has class pf-cell-target + is-revealed when revealed
 * - Lemma row: rows[0].singular used as Greek lemma
 * - Lemma row: lang="el" on the Greek span
 * - Lemma row: no italic on Greek span (font-style not italic)
 * - Lemma row: English gloss shown from front_content.hint when present
 * - Lemma row: English gloss absent when front_content.hint not present
 * - No red dot (UnwiredDot) is rendered
 * - Graceful degradation: renders without crash when declension_table absent
 * - Graceful degradation: renders without crash when rows is empty
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Declension } from '../questions/Declension';

// -- Test fixtures ------------------------------------------------------------

const ROWS_SG_TARGET = [
  {
    case: 'Nominative',
    singular: 'άντρας',
    plural: 'άντρες',
    highlight_singular: false,
    highlight_plural: false,
  },
  {
    case: 'Genitive',
    singular: 'άντρα',
    plural: 'αντρών',
    highlight_singular: true, // <-- target: singular genitive
    highlight_plural: false,
  },
  {
    case: 'Accusative',
    singular: 'άντρα',
    plural: 'άντρες',
    highlight_singular: false,
    highlight_plural: false,
  },
  {
    case: 'Vocative',
    singular: 'άντρα',
    plural: 'άντρες',
    highlight_singular: false,
    highlight_plural: false,
  },
];

const ROWS_PL_TARGET = [
  {
    case: 'Nominative',
    singular: 'γυναίκα',
    plural: 'γυναίκες',
    highlight_singular: false,
    highlight_plural: false,
  },
  {
    case: 'Genitive',
    singular: 'γυναίκας',
    plural: 'γυναικών',
    highlight_singular: false,
    highlight_plural: false,
  },
  {
    case: 'Accusative',
    singular: 'γυναίκα',
    plural: 'γυναίκες',
    highlight_singular: false,
    highlight_plural: true, // <-- target: plural accusative
  },
  {
    case: 'Vocative',
    singular: 'γυναίκα',
    plural: 'γυναίκες',
    highlight_singular: false,
    highlight_plural: false,
  },
];

function makeCard(rows: typeof ROWS_SG_TARGET, hint?: string) {
  return {
    back_content: {
      declension_table: {
        gender: 'Masculine',
        rows,
      },
    } as Record<string, unknown>,
    front_content: {
      ...(hint !== undefined ? { hint } : {}),
    } as Record<string, unknown>,
  };
}

// -- Full paradigm renders ----------------------------------------------------

describe('Declension (full paradigm)', () => {
  it('renders the pf-declension container', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-declension"]')).not.toBeNull();
  });

  it('renders the paradigm grid', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-decl-grid"]')).not.toBeNull();
  });

  it('renders all 4 case rows', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-decl-row-nominative"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-decl-row-genitive"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-decl-row-accusative"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-decl-row-vocative"]')).not.toBeNull();
  });

  it('non-target cells show their real form', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    // Nominative sg (rows[0].singular) is not a target -- should be visible in the table
    // Use getAllByText since the same form appears in lemma row + table cell
    const matches = container.querySelectorAll('.pf-decl-table__cell');
    const hasNomSg = Array.from(matches).some((el) => el.textContent === 'άντρας');
    expect(hasNomSg).toBe(true);
  });
});

// -- Target cell: singular highlight ------------------------------------------

describe('Declension target cell (highlight_singular)', () => {
  it('shows "?" in the target cell when not revealed', () => {
    render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.textContent).toBe('?');
  });

  it('target cell has pf-cell-target + is-blank classes when not revealed', () => {
    render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.classList.contains('pf-cell-target')).toBe(true);
    expect(target.classList.contains('is-blank')).toBe(true);
    expect(target.classList.contains('is-revealed')).toBe(false);
  });

  it('shows the real form in the target cell when revealed', () => {
    render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={true} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.textContent).toBe('άντρα');
  });

  it('target cell has pf-cell-target + is-revealed classes when revealed', () => {
    render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={true} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.classList.contains('pf-cell-target')).toBe(true);
    expect(target.classList.contains('is-revealed')).toBe(true);
    expect(target.classList.contains('is-blank')).toBe(false);
  });
});

// -- Target cell: plural highlight --------------------------------------------

describe('Declension target cell (highlight_plural)', () => {
  it('shows "?" in the plural target cell when not revealed', () => {
    render(<Declension card={makeCard(ROWS_PL_TARGET)} revealed={false} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.textContent).toBe('?');
  });

  it('shows the real plural form in the target cell when revealed', () => {
    render(<Declension card={makeCard(ROWS_PL_TARGET)} revealed={true} />);
    const target = screen.getByTestId('pf-decl-target');
    expect(target.textContent).toBe('γυναίκες');
  });
});

// -- Lemma row ----------------------------------------------------------------

describe('Declension lemma row', () => {
  it('renders the lemma row', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-decl-lemma"]')).not.toBeNull();
  });

  it('lemma uses rows[0].singular as the Greek text', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    // rows[0].singular = 'άντρας' -- should appear in the lemma el span
    const lemmaEl = container.querySelector('.pf-decl-lemma__el');
    expect(lemmaEl?.textContent).toBe('άντρας');
  });

  it('lemma Greek span has lang="el"', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    const el = container.querySelector('.pf-decl-lemma__el');
    expect(el?.getAttribute('lang')).toBe('el');
  });

  it('lemma Greek span does NOT have inline font-style italic', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    const el = container.querySelector('.pf-decl-lemma__el') as HTMLElement | null;
    expect(el?.style?.fontStyle).not.toBe('italic');
  });

  it('shows English gloss from front_content.hint when present', () => {
    render(<Declension card={makeCard(ROWS_SG_TARGET, 'man')} revealed={false} />);
    expect(screen.getByTestId('pf-decl-gloss')).not.toBeNull();
    expect(screen.getByText('man', { exact: false })).not.toBeNull();
  });

  it('omits English gloss when front_content.hint is absent', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-decl-gloss"]')).toBeNull();
  });
});

// -- No red dot ---------------------------------------------------------------

describe('Declension (no red dot)', () => {
  it('does NOT render an UnwiredDot / data-testid="unwired-dot"', () => {
    const { container } = render(<Declension card={makeCard(ROWS_SG_TARGET)} revealed={false} />);
    expect(container.querySelector('[data-testid="unwired-dot"]')).toBeNull();
  });
});

// -- Graceful degradation -----------------------------------------------------

describe('Declension (graceful degradation)', () => {
  it('renders without crash when declension_table is absent', () => {
    const card = {
      back_content: {} as Record<string, unknown>,
      front_content: {} as Record<string, unknown>,
    };
    const { container } = render(<Declension card={card} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-declension"]')).not.toBeNull();
  });

  it('renders without crash when rows is empty array', () => {
    const card = {
      back_content: {
        declension_table: { gender: 'Masculine', rows: [] },
      } as Record<string, unknown>,
      front_content: {} as Record<string, unknown>,
    };
    const { container } = render(<Declension card={card} revealed={false} />);
    expect(container.querySelector('[data-testid="pf-declension"]')).not.toBeNull();
  });
});
