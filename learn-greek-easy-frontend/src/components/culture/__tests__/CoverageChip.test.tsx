/**
 * CoverageChip (WEDGE-05-02) — RED as of this commit.
 *
 * `CoverageChip.tsx` is currently a skeleton (`() => null`) — every
 * assertion below fails on `screen.getByTestId('coverage-chip')` throwing
 * "unable to find an element", a clean assertion failure, not a render
 * crash or a missing-i18n-key error (the `mockExam:coverage.*` keys this
 * component will read already exist in both `en/mockExam.json` and
 * `ru/mockExam.json`, added in this same commit). These tests go green once
 * the executor implements the real localized-date + CLDR-plural render
 * logic described in `CoverageChip.tsx`'s contract comment.
 *
 * Covers (architect Test Specs table):
 * - enDate: EN count + updated-date render together
 * - ruDate: RU CLDR "many"-form count + updated-date render together
 * - utcNoOffByOne: the rendered day is the UTC calendar day, not shifted by
 *   a local timezone offset (guards a naive `toLocaleDateString` call
 *   without `timeZone: 'UTC'`)
 * - pluralOne: EN singular "1 question" (no CLDR plural "s")
 * - noDate: `updatedAt=null` renders the no-date variant — plural count,
 *   no "updated" segment
 *
 * Exact date strings below are pinned from this Vitest env's actual ICU
 * output (Node's `Intl`, happy-dom does not shim `Intl`/`Date`), computed
 * via `new Date(<instant>).toLocaleDateString(<locale>, { day: 'numeric',
 * month: 'short', year: 'numeric', timeZone: 'UTC' })` — NOT hardcoded from
 * assumption. EN renders month-first ("Jul 11, 2026"), not the `en-GB`
 * day-first form — there is no `en-GB` locale mapping in this repo's i18n
 * config (`i18n.language` resolves to bare `en`/`ru`), so this is the
 * correct target, a minor deviation from an "11 Jul 2026" literal.
 */
import { describe, it, expect } from 'vitest';

import i18n from '@/i18n';
import { render, screen } from '@/lib/test-utils';

import { CoverageChip } from '../CoverageChip';

describe('CoverageChip (WEDGE-05-02)', () => {
  it('enDate: renders the EN count + localized updated date', () => {
    render(<CoverageChip questionCount={490} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('490 questions');
    expect(chip).toHaveTextContent('Jul 11, 2026');
  });

  it('ruDate: renders the RU CLDR "many"-form count + localized updated date', async () => {
    await i18n.changeLanguage('ru');
    render(<CoverageChip questionCount={490} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    // 490 % 10 === 0 -> Russian CLDR "many" plural category ("вопросов").
    expect(chip).toHaveTextContent('490 вопросов');
    expect(chip).toHaveTextContent('11 июл. 2026 г.');
  });

  it('utcNoOffByOne: renders the UTC calendar day, not a locally-shifted day', () => {
    // 23:59 UTC on the 11th. A render that omits `timeZone: 'UTC'` and lets
    // `toLocaleDateString` fall back to the host's local offset would roll
    // this to the 12th in any UTC+ timezone (this CI/dev host runs EEST,
    // UTC+3). Pinning `timeZone: 'UTC'` keeps it on the 11th everywhere.
    render(<CoverageChip questionCount={10} updatedAt="2026-07-11T23:59:00Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('Jul 11, 2026');
    expect(chip).not.toHaveTextContent('Jul 12, 2026');
  });

  it('pluralOne: renders EN singular "1 question" (no CLDR plural "s")', () => {
    render(<CoverageChip questionCount={1} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('1 question');
    expect(chip.textContent ?? '').not.toMatch(/1 questions\b/);
  });

  it('noDate: renders the no-date variant — plural count, no "updated" segment', () => {
    render(<CoverageChip questionCount={0} updatedAt={null} />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('0 questions');
    expect(chip.textContent ?? '').not.toMatch(/updated/i);
  });

  // ---- QA adversarial: RU CLDR plural-category spread ----
  //
  // The pre-existing `ruDate` test only pins count=490 (the "many" category,
  // since 490 % 10 === 0). Russian has 4 categories (one/few/many/other) —
  // pinning only "many" leaves "one" and "few" unverified; a regression that
  // collapsed the RU resource to `chip_other` for every count (dropping
  // `chip_one`/`chip_few`) would NOT have been caught by the existing suite.
  // These pin count=1 (one), count=2 (few), and count=5 (many) explicitly.

  it('ruPluralOne: RU count=1 resolves the CLDR "one" category ("1 вопрос")', async () => {
    await i18n.changeLanguage('ru');
    render(<CoverageChip questionCount={1} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('1 вопрос ');
    expect(chip.textContent ?? '').not.toMatch(/вопроса|вопросов/);
  });

  it('ruPluralFew: RU count=2 resolves the CLDR "few" category ("2 вопроса")', async () => {
    await i18n.changeLanguage('ru');
    render(<CoverageChip questionCount={2} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('2 вопроса');
    expect(chip.textContent ?? '').not.toMatch(/вопросов\b/);
  });

  it('ruPluralMany: RU count=5 resolves the CLDR "many" category ("5 вопросов")', async () => {
    await i18n.changeLanguage('ru');
    render(<CoverageChip questionCount={5} updatedAt="2026-07-11T14:22:31Z" />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('5 вопросов');
  });

  it('ruNoDatePluralMany: RU chipNoDate count=5 resolves "many" with no date/"обновлено" segment', async () => {
    await i18n.changeLanguage('ru');
    render(<CoverageChip questionCount={5} updatedAt={null} />);

    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveTextContent('5 вопросов');
    expect(chip.textContent ?? '').not.toMatch(/обновлено/i);
  });
});
