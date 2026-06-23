// LEXGEN-12-03 — RED component tests for the read-only proposal DETAIL view.
//
// Authored test-first (Mode A): these target the PRESENTATIONAL component
// `LexgenProposalDetail`, which receives a fully-resolved
// `LexgenProposalDetailResponse` as a prop (no fetching here — the container
// LexgenInboxView owns the useQuery + the `lexgen_proposal_viewed` analytics
// event; those are Stage-4/executor tests). The current stub renders only an
// empty anchor, so every assertion below MUST fail on "unable to find element"
// (assertion-level RED), NOT on import/collection.
//
// Contract note (authoritative DETAIL API, LEXGEN-12-01): there is NO
// top-level `flagged_fields` array on the detail response. Flagged state is
// the per-field `flagged` boolean ONLY. The task-1145 Test Specs phrase their
// inputs as `flagged_fields=["gender"]`; that is realised here by setting the
// per-field `flagged=true` on the matching `fields` / `content` entry.

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type {
  LexgenProposalContentField,
  LexgenProposalDetailResponse,
  LexgenProposalField,
} from '@/services/adminAPI';

import { LexgenProposalDetail } from '../LexgenProposalDetail';

// ── Factory ───────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<LexgenProposalField> = {}): LexgenProposalField {
  return {
    field: 'gender',
    value: 'f',
    source: 'greek_lexicon',
    flagged: false,
    ...overrides,
  };
}

function makeContentField(
  overrides: Partial<LexgenProposalContentField> = {}
): LexgenProposalContentField {
  return {
    field: 'gloss_en',
    value: 'house',
    source: 'lexgen_generator',
    flagged: false,
    ...overrides,
  };
}

