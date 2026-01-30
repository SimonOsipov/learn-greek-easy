/**
 * AdjectiveDeclensionTables Component Tests
 *
 * Tests for the AdjectiveDeclensionTables component, verifying:
 * - Renders gender tabs (via GenderTabs component)
 * - Renders comparison section (comparative, superlative)
 * - Displays correct i18n labels for comparison
 * - Handles missing data with N/A placeholder
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  describe('Gender Tabs', () => {
    it('should render gender tabs', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Masculine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Feminine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Neuter' })).toBeInTheDocument();
    });

    it('should have Masculine tab selected by default', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      const masculineTab = screen.getByRole('tab', { name: 'Masculine' });
      expect(masculineTab).toHaveAttribute('data-state', 'active');
    });

    it('should display masculine declension data by default', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // Masculine-specific forms should be visible
      expect(screen.getByText('μεγάλος')).toBeInTheDocument();
      expect(screen.getByText('μεγάλε')).toBeInTheDocument();
    });

    it('should switch to feminine gender when clicking Feminine tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      await user.click(screen.getByRole('tab', { name: 'Feminine' }));

      // Feminine-specific form should be visible
      expect(screen.getByText('μεγάλης')).toBeInTheDocument();
    });

    it('should switch to neuter gender when clicking Neuter tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      await user.click(screen.getByRole('tab', { name: 'Neuter' }));

      // Neuter-specific form should be visible (μεγάλα appears multiple times)
      expect(screen.getAllByText('μεγάλα').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Case Labels', () => {
    it('should render case labels in the table', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Nominative')).toBeInTheDocument();
      expect(screen.getByText('Genitive')).toBeInTheDocument();
      expect(screen.getByText('Accusative')).toBeInTheDocument();
      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });
  });

  describe('Column Headers', () => {
    it('should render singular/plural headers', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
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

    it('should always be visible regardless of selected tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // Comparison visible on Masculine tab
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('μεγαλύτερος')).toBeInTheDocument();

      // Switch to Feminine
      await user.click(screen.getByRole('tab', { name: 'Feminine' }));

      // Comparison still visible
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('μεγαλύτερος')).toBeInTheDocument();

      // Switch to Neuter
      await user.click(screen.getByRole('tab', { name: 'Neuter' }));

      // Comparison still visible
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('μεγαλύτερος')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should render masculine forms on masculine tab', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('μεγάλος')).toBeInTheDocument();
      expect(screen.getByText('μεγάλε')).toBeInTheDocument();
      expect(screen.getByText('μεγάλους')).toBeInTheDocument();
    });

    it('should render feminine forms on feminine tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      await user.click(screen.getByRole('tab', { name: 'Feminine' }));

      expect(screen.getByText('μεγάλης')).toBeInTheDocument();
      // μεγάλες appears multiple times
      expect(screen.getAllByText('μεγάλες').length).toBeGreaterThanOrEqual(1);
    });

    it('should render neuter forms on neuter tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      await user.click(screen.getByRole('tab', { name: 'Neuter' }));

      // μεγάλα appears multiple times
      expect(screen.getAllByText('μεγάλα').length).toBeGreaterThanOrEqual(1);
    });

    it('should not display N/A with complete data on any tab', async () => {
      const user = userEvent.setup();
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      // Check Masculine tab
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();

      // Check Feminine tab
      await user.click(screen.getByRole('tab', { name: 'Feminine' }));
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();

      // Check Neuter tab
      await user.click(screen.getByRole('tab', { name: 'Neuter' }));
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    });
  });

  describe('Partial Data', () => {
    it('should display N/A for missing forms', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataPartial} />);

      // Should have N/A for missing vocative and genitive plural
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display available forms correctly', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataPartial} />);

      expect(screen.getByText('καλός')).toBeInTheDocument();
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
    it('should display N/A for all empty forms in current tab', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataEmpty} />);

      // 8 declension forms (masculine by default) + 2 comparison = 10 N/A
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(10);
    });

    it('should still render all headers and labels', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataEmpty} />);

      // Gender tabs
      expect(screen.getByRole('tab', { name: 'Masculine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Feminine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Neuter' })).toBeInTheDocument();

      // Comparison section
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('Comparative')).toBeInTheDocument();
      expect(screen.getByText('Superlative')).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should render tablist for gender selection', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should render tabpanel for gender content', () => {
      render(<AdjectiveDeclensionTables adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
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
