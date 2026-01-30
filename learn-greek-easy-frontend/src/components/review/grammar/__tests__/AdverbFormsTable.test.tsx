/**
 * AdverbFormsTable Component Tests
 *
 * Tests for the AdverbFormsTable component, verifying:
 * - Renders 3 rows (positive, comparative, superlative)
 * - Displays correct i18n labels
 * - Handles missing data with N/A placeholder
 * - Uses positiveForm prop for the base adverb
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdverbFormsTable } from '../AdverbFormsTable';
import type { AdverbData } from '@/types/grammar';

// Complete mock adverb data ("quickly")
const mockAdverbDataComplete: AdverbData = {
  comparative: 'πιο γρήγορα',
  superlative: 'γρηγορότατα',
};

// Partial mock adverb data (missing superlative)
const mockAdverbDataPartial: AdverbData = {
  comparative: 'πιο καλά',
  superlative: '',
};

// Empty mock adverb data
const mockAdverbDataEmpty: AdverbData = {
  comparative: '',
  superlative: '',
};

describe('AdverbFormsTable', () => {
  describe('Form Labels', () => {
    it('should render positive form label', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('should render comparative form label', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('Comparative')).toBeInTheDocument();
    });

    it('should render superlative form label', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should render positive form from props', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('γρήγορα')).toBeInTheDocument();
    });

    it('should render comparative form', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('πιο γρήγορα')).toBeInTheDocument();
    });

    it('should render superlative form', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.getByText('γρηγορότατα')).toBeInTheDocument();
    });

    it('should not display N/A with complete data', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />);

      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    });
  });

  describe('Partial Data', () => {
    it('should display N/A for missing superlative', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataPartial} positiveForm="καλά" />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should display available forms correctly', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataPartial} positiveForm="καλά" />);

      expect(screen.getByText('καλά')).toBeInTheDocument();
      expect(screen.getByText('πιο καλά')).toBeInTheDocument();
    });
  });

  describe('Empty Data', () => {
    it('should display N/A for missing comparative and superlative', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataEmpty} positiveForm="αργά" />);

      // 2 N/A for comparative and superlative
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(2);
    });

    it('should still display positive form from props', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataEmpty} positiveForm="αργά" />);

      expect(screen.getByText('αργά')).toBeInTheDocument();
    });

    it('should still render all form labels', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataEmpty} positiveForm="αργά" />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
      expect(screen.getByText('Comparative')).toBeInTheDocument();
      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });
  });

  describe('Empty Positive Form', () => {
    it('should display N/A for empty positive form', () => {
      render(<AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="" />);

      // Positive row should show N/A, others should have values
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(1);
    });
  });

  describe('Grid Structure', () => {
    it('should render 3 rows (one per form)', () => {
      const { container } = render(
        <AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />
      );

      // Each row has grid-cols-2 class
      const rows = container.querySelectorAll('.grid-cols-2');
      expect(rows.length).toBe(3);
    });

    it('should have rounded border container', () => {
      const { container } = render(
        <AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />
      );

      const table = container.firstChild;
      expect(table).toHaveClass('rounded-lg');
      expect(table).toHaveClass('border');
    });

    it('should have border between rows except last', () => {
      const { container } = render(
        <AdverbFormsTable adverbData={mockAdverbDataComplete} positiveForm="γρήγορα" />
      );

      // First two rows should have border-b, last should not
      const rowsWithBorder = container.querySelectorAll('.border-b.border-border');
      // 2 rows have bottom border (positive and comparative)
      expect(rowsWithBorder.length).toBe(2);
    });
  });
});
