/**
 * DeclensionTable Component Tests
 *
 * Tests for NounDeclensionTable and AdjectiveDeclensionTable components, covering:
 * - Noun declension with gender badge
 * - All 4 cases (nominative, genitive, accusative, vocative)
 * - Singular and plural forms
 * - Adjective gender tabs (masculine, feminine, neuter)
 * - Comparison forms for adjectives
 * - N/A handling for missing values
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { NounData, AdjectiveData } from '@/types/grammar';

import { NounDeclensionTable, AdjectiveDeclensionTable } from '../DeclensionTable';

// Mock noun data for testing
const mockNounData: NounData = {
  gender: 'masculine',
  nominative_singular: 'δάσκαλος',
  genitive_singular: 'δασκάλου',
  accusative_singular: 'δάσκαλο',
  vocative_singular: 'δάσκαλε',
  nominative_plural: 'δάσκαλοι',
  genitive_plural: 'δασκάλων',
  accusative_plural: 'δασκάλους',
  vocative_plural: 'δάσκαλοι',
};

const mockFeminineNounData: NounData = {
  gender: 'feminine',
  nominative_singular: 'γυναίκα',
  genitive_singular: 'γυναίκας',
  accusative_singular: 'γυναίκα',
  vocative_singular: 'γυναίκα',
  nominative_plural: 'γυναίκες',
  genitive_plural: 'γυναικών',
  accusative_plural: 'γυναίκες',
  vocative_plural: 'γυναίκες',
};

const mockNeuterNounData: NounData = {
  gender: 'neuter',
  nominative_singular: 'παιδί',
  genitive_singular: 'παιδιού',
  accusative_singular: 'παιδί',
  vocative_singular: 'παιδί',
  nominative_plural: 'παιδιά',
  genitive_plural: 'παιδιών',
  accusative_plural: 'παιδιά',
  vocative_plural: 'παιδιά',
};

// Mock adjective data for testing
const mockAdjectiveData: AdjectiveData = {
  masculine_nom_sg: 'καλός',
  masculine_gen_sg: 'καλού',
  masculine_acc_sg: 'καλό',
  masculine_voc_sg: 'καλέ',
  masculine_nom_pl: 'καλοί',
  masculine_gen_pl: 'καλών',
  masculine_acc_pl: 'καλούς',
  masculine_voc_pl: 'καλοί',
  feminine_nom_sg: 'καλή',
  feminine_gen_sg: 'καλής',
  feminine_acc_sg: 'καλή',
  feminine_voc_sg: 'καλή',
  feminine_nom_pl: 'καλές',
  feminine_gen_pl: 'καλών',
  feminine_acc_pl: 'καλές',
  feminine_voc_pl: 'καλές',
  neuter_nom_sg: 'καλό',
  neuter_gen_sg: 'καλού',
  neuter_acc_sg: 'καλό',
  neuter_voc_sg: 'καλό',
  neuter_nom_pl: 'καλά',
  neuter_gen_pl: 'καλών',
  neuter_acc_pl: 'καλά',
  neuter_voc_pl: 'καλά',
  comparative: 'καλύτερος',
  superlative: 'ο καλύτερος',
};

// Partial noun data to test N/A handling
const partialNounData: NounData = {
  gender: 'masculine',
  nominative_singular: 'λόγος',
  genitive_singular: 'λόγου',
  accusative_singular: '',
  vocative_singular: '',
  nominative_plural: '',
  genitive_plural: '',
  accusative_plural: '',
  vocative_plural: '',
};

describe('NounDeclensionTable', () => {
  describe('Header and Gender Badge', () => {
    it('renders declension section title', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      expect(screen.getByText('Declension')).toBeInTheDocument();
    });

    it('displays gender badge for masculine nouns', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      expect(screen.getByText('Masculine')).toBeInTheDocument();
    });

    it('displays gender badge for feminine nouns', () => {
      render(<NounDeclensionTable grammarData={mockFeminineNounData} />);

      expect(screen.getByText('Feminine')).toBeInTheDocument();
    });

    it('displays gender badge for neuter nouns', () => {
      render(<NounDeclensionTable grammarData={mockNeuterNounData} />);

      expect(screen.getByText('Neuter')).toBeInTheDocument();
    });
  });

  describe('Table Headers', () => {
    it('displays Singular and Plural column headers', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
    });
  });

  describe('Case Labels', () => {
    it('displays all four case labels', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      const cases = ['Nominative', 'Genitive', 'Accusative', 'Vocative'];
      cases.forEach((caseLabel) => {
        expect(screen.getByText(caseLabel)).toBeInTheDocument();
      });
    });
  });

  describe('Declension Values', () => {
    it('displays all singular forms', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      expect(screen.getByText('δάσκαλος')).toBeInTheDocument();
      expect(screen.getByText('δασκάλου')).toBeInTheDocument();
      expect(screen.getByText('δάσκαλο')).toBeInTheDocument();
      expect(screen.getByText('δάσκαλε')).toBeInTheDocument();
    });

    it('displays all plural forms', () => {
      render(<NounDeclensionTable grammarData={mockNounData} />);

      // δάσκαλοι appears in nominative and vocative plural
      expect(screen.getAllByText('δάσκαλοι').length).toBeGreaterThan(0);
      expect(screen.getByText('δασκάλων')).toBeInTheDocument();
      expect(screen.getByText('δασκάλους')).toBeInTheDocument();
    });
  });

  describe('N/A Handling', () => {
    it('displays N/A for missing declension values', () => {
      render(<NounDeclensionTable grammarData={partialNounData} />);

      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThan(0);
    });
  });
});

describe('AdjectiveDeclensionTable', () => {
  describe('Gender Tabs', () => {
    it('renders all three gender tabs', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByRole('tab', { name: 'Masculine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Feminine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Neuter' })).toBeInTheDocument();
    });

    it('defaults to masculine gender tab', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      const masculineTab = screen.getByRole('tab', { name: 'Masculine' });
      expect(masculineTab).toHaveAttribute('data-state', 'active');
    });

    it('allows clicking on feminine tab', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      const feminineTab = screen.getByRole('tab', { name: 'Feminine' });
      expect(feminineTab).toBeInTheDocument();
      expect(feminineTab).not.toBeDisabled();
      fireEvent.click(feminineTab);
    });

    it('allows clicking on neuter tab', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      const neuterTab = screen.getByRole('tab', { name: 'Neuter' });
      expect(neuterTab).toBeInTheDocument();
      expect(neuterTab).not.toBeDisabled();
      fireEvent.click(neuterTab);
    });
  });

  describe('Masculine Declension', () => {
    it('displays masculine singular forms', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByText('καλός')).toBeInTheDocument();
      expect(screen.getByText('καλού')).toBeInTheDocument();
      expect(screen.getByText('καλό')).toBeInTheDocument();
      expect(screen.getByText('καλέ')).toBeInTheDocument();
    });

    it('displays masculine plural forms', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      // καλοί appears in nominative and vocative plural
      expect(screen.getAllByText('καλοί').length).toBeGreaterThan(0);
      // καλών is genitive plural
      expect(screen.getByText('καλών')).toBeInTheDocument();
      // καλούς is accusative plural
      expect(screen.getByText('καλούς')).toBeInTheDocument();
    });
  });

  describe('Comparison Section', () => {
    it('displays comparison section when forms exist', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('Comparative')).toBeInTheDocument();
      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });

    it('displays comparative form', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByText('καλύτερος')).toBeInTheDocument();
    });

    it('displays superlative form', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByText('ο καλύτερος')).toBeInTheDocument();
    });

    it('does not render comparison section when no forms exist', () => {
      const noComparisonData: AdjectiveData = {
        ...mockAdjectiveData,
        comparative: '',
        superlative: '',
      };
      render(<AdjectiveDeclensionTable grammarData={noComparisonData} />);

      expect(screen.queryByText('Comparison')).not.toBeInTheDocument();
    });
  });

  describe('Section Header', () => {
    it('renders declension section title', () => {
      render(<AdjectiveDeclensionTable grammarData={mockAdjectiveData} />);

      expect(screen.getByText('Declension')).toBeInTheDocument();
    });
  });
});
