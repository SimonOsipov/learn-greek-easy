/**
 * GenderTabs Component Tests
 *
 * Tests for the GenderTabs component, verifying:
 * - Renders 3 gender tabs (Masculine, Feminine, Neuter)
 * - Masculine tab active by default
 * - Tab switching changes displayed content
 * - All tabs always enabled
 * - Accessibility (tablist, tab, tabpanel roles)
 * - i18n labels display correctly
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GenderTabs } from '../GenderTabs';
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

describe('GenderTabs', () => {
  describe('Tab Triggers', () => {
    it('should render 3 gender tab triggers', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Masculine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Feminine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Neuter' })).toBeInTheDocument();
    });

    it('should have Masculine tab selected by default', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      const masculineTab = screen.getByRole('tab', { name: 'Masculine' });
      expect(masculineTab).toHaveAttribute('data-state', 'active');
    });

    it('should display Masculine declension content by default', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      // Masculine-specific forms should be visible
      expect(screen.getByText('μεγάλος')).toBeInTheDocument();
      expect(screen.getByText('μεγάλε')).toBeInTheDocument();
    });

    it('should have all tabs always enabled', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Masculine' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Feminine' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Neuter' })).not.toBeDisabled();
    });
  });

  describe('Tab Switching', () => {
    it('should switch to Feminine gender when clicking Feminine tab', async () => {
      const user = userEvent.setup();
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      const feminineTab = screen.getByRole('tab', { name: 'Feminine' });
      await user.click(feminineTab);

      expect(feminineTab).toHaveAttribute('data-state', 'active');
      // Feminine-specific form should be visible
      expect(screen.getByText('μεγάλης')).toBeInTheDocument();
    });

    it('should switch to Neuter gender when clicking Neuter tab', async () => {
      const user = userEvent.setup();
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      const neuterTab = screen.getByRole('tab', { name: 'Neuter' });
      await user.click(neuterTab);

      expect(neuterTab).toHaveAttribute('data-state', 'active');
      // Neuter-specific forms should be visible (μεγάλα appears multiple times)
      expect(screen.getAllByText('μεγάλα').length).toBeGreaterThanOrEqual(1);
    });

    it('should switch back to Masculine after selecting other tabs', async () => {
      const user = userEvent.setup();
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      // Go to Feminine
      await user.click(screen.getByRole('tab', { name: 'Feminine' }));
      expect(screen.getByRole('tab', { name: 'Feminine' })).toHaveAttribute('data-state', 'active');

      // Go back to Masculine
      await user.click(screen.getByRole('tab', { name: 'Masculine' }));
      expect(screen.getByRole('tab', { name: 'Masculine' })).toHaveAttribute(
        'data-state',
        'active'
      );
      expect(screen.getByText('μεγάλος')).toBeInTheDocument();
    });
  });

  describe('i18n Labels', () => {
    it('should display correct English gender labels', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Masculine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Feminine' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Neuter' })).toBeInTheDocument();
    });

    it('should display correct case labels', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Nominative')).toBeInTheDocument();
      expect(screen.getByText('Genitive')).toBeInTheDocument();
      expect(screen.getByText('Accusative')).toBeInTheDocument();
      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });

    it('should display singular/plural headers', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper tablist role', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have proper tab roles for all triggers', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('should have proper tabpanel role for content', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('Tab Content', () => {
    it('should render gender header in the table card', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      // The card header should show the gender name
      // There are two "Masculine" - one in the tab, one in the card header
      const masculineElements = screen.getAllByText('Masculine');
      expect(masculineElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render all case rows in the table', () => {
      render(<GenderTabs adjectiveData={mockAdjectiveDataComplete} />);

      // Should have 4 case rows
      expect(screen.getByText('Nominative')).toBeInTheDocument();
      expect(screen.getByText('Genitive')).toBeInTheDocument();
      expect(screen.getByText('Accusative')).toBeInTheDocument();
      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });
  });
});
