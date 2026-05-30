/**
 * pf/PracticeApp.tsx — component tests (PRACT2-1-01)
 *
 * Covers:
 * - Renders .pf-app host with correct data-fam for each family
 * - Sets --pf-c / --pf-glow-1 / --pf-glow-2 inline vars referencing the correct token
 * - data-ambient="off" when ambient={false}
 * - data-ambient="on" by default
 * - data-fam updates when cardType prop changes
 * - Renders children inside the host
 */

import React from 'react';

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { CardRecordType } from '@/services/wordEntryAPI';

import { PracticeApp } from '../PracticeApp';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHost(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.pf-app') as HTMLElement | null;
  if (!el) throw new Error('.pf-app not found');
  return el;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PracticeApp', () => {
  it('renders a .pf-app host element', () => {
    const { container } = render(
      <PracticeApp>
        <span>test</span>
      </PracticeApp>
    );
    expect(container.querySelector('.pf-app')).not.toBeNull();
  });

  it('renders children inside the host', () => {
    const { getByText } = render(
      <PracticeApp cardType="meaning_el_to_en">
        <span>hello</span>
      </PracticeApp>
    );
    expect(getByText('hello')).not.toBeNull();
  });

  // data-fam for each live card type mapping
  const FAM_CASES: Array<[CardRecordType, string]> = [
    ['meaning_el_to_en', 'translation'],
    ['meaning_en_to_el', 'translation'],
    ['sentence_translation', 'sentence'],
    ['cloze', 'sentence'],
    ['conjugation', 'grammar'],
    ['article', 'grammar'],
    ['declension', 'declension'],
    ['plural_form', 'declension'],
  ];

  it.each(FAM_CASES)('card_type "%s" sets data-fam="%s"', (cardType, expectedFam) => {
    const { container } = render(
      <PracticeApp cardType={cardType}>
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-fam')).toBe(expectedFam);
  });

  it('null cardType → data-fam="translation" (fallback)', () => {
    const { container } = render(
      <PracticeApp cardType={null}>
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-fam')).toBe('translation');
  });

  it('undefined cardType → data-fam="translation" (fallback)', () => {
    const { container } = render(
      <PracticeApp>
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-fam')).toBe('translation');
  });

  it('data-ambient="on" by default', () => {
    const { container } = render(
      <PracticeApp>
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-ambient')).toBe('on');
  });

  it('data-ambient="off" when ambient={false} (AC #4)', () => {
    const { container } = render(
      <PracticeApp ambient={false}>
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-ambient')).toBe('off');
  });

  it('sets --pf-c inline var referencing --primary for translation', () => {
    const { container } = render(
      <PracticeApp cardType="meaning_el_to_en">
        <span />
      </PracticeApp>
    );
    const style = getHost(container).getAttribute('style') ?? '';
    expect(style).toContain('--pf-c');
    expect(style).toContain('--primary');
  });

  it('sets --pf-glow-1 and --pf-glow-2 inline vars', () => {
    const { container } = render(
      <PracticeApp cardType="conjugation">
        <span />
      </PracticeApp>
    );
    const style = getHost(container).getAttribute('style') ?? '';
    expect(style).toContain('--pf-glow-1');
    expect(style).toContain('--pf-glow-2');
  });

  it('sets --pf-c referencing --accent for grammar family', () => {
    const { container } = render(
      <PracticeApp cardType="conjugation">
        <span />
      </PracticeApp>
    );
    const style = getHost(container).getAttribute('style') ?? '';
    expect(style).toContain('--accent');
  });

  it('updates data-fam when cardType prop changes', () => {
    const { container, rerender } = render(
      <PracticeApp cardType="meaning_el_to_en">
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-fam')).toBe('translation');

    rerender(
      <PracticeApp cardType="conjugation">
        <span />
      </PracticeApp>
    );
    expect(getHost(container).getAttribute('data-fam')).toBe('grammar');
  });
});