function makeProposal(
  overrides: Partial<LexgenProposalDetailResponse> = {}
): LexgenProposalDetailResponse {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    lemma: 'σπίτι',
    pos: 'noun',
    status: 'needs_review',
    created_at: '2026-06-22T10:00:00Z',
    fields: [
      makeField({ field: 'gender', value: 'n', source: 'greek_lexicon' }),
      makeField({ field: 'declension_group', value: 'O-stem', source: 'triantafyllidis' }),
      makeField({ field: 'ipa', value: '/ˈspiti/', source: 'g2p_validator' }),
      makeField({ field: 'frequency_rank', value: '512', source: 'frequency_table' }),
      makeField({ field: 'nominative_singular', value: 'σπίτι', source: 'wiktionary' }),
      makeField({ field: 'genitive_singular', value: 'σπιτιού', source: 'wiktionary' }),
    ],
    content: [
      makeContentField({ field: 'gloss_en', value: 'house' }),
      makeContentField({ field: 'gloss_ru', value: 'дом' }),
      makeContentField({ field: 'example_greek', value: 'Το σπίτι είναι μεγάλο.' }),
      makeContentField({ field: 'example_translation', value: 'The house is big.' }),
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LexgenProposalDetail (LEXGEN-12-03)', () => {
  // AC #1 + #3 (provenance): a morphological field renders its value AND its
  // provenance source on the same view.
  it('renders_per_field_value_and_source', () => {
    const proposal = makeProposal({
      fields: [makeField({ field: 'gender', value: 'm', source: 'greek_lexicon' })],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // value is shown
    expect(screen.getByText('m')).toBeInTheDocument();
    // provenance source is shown for that field
    expect(screen.getByText('greek_lexicon')).toBeInTheDocument();
  });

  // AC #3: glosses / example show with their values + provenance source. The 4
  // content items each render with value + the "lexgen_generator" source.
  it('renders_all_four_content_fields_with_values_and_provenance', () => {
    const proposal = makeProposal();
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // each of the 4 content values appears
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText('дом')).toBeInTheDocument();
    expect(screen.getByText('Το σπίτι είναι μεγάλο.')).toBeInTheDocument();
    expect(screen.getByText('The house is big.')).toBeInTheDocument();

    // content provenance source ("lexgen_generator") is surfaced
    expect(screen.getAllByText('lexgen_generator').length).toBeGreaterThan(0);
  });

  // AC #2: flat form keys render with a human label and their value.
  it('renders_morphological_forms_with_labels', () => {
    const proposal = makeProposal({
      fields: [makeField({ field: 'nominative_singular', value: 'σπίτι', source: 'wiktionary' })],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // the form value appears
    expect(screen.getByText('σπίτι')).toBeInTheDocument();
    // the flat key (or its label) is surfaced — a form row exists for it
    expect(screen.getByText(/nominative.singular/i)).toBeInTheDocument();
  });

  // AC #1 (flagged-marker): the Flagged badge appears ONLY on a flagged
  // morphological field; a non-flagged field row has none.
  it('renders_flagged_badge_only_on_flagged_fields', () => {
    const proposal = makeProposal({
      fields: [
        makeField({ field: 'gender', value: 'n', source: 'greek_lexicon', flagged: true }),
        makeField({ field: 'ipa', value: '/ˈspiti/', source: 'g2p_validator', flagged: false }),
      ],
      content: [],
    });
    const { container } = renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // exactly one flagged badge across the whole detail (only `gender` is flagged)
    const badges = container.querySelectorAll('[data-testid="lexgen-field-flagged-badge"]');
    expect(badges).toHaveLength(1);

    // the flagged badge belongs to the gender row, not the ipa row
    const genderRow = screen.getByTestId('lexgen-field-row-gender');
    const ipaRow = screen.getByTestId('lexgen-field-row-ipa');
    expect(genderRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).not.toBeNull();
    expect(ipaRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).toBeNull();
  });

  // AC #1 (flagged-content, F2): the Flagged badge appears on a flagged content
  // field (example_greek); a non-flagged content row (gloss_en) has none.
  it('renders_flagged_badge_on_flagged_content_field', () => {
    const proposal = makeProposal({
      fields: [],
      content: [
        makeContentField({ field: 'gloss_en', value: 'house', flagged: false }),
        makeContentField({
          field: 'example_greek',
          value: 'Το σπίτι είναι μεγάλο.',
          flagged: true,
        }),
      ],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    const exampleRow = screen.getByTestId('lexgen-field-row-example_greek');
    const glossRow = screen.getByTestId('lexgen-field-row-gloss_en');
    expect(exampleRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).not.toBeNull();
    expect(glossRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).toBeNull();
  });

  // AC #4 (scores-hidden): with a clean payload nothing exposes a rubric digit /
  // confidence / trust label. Only flagged markers are visible.
  //
  // NOTE (RED-trap guard): a pure absence assertion would PASS against the
  // empty stub for the wrong reason. The positive anchor below (the detail
  // actually rendered its field rows) forces this test RED until the real
  // component exists, so it stays meaningful.
  it('renders_no_numeric_score', () => {
    const proposal = makeProposal();
    const { container } = renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // Positive anchor: the detail must actually render field rows (otherwise an
    // empty component would trivially satisfy the absence checks below).
    expect(container.querySelectorAll('[data-testid^="lexgen-field-row-"]').length).toBeGreaterThan(
      0
    );

    expect(screen.queryByText(/score/i)).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
    expect(screen.queryByText(/trust/i)).toBeNull();
    expect(screen.queryByText(/naturalness/i)).toBeNull();
    expect(screen.queryByText(/sense_fit/i)).toBeNull();

    // No element carries a score-bearing test id either.
    expect(container.querySelector('[data-testid*="score"]')).toBeNull();
    expect(container.querySelector('[data-testid*="confidence"]')).toBeNull();
  });

  // AC #4 (F7 poison-pill): even when the payload is deliberately polluted with
  // score-bearing keys, the component renders ONLY value/source/flagged — none
  // of the injected values (4/5/0.9/0.8) or labels appear in the DOM.
  it('ignores_unexpected_score_keys_in_payload', () => {
    // A field entry carrying an unexpected `confidence` key. Built as a loose
    // record so the excess property is attached without an object-literal
    // excess-property error; the whole payload is cast below.
    const poisonedField: Record<string, unknown> = {
      ...makeField({ field: 'gender', value: 'n', source: 'greek_lexicon' }),
      confidence: 0.8,
    };
    const poisoned = {
      ...makeProposal({ fields: [] }),
      fields: [poisonedField],
      // top-level score keys the component must ignore
      judge_scores: { naturalness: 4, sense_fit: 5 },
      trust_score: 0.9,
    } as unknown as LexgenProposalDetailResponse;

    renderWithProviders(<LexgenProposalDetail proposal={poisoned} />);

    // none of the injected score VALUES leak into the DOM
    expect(screen.queryByText('4')).toBeNull();
    expect(screen.queryByText('5')).toBeNull();
    expect(screen.queryByText('0.9')).toBeNull();
    expect(screen.queryByText('0.8')).toBeNull();

    // none of the injected score LABELS leak into the DOM
    expect(screen.queryByText(/naturalness/i)).toBeNull();
    expect(screen.queryByText(/sense_fit/i)).toBeNull();
    expect(screen.queryByText(/trust/i)).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();

    // the legitimate value/source still render (proves we render value/source,
    // not nothing — guards against a trivially-passing "render nothing" impl)
    expect(screen.getByText('n')).toBeInTheDocument();
    expect(screen.getByText('greek_lexicon')).toBeInTheDocument();
  });

  // AC #5 (read-only): no approve/edit/regenerate/reject controls anywhere.
  //
  // NOTE (RED-trap guard): the button-absence check alone would PASS against
  // the empty stub. The positive anchor (the detail rendered its field rows)
  // keeps this test RED until the real component exists.
  it('renders_no_action_controls', () => {
    const proposal = makeProposal();
    const { container } = renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // Positive anchor: the detail must actually render content first.
    expect(container.querySelectorAll('[data-testid^="lexgen-field-row-"]').length).toBeGreaterThan(
      0
    );

    expect(screen.queryByRole('button', { name: /approve|edit|regenerate|reject/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QA adversarial coverage (LEXGEN-12-03) — null/edge values, unknown flat keys,
// flagged on a MORPHOLOGICAL (not content) field, and the no-phantom-row
// invariant. The 8 AC tests cover the happy path + the score-hiding poison
// pill; these probe the brittle edges around `value: null` / `source: null`,
// an unknown form key, and the strict "rows == fields + content" mapping.
// ---------------------------------------------------------------------------

describe('LexgenProposalDetail — adversarial (12-03)', () => {
  it('renders a content field with value=null without crashing (label + provenance still show)', () => {
    const proposal = makeProposal({
      fields: [],
      content: [makeContentField({ field: 'gloss_en', value: null, source: 'lexgen_generator' })],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // The row exists (no crash) and still surfaces its provenance source.
    const row = screen.getByTestId('lexgen-field-row-gloss_en');
    expect(row).toBeInTheDocument();
    expect(row.textContent).toContain('lexgen_generator');
    // The i18n label for gloss_en is rendered (English gloss in the EN test locale).
    expect(row.textContent).toMatch(/English gloss/i);
  });

  it('renders a morphological field with source=null without crashing (no provenance line)', () => {
    const proposal = makeProposal({
      fields: [makeField({ field: 'nominative_singular', value: 'σπίτι', source: null })],
      content: [],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    const row = screen.getByTestId('lexgen-field-row-nominative_singular');
    expect(row).toBeInTheDocument();
    // value still renders…
    expect(row.textContent).toContain('σπίτι');
    // …but with no source there is no "Source:" provenance line in that row.
    expect(row.textContent).not.toMatch(/source/i);
  });

  it('renders an UNKNOWN flat key (no i18n label) as its raw flat key', () => {
    const proposal = makeProposal({
      // nominative_plural is a valid form key but is NOT in KNOWN_FIELD_LABEL_KEYS,
      // so it must fall back to rendering the raw flat key as the label.
      fields: [makeField({ field: 'nominative_plural', value: 'σπίτια', source: 'wiktionary' })],
      content: [],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    const row = screen.getByTestId('lexgen-field-row-nominative_plural');
    expect(row).toBeInTheDocument();
    // The label is the raw flat key (it bypasses t() entirely).
    expect(row.textContent).toContain('nominative_plural');
    expect(row.textContent).toContain('σπίτια');
  });

  it('shows the Flagged badge on a flagged MORPHOLOGICAL form key (not just scalars/content)', () => {
    const proposal = makeProposal({
      fields: [
        makeField({
          field: 'genitive_singular',
          value: 'σπιτιού',
          source: 'wiktionary',
          flagged: true,
        }),
        makeField({
          field: 'nominative_singular',
          value: 'σπίτι',
          source: 'wiktionary',
          flagged: false,
        }),
      ],
      content: [],
    });
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    const flaggedRow = screen.getByTestId('lexgen-field-row-genitive_singular');
    const cleanRow = screen.getByTestId('lexgen-field-row-nominative_singular');
    expect(flaggedRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).not.toBeNull();
    expect(cleanRow.querySelector('[data-testid="lexgen-field-flagged-badge"]')).toBeNull();
  });

  it('renders exactly fields.length + content.length rows — no phantom rows from stray keys', () => {
    const proposal = makeProposal(); // 6 fields + 4 content = 10 rows
    const { container } = renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    const rows = container.querySelectorAll('[data-testid^="lexgen-field-row-"]');
    expect(rows).toHaveLength(proposal.fields.length + proposal.content.length);
    expect(rows).toHaveLength(10);
  });

  it('renders the read-only note (no action surface in this slice)', () => {
    const proposal = makeProposal();
    renderWithProviders(<LexgenProposalDetail proposal={proposal} />);

    // EN locale note from lexgenInbox.detail.readOnlyNote.
    // Value updated in LEXGEN-13-04 to "Review and take action using the controls below."
    expect(
      screen.getByText(/Review and take action using the controls below/i)
    ).toBeInTheDocument();
  });
});
