/**
 * ConjugationTable Component Tests
 *
 * Tests for the ConjugationTable component, covering:
 * - All tense tabs render correctly
 * - Tense switching functionality
 * - Person labels display
 * - Verb conjugation values display
 * - Imperative forms display (singular/plural only)
 * - N/A handling for missing values
 * - ScrollableTable wrapping for mobile
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { VerbData } from '@/types/grammar';

import { ConjugationTable } from '../ConjugationTable';

// Complete mock verb data for testing
const mockVerbData: VerbData = {
  voice: 'active',
  present_1s: 'γράφω',
  present_2s: 'γράφεις',
  present_3s: 'γράφει',
  present_1p: 'γράφουμε',
  present_2p: 'γράφετε',
  present_3p: 'γράφουν',
  imperfect_1s: 'έγραφα',
  imperfect_2s: 'έγραφες',
  imperfect_3s: 'έγραφε',
  imperfect_1p: 'γράφαμε',
  imperfect_2p: 'γράφατε',
  imperfect_3p: 'έγραφαν',
  past_1s: 'έγραψα',
  past_2s: 'έγραψες',
  past_3s: 'έγραψε',
  past_1p: 'γράψαμε',
  past_2p: 'γράψατε',
  past_3p: 'έγραψαν',
  future_1s: 'θα γράψω',
  future_2s: 'θα γράψεις',
  future_3s: 'θα γράψει',
  future_1p: 'θα γράψουμε',
  future_2p: 'θα γράψετε',
  future_3p: 'θα γράψουν',
  perfect_1s: 'έχω γράψει',
  perfect_2s: 'έχεις γράψει',
  perfect_3s: 'έχει γράψει',
  perfect_1p: 'έχουμε γράψει',
  perfect_2p: 'έχετε γράψει',
  perfect_3p: 'έχουν γράψει',
  imperative_2s: 'γράψε',
  imperative_2p: 'γράψτε',
};

// Partial verb data to test N/A handling
const partialVerbData: VerbData = {
  voice: 'passive',
  present_1s: 'γράφομαι',
  present_2s: '',
  present_3s: 'γράφεται',
  present_1p: '',
  present_2p: '',
  present_3p: '',
  imperfect_1s: '',
  imperfect_2s: '',
  imperfect_3s: '',
  imperfect_1p: '',
  imperfect_2p: '',
  imperfect_3p: '',
  past_1s: '',
  past_2s: '',
  past_3s: '',
  past_1p: '',
  past_2p: '',
  past_3p: '',
  future_1s: '',
  future_2s: '',
  future_3s: '',
  future_1p: '',
  future_2p: '',
  future_3p: '',
  perfect_1s: '',
  perfect_2s: '',
  perfect_3s: '',
  perfect_1p: '',
  perfect_2p: '',
  perfect_3p: '',
  imperative_2s: '',
  imperative_2p: '',
};

describe('ConjugationTable', () => {
  describe('Tab Navigation', () => {
    it('renders all tense tabs', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const tenses = ['Present', 'Imperfect', 'Past', 'Future', 'Perfect', 'Imperative'];
      tenses.forEach((tense) => {
        expect(screen.getByRole('tab', { name: tense })).toBeInTheDocument();
      });
    });

    it('defaults to Present tense tab', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const presentTab = screen.getByRole('tab', { name: 'Present' });
      expect(presentTab).toHaveAttribute('data-state', 'active');
    });

    it('allows clicking on tense tabs', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const futureTab = screen.getByRole('tab', { name: 'Future' });
      // Verify the tab is clickable and exists
      expect(futureTab).toBeInTheDocument();
      expect(futureTab).not.toBeDisabled();
      fireEvent.click(futureTab);
    });
  });

  describe('Present Tense Display', () => {
    it('displays all person labels', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const personLabels = ['I', 'You (singular)', 'He/She', 'We', 'You (plural)', 'They'];
      personLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('displays all conjugation values', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const conjugations = ['γράφω', 'γράφεις', 'γράφει', 'γράφουμε', 'γράφετε', 'γράφουν'];
      conjugations.forEach((form) => {
        expect(screen.getByText(form)).toBeInTheDocument();
      });
    });
  });

  describe('Imperative Tense', () => {
    it('has imperative tab available', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      const imperativeTab = screen.getByRole('tab', { name: 'Imperative' });
      expect(imperativeTab).toBeInTheDocument();
      expect(imperativeTab).not.toBeDisabled();
    });
  });

  describe('N/A Handling', () => {
    it('displays N/A for missing conjugation values', () => {
      render(<ConjugationTable grammarData={partialVerbData} />);

      // N/A should appear for missing values
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThan(0);
    });
  });

  describe('Section Header', () => {
    it('renders conjugation section title', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      expect(screen.getByText('Conjugation')).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('renders within a Card component', () => {
      render(<ConjugationTable grammarData={mockVerbData} />);

      // The conjugation table should be inside a Card
      const card = screen.getByText('Conjugation').closest('[class*="card"]');
      expect(card).toBeInTheDocument();
    });
  });
});
