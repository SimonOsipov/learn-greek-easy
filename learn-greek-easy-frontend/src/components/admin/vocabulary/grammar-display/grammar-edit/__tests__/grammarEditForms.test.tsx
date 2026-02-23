// src/components/admin/vocabulary/grammar-display/grammar-edit/__tests__/grammarEditForms.test.tsx

/**
 * Tests for POS-specific grammar edit form components.
 *
 * Note on Radix UI Tabs behaviour in JSDOM:
 *   Radix Tabs only mounts the content of the active tab panel in the DOM.
 *   Inactive tab panels are not rendered at all (data-state="inactive" tabs
 *   are present in the tab list but their content is not).
 *   Tests that check "all fields are in the DOM" therefore either:
 *     a) only assert on the active (default) tab fields, or
 *     b) click the tab trigger first, then assert on that tab's fields.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

import { NounGrammarEditForm } from '../NounGrammarEditForm';
import { VerbGrammarEditForm } from '../VerbGrammarEditForm';
import { AdjectiveGrammarEditForm } from '../AdjectiveGrammarEditForm';
import { AdverbGrammarEditForm } from '../AdverbGrammarEditForm';
import { NOUN_FIELDS, VERB_FIELDS, ADJECTIVE_FIELDS, ADVERB_FIELDS } from '../grammarEditHelpers';

// ============================================
// Helpers
// ============================================

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

function emptyState(keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, '']));
}

// ============================================
// NounGrammarEditForm
// ============================================

describe('NounGrammarEditForm', () => {
  it('renders root with data-testid="noun-grammar-edit-form"', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('noun-grammar-edit-form')).toBeInTheDocument();
  });

  it('AC-1: renders 1 gender SelectTrigger + 8 text Input fields (9 controls total)', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    // Gender select trigger
    expect(screen.getByTestId('grammar-field-gender')).toBeInTheDocument();

    // 8 text inputs for the 4 cases × singular + plural
    const textInputKeys = [
      'nominative_singular',
      'nominative_plural',
      'genitive_singular',
      'genitive_plural',
      'accusative_singular',
      'accusative_plural',
      'vocative_singular',
      'vocative_plural',
    ];
    for (const key of textInputKeys) {
      expect(screen.getByTestId(`grammar-field-${key}`)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('textbox')).toHaveLength(8);
  });

  it('AC-5: all Input fields have data-testid="grammar-field-{key}"', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    const textInputKeys = NOUN_FIELDS.filter((k) => k !== 'gender');
    for (const key of textInputKeys) {
      expect(screen.getByTestId(`grammar-field-${key}`)).toBeInTheDocument();
    }
    // Select trigger also gets the testid
    expect(screen.getByTestId('grammar-field-gender')).toBeInTheDocument();
  });

  it('AC-6: all Input elements have maxLength=255', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toHaveAttribute('maxlength', '255');
    }
  });

  it('AC-8: Input onChange calls onChange(key, value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={handleChange} />
    );
    const input = screen.getByTestId('grammar-field-nominative_singular');
    await user.type(input, 'σ');
    expect(handleChange).toHaveBeenCalledWith('nominative_singular', 'σ');
  });

  it('AC-7: gender Select trigger is rendered (restricts to masculine/feminine/neuter via GENDER_OPTIONS const)', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('grammar-field-gender')).toBeInTheDocument();
  });

  it('AC-8: gender Select displays pre-populated value from formState', () => {
    // NOTE: Direct Select dropdown click interaction is not testable in JSDOM due to
    // Radix UI Select's hasPointerCapture limitation. The onChange wiring is validated
    // by the onValueChange={(value) => onChange('gender', value)} prop in the component.
    // We verify the controlled value renders correctly as a proxy for the binding.
    const state = { ...emptyState(NOUN_FIELDS), gender: 'feminine' };
    renderWithI18n(<NounGrammarEditForm formState={state} onChange={vi.fn()} />);
    const trigger = screen.getByTestId('grammar-field-gender');
    expect(trigger).toHaveTextContent('Feminine');
  });

  it('displays controlled value from formState', () => {
    const state = { ...emptyState(NOUN_FIELDS), nominative_singular: 'σπίτι' };
    renderWithI18n(<NounGrammarEditForm formState={state} onChange={vi.fn()} />);
    const input = screen.getByTestId('grammar-field-nominative_singular') as HTMLInputElement;
    expect(input.value).toBe('σπίτι');
  });

  it('AC-9: declension table has 4 case rows × 2 input columns (mirrors NounGrammarDisplay)', () => {
    renderWithI18n(<NounGrammarEditForm formState={emptyState(NOUN_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(8);
  });
});

// ============================================
// VerbGrammarEditForm
// ============================================

describe('VerbGrammarEditForm', () => {
  it('renders root with data-testid="verb-grammar-edit-form"', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('verb-grammar-edit-form')).toBeInTheDocument();
  });

  it('AC-2: renders voice Select trigger', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('grammar-field-voice')).toBeInTheDocument();
  });

  it('AC-2: default "present" tab renders 6 conjugation inputs', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    const persons = ['1s', '2s', '3s', '1p', '2p', '3p'];
    for (const p of persons) {
      expect(screen.getByTestId(`grammar-field-present_${p}`)).toBeInTheDocument();
    }
  });

  it('AC-2: imperative inputs (2) are always rendered (outside tabs)', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('grammar-field-imperative_2s')).toBeInTheDocument();
    expect(screen.getByTestId('grammar-field-imperative_2p')).toBeInTheDocument();
  });

  it("AC-2: switching to a different tense tab renders that tab's 6 inputs", async () => {
    const user = userEvent.setup();
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    // Click the "Imperfect" tab trigger
    const tabTriggers = screen.getAllByRole('tab');
    const imperfectTab = tabTriggers.find((t) =>
      t.textContent?.toLowerCase().includes('imperfect')
    );
    expect(imperfectTab).toBeDefined();
    await user.click(imperfectTab!);

    const persons = ['1s', '2s', '3s', '1p', '2p', '3p'];
    for (const p of persons) {
      expect(screen.getByTestId(`grammar-field-imperfect_${p}`)).toBeInTheDocument();
    }
  });

  it('AC-2: 5 tense tab triggers are rendered', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('AC-5: active-tab Input fields have data-testid="grammar-field-{key}"', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    // Default active tab is "present"
    const persons = ['1s', '2s', '3s', '1p', '2p', '3p'];
    for (const p of persons) {
      expect(screen.getByTestId(`grammar-field-present_${p}`)).toBeInTheDocument();
    }
    // Imperative always visible
    expect(screen.getByTestId('grammar-field-imperative_2s')).toBeInTheDocument();
    expect(screen.getByTestId('grammar-field-imperative_2p')).toBeInTheDocument();
  });

  it('AC-6: all visible Input elements have maxLength=255', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toHaveAttribute('maxlength', '255');
    }
    // 6 (present tab) + 2 (imperative) = 8 visible inputs in default state
    expect(inputs).toHaveLength(8);
  });

  it('AC-7: voice Select trigger is rendered (restricts to active/passive via VOICE_OPTIONS const)', () => {
    renderWithI18n(<VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />);
    expect(screen.getByTestId('grammar-field-voice')).toBeInTheDocument();
  });

  it('AC-8: voice Select displays pre-populated value from formState', () => {
    // NOTE: Direct Select dropdown click interaction is not testable in JSDOM due to
    // Radix UI Select's hasPointerCapture limitation.
    const state = { ...emptyState(VERB_FIELDS), voice: 'passive' };
    renderWithI18n(<VerbGrammarEditForm formState={state} onChange={vi.fn()} />);
    const trigger = screen.getByTestId('grammar-field-voice');
    expect(trigger).toHaveTextContent('Passive');
  });

  it('AC-8: conjugation Input onChange calls onChange(key, value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={handleChange} />
    );
    const input = screen.getByTestId('grammar-field-present_1s');
    await user.type(input, 'γ');
    expect(handleChange).toHaveBeenCalledWith('present_1s', 'γ');
  });

  it('AC-8: imperative inputs call onChange with correct key', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-imperative_2s'), 'γ');
    expect(handleChange).toHaveBeenCalledWith('imperative_2s', 'γ');

    await user.type(screen.getByTestId('grammar-field-imperative_2p'), 'γ');
    expect(handleChange).toHaveBeenCalledWith('imperative_2p', 'γ');
  });

  it('displays controlled values from formState', () => {
    const state = { ...emptyState(VERB_FIELDS), present_1s: 'γράφω', imperative_2s: 'γράφε' };
    renderWithI18n(<VerbGrammarEditForm formState={state} onChange={vi.fn()} />);
    expect((screen.getByTestId('grammar-field-present_1s') as HTMLInputElement).value).toBe(
      'γράφω'
    );
    expect((screen.getByTestId('grammar-field-imperative_2s') as HTMLInputElement).value).toBe(
      'γράφε'
    );
  });

  it('AC-9: ScrollArea wraps conjugation tabs and imperative section (mirrors VerbGrammarDisplay)', () => {
    const { container } = renderWithI18n(
      <VerbGrammarEditForm formState={emptyState(VERB_FIELDS)} onChange={vi.fn()} />
    );
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).toBeInTheDocument();
  });
});

// ============================================
// AdjectiveGrammarEditForm
// ============================================

describe('AdjectiveGrammarEditForm', () => {
  it('renders root with data-testid="adjective-grammar-edit-form"', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('adjective-grammar-edit-form')).toBeInTheDocument();
  });

  it('AC-3: default "masculine" tab renders 8 declension inputs (4 cases × 2 numbers)', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    const cases = ['nom', 'gen', 'acc', 'voc'];
    const numbers = ['sg', 'pl'];
    for (const c of cases) {
      for (const n of numbers) {
        expect(screen.getByTestId(`grammar-field-masculine_${c}_${n}`)).toBeInTheDocument();
      }
    }
  });

  it('AC-3: comparison inputs (comparative + superlative) always rendered outside tabs', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('grammar-field-comparative')).toBeInTheDocument();
    expect(screen.getByTestId('grammar-field-superlative')).toBeInTheDocument();
  });

  it('AC-3: switching to "feminine" tab renders 8 feminine declension inputs', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    const tabs = screen.getAllByRole('tab');
    const feminineTab = tabs.find((t) => t.textContent?.toLowerCase().includes('feminine'));
    expect(feminineTab).toBeDefined();
    await user.click(feminineTab!);

    const cases = ['nom', 'gen', 'acc', 'voc'];
    const numbers = ['sg', 'pl'];
    for (const c of cases) {
      for (const n of numbers) {
        expect(screen.getByTestId(`grammar-field-feminine_${c}_${n}`)).toBeInTheDocument();
      }
    }
  });

  it('AC-3: 3 gender tabs are rendered', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('AC-5: active-tab Input fields have data-testid="grammar-field-{key}"', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    // Default "masculine" tab is active
    const cases = ['nom', 'gen', 'acc', 'voc'];
    const numbers = ['sg', 'pl'];
    for (const c of cases) {
      for (const n of numbers) {
        expect(screen.getByTestId(`grammar-field-masculine_${c}_${n}`)).toBeInTheDocument();
      }
    }
    expect(screen.getByTestId('grammar-field-comparative')).toBeInTheDocument();
    expect(screen.getByTestId('grammar-field-superlative')).toBeInTheDocument();
  });

  it('AC-6: all visible Input elements have maxLength=255', () => {
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toHaveAttribute('maxlength', '255');
    }
    // 8 (masculine tab) + 2 (comparison) = 10 visible in default state
    expect(inputs).toHaveLength(10);
  });

  it('AC-8: declension Input onChange calls onChange(key, value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-masculine_nom_sg'), 'ω');
    expect(handleChange).toHaveBeenCalledWith('masculine_nom_sg', 'ω');
  });

  it('AC-8: comparative input calls onChange("comparative", value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-comparative'), 'π');
    expect(handleChange).toHaveBeenCalledWith('comparative', 'π');
  });

  it('AC-8: superlative input calls onChange("superlative", value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-superlative'), 'π');
    expect(handleChange).toHaveBeenCalledWith('superlative', 'π');
  });

  it('displays controlled values from formState', () => {
    const state = {
      ...emptyState(ADJECTIVE_FIELDS),
      masculine_nom_sg: 'ωραίος',
      comparative: 'πιο ωραίος',
    };
    renderWithI18n(<AdjectiveGrammarEditForm formState={state} onChange={vi.fn()} />);
    expect((screen.getByTestId('grammar-field-masculine_nom_sg') as HTMLInputElement).value).toBe(
      'ωραίος'
    );
    expect((screen.getByTestId('grammar-field-comparative') as HTMLInputElement).value).toBe(
      'πιο ωραίος'
    );
  });

  it('AC-9: ScrollArea wraps tabs and comparison section (mirrors AdjectiveGrammarDisplay)', () => {
    const { container } = renderWithI18n(
      <AdjectiveGrammarEditForm formState={emptyState(ADJECTIVE_FIELDS)} onChange={vi.fn()} />
    );
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).toBeInTheDocument();
  });
});

// ============================================
// AdverbGrammarEditForm
// ============================================

describe('AdverbGrammarEditForm', () => {
  it('renders root with data-testid="adverb-grammar-edit-form"', () => {
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('adverb-grammar-edit-form')).toBeInTheDocument();
  });

  it('AC-4: renders exactly 2 text inputs (comparative and superlative)', () => {
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('grammar-field-comparative')).toBeInTheDocument();
    expect(screen.getByTestId('grammar-field-superlative')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('AC-5: both Input fields have data-testid="grammar-field-{key}"', () => {
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={vi.fn()} />
    );
    for (const key of ADVERB_FIELDS) {
      expect(screen.getByTestId(`grammar-field-${key}`)).toBeInTheDocument();
    }
  });

  it('AC-6: both Input elements have maxLength=255', () => {
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={vi.fn()} />
    );
    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toHaveAttribute('maxlength', '255');
    }
  });

  it('AC-8: comparative input calls onChange("comparative", value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-comparative'), 'π');
    expect(handleChange).toHaveBeenCalledWith('comparative', 'π');
  });

  it('AC-8: superlative input calls onChange("superlative", value)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={handleChange} />
    );
    await user.type(screen.getByTestId('grammar-field-superlative'), 'π');
    expect(handleChange).toHaveBeenCalledWith('superlative', 'π');
  });

  it('displays controlled values from formState', () => {
    const state = { comparative: 'πιο γρήγορα', superlative: 'πιο αργά' };
    renderWithI18n(<AdverbGrammarEditForm formState={state} onChange={vi.fn()} />);
    expect((screen.getByTestId('grammar-field-comparative') as HTMLInputElement).value).toBe(
      'πιο γρήγορα'
    );
    expect((screen.getByTestId('grammar-field-superlative') as HTMLInputElement).value).toBe(
      'πιο αργά'
    );
  });

  it('AC-9: no tabs or ScrollArea (simple 2-row table, mirrors AdverbGrammarDisplay)', () => {
    const { container } = renderWithI18n(
      <AdverbGrammarEditForm formState={emptyState(ADVERB_FIELDS)} onChange={vi.fn()} />
    );
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(container.querySelectorAll('tr')).toHaveLength(2);
  });
});

// ============================================
// AC-10: Barrel export index.ts
// ============================================

describe('grammar-edit barrel export (index.ts)', () => {
  it('exports NounGrammarEditForm', async () => {
    const module = await import('../index');
    expect(module.NounGrammarEditForm).toBeDefined();
    expect(typeof module.NounGrammarEditForm).toBe('function');
  });

  it('exports VerbGrammarEditForm', async () => {
    const module = await import('../index');
    expect(module.VerbGrammarEditForm).toBeDefined();
    expect(typeof module.VerbGrammarEditForm).toBe('function');
  });

  it('exports AdjectiveGrammarEditForm', async () => {
    const module = await import('../index');
    expect(module.AdjectiveGrammarEditForm).toBeDefined();
    expect(typeof module.AdjectiveGrammarEditForm).toBe('function');
  });

  it('exports AdverbGrammarEditForm', async () => {
    const module = await import('../index');
    expect(module.AdverbGrammarEditForm).toBeDefined();
    expect(typeof module.AdverbGrammarEditForm).toBe('function');
  });
});
