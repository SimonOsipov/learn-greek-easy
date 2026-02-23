// src/components/admin/vocabulary/grammar-display/__tests__/grammarDisplayComponents.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

import { NounGrammarDisplay } from '../NounGrammarDisplay';
import { VerbGrammarDisplay } from '../VerbGrammarDisplay';
import { AdjectiveGrammarDisplay } from '../AdjectiveGrammarDisplay';
import { AdverbGrammarDisplay } from '../AdverbGrammarDisplay';
import { GrammarDisplaySection } from '../GrammarDisplaySection';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

// ============================================
// NounGrammarDisplay
// ============================================

describe('NounGrammarDisplay', () => {
  it('renders with testid', () => {
    renderWithI18n(<NounGrammarDisplay fields={{ gender: 'neuter' }} />);
    expect(screen.getByTestId('noun-grammar-display')).toBeInTheDocument();
  });

  it('shows gender value when present', () => {
    renderWithI18n(<NounGrammarDisplay fields={{ gender: 'neuter' }} />);
    expect(screen.getByTestId('noun-grammar-display')).toHaveTextContent('Neuter');
  });

  it('shows Not set for missing gender', () => {
    renderWithI18n(<NounGrammarDisplay fields={{ gender: null }} />);
    expect(screen.getByTestId('noun-grammar-display')).toHaveTextContent('Not set');
  });

  it('shows case form value when present', () => {
    renderWithI18n(
      <NounGrammarDisplay
        fields={{ gender: 'neuter', nominative_singular: 'σπίτι', nominative_plural: null }}
      />
    );
    expect(screen.getByTestId('noun-grammar-display')).toHaveTextContent('σπίτι');
  });

  it('shows Not set for missing case forms', () => {
    renderWithI18n(<NounGrammarDisplay fields={{ gender: null, nominative_singular: null }} />);
    // Multiple "Not set" spans should appear
    const allNotSet = screen.getAllByText('Not set');
    expect(allNotSet.length).toBeGreaterThan(0);
  });
});

// ============================================
// VerbGrammarDisplay
// ============================================

describe('VerbGrammarDisplay', () => {
  it('renders with testid', () => {
    renderWithI18n(<VerbGrammarDisplay fields={{ voice: 'active' }} />);
    expect(screen.getByTestId('verb-grammar-display')).toBeInTheDocument();
  });

  it('shows voice value when present', () => {
    renderWithI18n(<VerbGrammarDisplay fields={{ voice: 'active' }} />);
    expect(screen.getByTestId('verb-grammar-display')).toHaveTextContent('Active');
  });

  it('shows Not set for missing voice', () => {
    renderWithI18n(<VerbGrammarDisplay fields={{ voice: null }} />);
    expect(screen.getByTestId('verb-grammar-display')).toHaveTextContent('Not set');
  });

  it('shows conjugation value when present', () => {
    renderWithI18n(<VerbGrammarDisplay fields={{ voice: 'active', present_1s: 'γράφω' }} />);
    expect(screen.getByTestId('verb-grammar-display')).toHaveTextContent('γράφω');
  });
});

// ============================================
// AdjectiveGrammarDisplay
// ============================================

describe('AdjectiveGrammarDisplay', () => {
  it('renders with testid', () => {
    renderWithI18n(<AdjectiveGrammarDisplay fields={{}} />);
    expect(screen.getByTestId('adjective-grammar-display')).toBeInTheDocument();
  });

  it('shows form value when present', () => {
    renderWithI18n(<AdjectiveGrammarDisplay fields={{ masculine_nom_sg: 'ωραίος' }} />);
    expect(screen.getByTestId('adjective-grammar-display')).toHaveTextContent('ωραίος');
  });

  it('shows Not set for missing fields', () => {
    renderWithI18n(<AdjectiveGrammarDisplay fields={{ masculine_nom_sg: null }} />);
    const allNotSet = screen.getAllByText('Not set');
    expect(allNotSet.length).toBeGreaterThan(0);
  });

  it('shows comparative value when present', () => {
    renderWithI18n(<AdjectiveGrammarDisplay fields={{ comparative: 'πιο ωραίος' }} />);
    expect(screen.getByTestId('adjective-grammar-display')).toHaveTextContent('πιο ωραίος');
  });
});

// ============================================
// AdverbGrammarDisplay
// ============================================

describe('AdverbGrammarDisplay', () => {
  it('renders with testid', () => {
    renderWithI18n(<AdverbGrammarDisplay fields={{ comparative: null, superlative: null }} />);
    expect(screen.getByTestId('adverb-grammar-display')).toBeInTheDocument();
  });

  it('shows Not set for missing comparative and superlative', () => {
    renderWithI18n(<AdverbGrammarDisplay fields={{ comparative: null, superlative: null }} />);
    const allNotSet = screen.getAllByText('Not set');
    expect(allNotSet.length).toBe(2);
  });

  it('shows comparative value when present', () => {
    renderWithI18n(
      <AdverbGrammarDisplay fields={{ comparative: 'πιο γρήγορα', superlative: null }} />
    );
    expect(screen.getByTestId('adverb-grammar-display')).toHaveTextContent('πιο γρήγορα');
  });

  it('shows superlative value when present', () => {
    renderWithI18n(
      <AdverbGrammarDisplay fields={{ comparative: null, superlative: 'πιο αργά' }} />
    );
    expect(screen.getByTestId('adverb-grammar-display')).toHaveTextContent('πιο αργά');
  });
});

// ============================================
// GrammarDisplaySection
// ============================================

describe('GrammarDisplaySection', () => {
  it('returns null for phrase part of speech', () => {
    const { container } = renderWithI18n(
      <GrammarDisplaySection partOfSpeech="phrase" grammarData={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "No grammar data" when grammarData is null for non-phrase', () => {
    renderWithI18n(<GrammarDisplaySection partOfSpeech="noun" grammarData={null} />);
    expect(screen.getByTestId('grammar-no-data')).toBeInTheDocument();
  });

  it('renders NounGrammarDisplay for noun POS', () => {
    renderWithI18n(
      <GrammarDisplaySection partOfSpeech="noun" grammarData={{ gender: 'masculine' }} />
    );
    expect(screen.getByTestId('noun-grammar-display')).toBeInTheDocument();
  });

  it('renders VerbGrammarDisplay for verb POS', () => {
    renderWithI18n(<GrammarDisplaySection partOfSpeech="verb" grammarData={{ voice: 'active' }} />);
    expect(screen.getByTestId('verb-grammar-display')).toBeInTheDocument();
  });

  it('renders AdjectiveGrammarDisplay for adjective POS', () => {
    renderWithI18n(<GrammarDisplaySection partOfSpeech="adjective" grammarData={{ forms: {} }} />);
    expect(screen.getByTestId('adjective-grammar-display')).toBeInTheDocument();
  });

  it('renders AdverbGrammarDisplay for adverb POS', () => {
    renderWithI18n(
      <GrammarDisplaySection partOfSpeech="adverb" grammarData={{ category: 'time' }} />
    );
    expect(screen.getByTestId('adverb-grammar-display')).toBeInTheDocument();
  });

  it('does NOT render grammar section for phrase even with non-null grammarData', () => {
    const { container } = renderWithI18n(
      <GrammarDisplaySection partOfSpeech="phrase" grammarData={{ some: 'data' }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
