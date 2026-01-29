/**
 * NounDeclensionTable Component Tests
 *
 * Tests for the NounDeclensionTable component, verifying:
 * - Renders 4x2 grid (4 cases x singular/plural)
 * - Displays correct i18n labels for cases and headers
 * - Handles missing data with N/A placeholder
 * - Displays all noun forms correctly
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NounDeclensionTable } from '../NounDeclensionTable';
import type { NounData } from '@/types/grammar';

// Complete mock noun data (neuter noun "house")
const mockNounDataComplete: NounData = {
  gender: 'neuter',
  nominative_singular: 'το σπίτι',
  nominative_plural: 'τα σπίτια',
  genitive_singular: 'του σπιτιού',
  genitive_plural: 'των σπιτιών',
  accusative_singular: 'το σπίτι',
  accusative_plural: 'τα σπίτια',
  vocative_singular: 'σπίτι',
  vocative_plural: 'σπίτια',
};

// Partial mock noun data (missing some forms)
const mockNounDataPartial: NounData = {
  gender: 'masculine',
  nominative_singular: 'ο άνθρωπος',
  nominative_plural: 'οι άνθρωποι',
  genitive_singular: 'του ανθρώπου',
  genitive_plural: '', // Missing
  accusative_singular: 'τον άνθρωπο',
  accusative_plural: 'τους ανθρώπους',
  vocative_singular: '', // Missing
  vocative_plural: '', // Missing
};

// Empty mock noun data (all empty strings)
const mockNounDataEmpty: NounData = {
  gender: 'feminine',
  nominative_singular: '',
  nominative_plural: '',
  genitive_singular: '',
  genitive_plural: '',
  accusative_singular: '',
  accusative_plural: '',
  vocative_singular: '',
  vocative_plural: '',
};

describe('NounDeclensionTable', () => {
  describe('Header Row', () => {
    it('should render singular header', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Singular')).toBeInTheDocument();
    });

    it('should render plural header', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Plural')).toBeInTheDocument();
    });
  });

  describe('Case Labels', () => {
    it('should render nominative case label', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Nominative')).toBeInTheDocument();
    });

    it('should render genitive case label', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Genitive')).toBeInTheDocument();
    });

    it('should render accusative case label', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Accusative')).toBeInTheDocument();
    });

    it('should render vocative case label', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should render nominative and accusative forms (neuter: nom=acc)', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      // Note: For neuter nouns, nominative and accusative are identical
      // 'το σπίτι' appears twice (nom_sg and acc_sg)
      // 'τα σπίτια' appears twice (nom_pl and acc_pl)
      expect(screen.getAllByText('το σπίτι')).toHaveLength(2);
      expect(screen.getAllByText('τα σπίτια')).toHaveLength(2);
    });

    it('should render all genitive forms', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('του σπιτιού')).toBeInTheDocument();
      expect(screen.getByText('των σπιτιών')).toBeInTheDocument();
    });

    it('should render all vocative forms', () => {
      render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      expect(screen.getByText('σπίτι')).toBeInTheDocument();
      expect(screen.getByText('σπίτια')).toBeInTheDocument();
    });
  });

  describe('Partial Data', () => {
    it('should display N/A for missing forms', () => {
      render(<NounDeclensionTable nounData={mockNounDataPartial} />);

      // Should have N/A for genitive_plural, vocative_singular, vocative_plural (3 instances)
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(3);
    });

    it('should display available forms correctly', () => {
      render(<NounDeclensionTable nounData={mockNounDataPartial} />);

      expect(screen.getByText('ο άνθρωπος')).toBeInTheDocument();
      expect(screen.getByText('οι άνθρωποι')).toBeInTheDocument();
      expect(screen.getByText('του ανθρώπου')).toBeInTheDocument();
      expect(screen.getByText('τον άνθρωπο')).toBeInTheDocument();
      expect(screen.getByText('τους ανθρώπους')).toBeInTheDocument();
    });
  });

  describe('Empty Data', () => {
    it('should display N/A for all empty forms', () => {
      render(<NounDeclensionTable nounData={mockNounDataEmpty} />);

      // All 8 form cells should show N/A
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(8);
    });

    it('should still render case labels and headers', () => {
      render(<NounDeclensionTable nounData={mockNounDataEmpty} />);

      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
      expect(screen.getByText('Nominative')).toBeInTheDocument();
      expect(screen.getByText('Genitive')).toBeInTheDocument();
      expect(screen.getByText('Accusative')).toBeInTheDocument();
      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });
  });

  describe('Grid Structure', () => {
    it('should render 4 data rows (one per case)', () => {
      const { container } = render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      // Each case row has grid-cols-3 class
      const rows = container.querySelectorAll('.grid-cols-3');
      // 1 header row + 4 case rows = 5 total
      expect(rows.length).toBe(5);
    });

    it('should have rounded border container', () => {
      const { container } = render(<NounDeclensionTable nounData={mockNounDataComplete} />);

      const table = container.firstChild;
      expect(table).toHaveClass('rounded-lg');
      expect(table).toHaveClass('border');
    });
  });
});
