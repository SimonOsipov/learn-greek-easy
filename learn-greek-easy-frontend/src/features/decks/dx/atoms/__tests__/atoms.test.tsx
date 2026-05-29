/**
 * DX Atoms Tests — DX-01
 *
 * Tests for the dx presentational atoms:
 * - Kicker: tone → data-tone
 * - TypeChip: tone → data-tone
 * - DonutRing: strokeDashoffset math, NaN guard
 * - WeekHeat: 7 cells, clamp, today outline
 * - UnwiredDot: a11y label, amber tone
 * - Breadcrumb: last item is current, intermediate item navigates
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import { Breadcrumb } from '../Breadcrumb';
import { DonutRing } from '../DonutRing';
import { DxSvgDefs } from '../DxSvgDefs';
import { Kicker } from '../Kicker';
import { TypeChip } from '../TypeChip';
import { UnwiredDot } from '../UnwiredDot';
import { WeekHeat } from '../WeekHeat';

// ─── Kicker ──────────────────────────────────────────────────────────────────

describe('Kicker', () => {
  const tones = ['primary', 'violet', 'cyan', 'amber', 'green', 'white'] as const;

  tones.forEach((tone) => {
    it(`renders correct data-tone="${tone}"`, () => {
      render(<Kicker tone={tone}>Label</Kicker>);
      const el = screen.getByText('Label');
      expect(el).toHaveAttribute('data-tone', tone);
    });
  });

  it('defaults to data-tone="primary" when tone omitted', () => {
    render(<Kicker>Label</Kicker>);
    expect(screen.getByText('Label')).toHaveAttribute('data-tone', 'primary');
  });

  it('forwards className prop', () => {
    render(<Kicker className="extra">Label</Kicker>);
    const el = screen.getByText('Label');
    expect(el.className).toContain('extra');
    expect(el.className).toContain('dx-kicker');
  });
});

// ─── TypeChip ────────────────────────────────────────────────────────────────

describe('TypeChip', () => {
  const tones = ['primary', 'violet', 'cyan', 'amber', 'green'] as const;

  tones.forEach((tone) => {
    it(`renders correct data-tone="${tone}"`, () => {
      render(<TypeChip tone={tone}>Chip</TypeChip>);
      expect(screen.getByText('Chip')).toHaveAttribute('data-tone', tone);
    });
  });

  it('omits data-tone attribute when tone is undefined', () => {
    render(<TypeChip>Chip</TypeChip>);
    // attribute should not be present (or be null)
    const el = screen.getByText('Chip');
    expect(el.getAttribute('data-tone')).toBeNull();
  });
});

// ─── DonutRing ───────────────────────────────────────────────────────────────

const R = 34;
const C = 2 * Math.PI * R;

describe('DonutRing', () => {
  it('offset=C (0%) when done=0, total=15', () => {
    const { container } = render(<DonutRing done={0} total={15} />);
    const fill = container.querySelector('.dx-ring-fill');
    expect(fill).not.toBeNull();
    const offset = parseFloat(fill!.getAttribute('stroke-dashoffset')!);
    expect(offset).toBeCloseTo(C, 4);
  });

  it('offset=0 (100%) when done=15, total=15', () => {
    const { container } = render(<DonutRing done={15} total={15} />);
    const fill = container.querySelector('.dx-ring-fill');
    const offset = parseFloat(fill!.getAttribute('stroke-dashoffset')!);
    expect(offset).toBeCloseTo(0, 4);
  });

  it('offset=C (0%) and no NaN when total=0', () => {
    const { container } = render(<DonutRing done={3} total={0} />);
    const fill = container.querySelector('.dx-ring-fill');
    const offset = parseFloat(fill!.getAttribute('stroke-dashoffset')!);
    expect(Number.isNaN(offset)).toBe(false);
    expect(offset).toBeCloseTo(C, 4);
  });

  it('stroke references #dxringGrad', () => {
    const { container } = render(<DonutRing done={5} total={10} />);
    const fill = container.querySelector('.dx-ring-fill');
    expect(fill?.getAttribute('stroke')).toBe('url(#dxringGrad)');
  });
});

// ─── WeekHeat ────────────────────────────────────────────────────────────────

describe('WeekHeat', () => {
  it('renders exactly 7 cells', () => {
    const { container } = render(<WeekHeat heat={[1, 2, 3, 4, 5, 3, 1]} />);
    const cells = container.querySelectorAll('.dx-week-cell');
    expect(cells).toHaveLength(7);
  });

  it('clamps heat value 7 → data-h="5"', () => {
    const { container } = render(<WeekHeat heat={[7, 0, 0, 0, 0, 0, 0]} />);
    const cells = container.querySelectorAll('.dx-week-cell');
    expect(cells[0]).toHaveAttribute('data-h', '5');
  });

  it('clamps heat value -1 → data-h="0"', () => {
    const { container } = render(<WeekHeat heat={[-1, 0, 0, 0, 0, 0, 0]} />);
    const cells = container.querySelectorAll('.dx-week-cell');
    expect(cells[0]).toHaveAttribute('data-h', '0');
  });

  it('todayIdx cell gets dx-week-today class', () => {
    const { container } = render(<WeekHeat heat={[1, 1, 1, 1, 1, 1, 1]} todayIdx={3} />);
    const cells = container.querySelectorAll('.dx-week-cell');
    expect(cells[3]).toHaveClass('dx-week-today');
    // Other cells should not have the today class
    expect(cells[0]).not.toHaveClass('dx-week-today');
  });

  it('no cell has dx-week-today when todayIdx is undefined', () => {
    const { container } = render(<WeekHeat heat={[1, 2, 3, 4, 5, 3, 1]} />);
    const todayCells = container.querySelectorAll('.dx-week-today');
    expect(todayCells).toHaveLength(0);
  });
});

// ─── UnwiredDot ──────────────────────────────────────────────────────────────

describe('UnwiredDot', () => {
  it('has the exact default aria-label when none passed', () => {
    const { container } = render(<UnwiredDot />);
    const wrapper = container.querySelector('.dx-unwired-dot');
    expect(wrapper).toHaveAttribute(
      'aria-label',
      'Placeholder — not yet connected to backend data.'
    );
  });

  it('forwards a custom aria-label when provided', () => {
    const { container } = render(
      <UnwiredDot aria-label="Practice heatmap — placeholder, not yet connected to backend data." />
    );
    const wrapper = container.querySelector('.dx-unwired-dot');
    expect(wrapper).toHaveAttribute(
      'aria-label',
      'Practice heatmap — placeholder, not yet connected to backend data.'
    );
  });

  it('marker is aria-hidden', () => {
    const { container } = render(<UnwiredDot />);
    const marker = container.querySelector('.dx-unwired-dot-marker');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
  });

  it('tone="amber" sets data-tone="amber" on marker', () => {
    const { container } = render(<UnwiredDot tone="amber" />);
    const marker = container.querySelector('.dx-unwired-dot-marker');
    expect(marker).toHaveAttribute('data-tone', 'amber');
  });

  it('default tone (danger) has no data-tone attribute on marker', () => {
    const { container } = render(<UnwiredDot />);
    const marker = container.querySelector('.dx-unwired-dot-marker');
    expect(marker?.getAttribute('data-tone')).toBeNull();
  });
});

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

describe('Breadcrumb', () => {
  const trail = [
    { label: 'Home', to: '/' },
    { label: 'Decks', to: '/decks' },
    { label: 'Greek House' },
  ];

  it('last item is current (no <a> link)', () => {
    render(
      <MemoryRouter>
        <Breadcrumb trail={trail} />
      </MemoryRouter>
    );
    const cur = screen.getByText('Greek House');
    expect(cur.tagName).not.toBe('A');
    expect(cur).toHaveAttribute('aria-current', 'page');
  });

  it('intermediate items render as links', () => {
    render(
      <MemoryRouter>
        <Breadcrumb trail={trail} />
      </MemoryRouter>
    );
    const decksLink = screen.getByText('Decks');
    expect(decksLink.closest('a')).not.toBeNull();
  });

  it('first item has correct href', () => {
    render(
      <MemoryRouter>
        <Breadcrumb trail={trail} />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });
});

// ─── DxSvgDefs ───────────────────────────────────────────────────────────────

describe('DxSvgDefs', () => {
  it('renders exactly one #dxringGrad gradient', () => {
    const { container } = render(<DxSvgDefs />);
    const grads = container.querySelectorAll('#dxringGrad');
    expect(grads).toHaveLength(1);
  });

  it('is aria-hidden', () => {
    const { container } = render(<DxSvgDefs />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
