/**
 * AdjectiveDeclensionTables Component Tests
 *
 * Tests for the AdjectiveDeclensionTables component, verifying:
 * - Renders 3 gender tables (masculine, feminine, neuter)
 * - Renders comparison section (comparative, superlative)
 * - Displays correct i18n labels for genders, cases, and comparison
 * - Handles missing data with N/A placeholder
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdjectiveDeclensionTables } from '../AdjectiveDeclensionTables';
import type { AdjectiveData } from '@/types/grammar';

// Complete mock adjective data ("big")
const mockAdjectiveDataComplete: AdjectiveData = {
  // Masculine forms
  masculine_nom_sg: 'μεγάλος',
  masculine_gen_sg: 'μεγάλου',
  masculine_acc_sg: 'μεγάλο',
  masculine_voc_sg: 'μεγάλε',
  masculine_nom_pl: 'μεγάλοι',
  masculine_gen_pl: 'μεγάλων',
  masculine_acc_pl: 'μεγάλους',
  masculine_voc_pl: 'μεγάλοι',
  // Feminine forms
  feminine_nom_sg: 'μεγάλη',
  feminine_gen_sg: 'μεγάλης',
  feminine_acc_sg: 'μεγάλη',
  feminine_voc_sg: 'μεγάλη',
  feminine_nom_pl: 'μεγάλες',
  feminine_gen_pl: 'μεγάλων',
  feminine_acc_pl: 'μεγάλες',
  feminine_voc_pl: 'μεγάλες',
  // Neuter forms
  neuter_nom_sg: 'μεγάλο',
  neuter_gen_sg: 'μεγάλου',
  neuter_acc_sg: 'μεγάλο',
  neuter_voc_sg: 'μεγάλο',
  neuter_nom_pl: 'μεγάλα',
  neuter_gen_pl: 'μεγάλων',
  neuter_acc_pl: 'μεγάλα',
  neuter_voc_pl: 'μεγάλα',
  // Comparison forms
  comparative: 'μεγαλύτερος',
  superlative: 'ο μεγαλύτερος',
};

// Partial mock adjective data (missing some forms)
const mockAdjectiveDataPartial: AdjectiveData = {
  masculine_nom_sg: 'καλός',
  masculine_gen_sg: 'καλού',
  masculine_acc_sg: 'καλό',
  masculine_voc_sg: '',
  masculine_nom_pl: 'καλοί',
  masculine_gen_pl: '',
  masculine_acc_pl: 'καλούς',
  masculine_voc_pl: '',
  feminine_nom_sg: 'καλή',
  feminine_gen_sg: '',
  feminine_acc_sg: 'καλή',
  feminine_voc_sg: '',
  feminine_nom_pl: 'καλές',
  feminine_gen_pl: '',
  feminine_acc_pl: 'καλές',
  feminine_voc_pl: '',
  neuter_nom_sg: 'καλό',
  neuter_gen_sg: '',
  neuter_acc_sg: 'καλό',
  neuter_voc_sg: '',
  neuter_nom_pl: 'καλά',
  neuter_gen_pl: '',
  neuter_acc_pl: 'καλά',
  neuter_voc_pl: '',
  comparative: 'καλύτερος',
  superlative: '',
};

// Empty mock adjective data
const mockAdjectiveDataEmpty: AdjectiveData = {
  masculine_nom_sg: '',
  masculine_gen_sg: '',
  masculine_acc_sg: '',
  masculine_voc_sg: '',
  masculine_nom_pl: '',
  masculine_gen_pl: '',
  masculine_acc_pl: '',
  masculine_voc_pl: '',
  feminine_nom_sg: '',
  feminine_gen_sg: '',
  feminine_acc_sg: '',
  feminine_voc_sg: '',
  feminine_nom_pl: '',
  feminine_gen_pl: '',
  feminine_acc_pl: '',
  feminine_voc_pl: '',
  neuter_nom_sg: '',
  neuter_gen_sg: '',
  neuter_acc_sg: '',
  neuter_voc_sg: '',
  neuter_nom_pl: '',
  neuter_gen_pl: '',
  neuter_acc_pl: '',
  neuter_voc_pl: '',
  comparative: '',
  superlative: '',
};

describe('AdjectiveDeclensionTables', () => {
  describe('Gender Table Headers', () => {
    it('should render masculine gender header', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Masculine')).toBeInTheDocument();
    });

    it('should render feminine gender header', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Feminine')).toBeInTheDocument();
    });

    it('should render neuter gender header', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Neuter')).toBeInTheDocument();
    });
  });

  describe('Case Labels', () => {
    it('should render case labels for each gender table', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // Each gender table has 4 case labels, so 3 tables x 4 cases = 12 total
      // But labels are shared text, so we check they exist
      expect(screen.getAllByText('Nominative')).toHaveLength(3);
      expect(screen.getAllByText('Genitive')).toHaveLength(3);
      expect(screen.getAllByText('Accusative')).toHaveLength(3);
      expect(screen.getAllByText('Vocative')).toHaveLength(3);
    });
  });

  describe('Column Headers', () => {
    it('should render singular/plural headers for each table', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // 3 gender tables, each with Singular and Plural headers
      expect(screen.getAllByText('Singular')).toHaveLength(3);
      expect(screen.getAllByText('Plural')).toHaveLength(3);
    });
  });

  describe('Comparison Section', () => {
    it('should render comparison title', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Comparison')).toBeInTheDocument();
    });

    it('should render comparative label', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Comparative')).toBeInTheDocument();
    });

    it('should render superlative label', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });

    it('should render comparison forms', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('μεγαλύτερος')).toBeInTheDocument();
      expect(screen.getByText('ο μεγαλύτερος')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should render masculine nominative and vocative plural (unique forms)', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('μεγάλος')).toBeInTheDocument();
      expect(screen.getByText('μεγάλε')).toBeInTheDocument();
      expect(screen.getByText('μεγάλους')).toBeInTheDocument();
    });

    it('should render masculine/neuter genitive (shared form appears twice)', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // μεγάλου is the same for masculine and neuter genitive singular
      expect(screen.getAllByText('μεγάλου')).toHaveLength(2);
    });

    it('should render feminine forms', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // μεγάλη appears multiple times (fem_nom_sg, fem_acc_sg, fem_voc_sg)
      expect(screen.getAllByText('μεγάλη').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('μεγάλης')).toBeInTheDocument();
      // μεγάλες appears multiple times
      expect(screen.getAllByText('μεγάλες').length).toBeGreaterThanOrEqual(1);
    });

    it('should render neuter forms (shared with masculine)', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // μεγάλο appears multiple times (masc_acc_sg, neut_nom_sg, neut_acc_sg, neut_voc_sg)
      expect(screen.getAllByText('μεγάλο').length).toBeGreaterThanOrEqual(1);
      // μεγάλα appears multiple times
      expect(screen.getAllByText('μεγάλα').length).toBeGreaterThanOrEqual(1);
    });

    it('should not display N/A with complete data', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    });
  });

  describe('Partial Data', () => {
    it('should display N/A for missing forms', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataPartial} />);

      // Should have N/A for missing vocatives, genitives, and superlative
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display available forms correctly', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataPartial} />);

      expect(screen.getByText('καλός')).toBeInTheDocument();
      // καλή appears twice (fem_nom_sg and fem_acc_sg are the same)
      expect(screen.getAllByText('καλή').length).toBeGreaterThanOrEqual(1);
      // καλό appears multiple times
      expect(screen.getAllByText('καλό').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('καλύτερος')).toBeInTheDocument();
    });

    it('should display N/A for missing superlative', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataPartial} />);

      // Comparative should be present
      expect(screen.getByText('καλύτερος')).toBeInTheDocument();

      // Superlative is empty, so N/A should be somewhere
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty Data', () => {
    it('should display N/A for all empty forms', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataEmpty} />);

      // 24 declension forms (8 per gender x 3) + 2 comparison = 26 N/A
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(26);
    });

    it('should still render all headers and labels', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataEmpty} />);

      // Gender headers
      expect(screen.getByText('Masculine')).toBeInTheDocument();
      expect(screen.getByText('Feminine')).toBeInTheDocument();
      expect(screen.getByText('Neuter')).toBeInTheDocument();

      // Comparison section
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('Comparative')).toBeInTheDocument();
      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });
  });

  describe('Grid Structure', () => {
    it('should render 3 gender tables', () => {
      const { container } = render(
        <AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />
      );

      // Each gender table has a primary/10 header background
      const genderHeaders = container.querySelectorAll('.bg-primary\\/10');
      // 3 gender headers + 1 comparison header = 4
      expect(genderHeaders.length).toBe(4);
    });

    it('should render gender tables in a responsive grid', () => {
      const { container } = render(
        <AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />
      );

      // Container has md:grid-cols-3 class
      const gridContainer = container.querySelector('.md\\:grid-cols-3');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should have space-y-4 container for vertical spacing', () => {
      const { container } = render(
        <AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('space-y-4');
    });
  });
});
