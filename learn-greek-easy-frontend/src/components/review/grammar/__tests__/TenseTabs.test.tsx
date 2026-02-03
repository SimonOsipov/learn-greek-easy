/**
 * TenseTabs Component Tests
 *
 * Tests for the TenseTabs component, verifying:
 * - Renders all 6 tense tabs
 * - Default selection is Present
 * - Tabs without data are disabled
 * - Clicking a tab changes the content
 * - Correct i18n labels are displayed
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TenseTabs } from '../TenseTabs';
import type { VerbData } from '@/types/grammar';

// Complete mock verb data (active voice "write")
const mockVerbDataComplete: VerbData = {
  voice: 'active',
  // Present tense
  present_1s: 'γράφω',
  present_2s: 'γράφεις',
  present_3s: 'γράφει',
  present_1p: 'γράφουμε',
  present_2p: 'γράφετε',
  present_3p: 'γράφουν',
  // Imperfect tense
  imperfect_1s: 'έγραφα',
  imperfect_2s: 'έγραφες',
  imperfect_3s: 'έγραφε',
  imperfect_1p: 'γράφαμε',
  imperfect_2p: 'γράφατε',
  imperfect_3p: 'έγραφαν',
  // Past (aorist) tense
  past_1s: 'έγραψα',
  past_2s: 'έγραψες',
  past_3s: 'έγραψε',
  past_1p: 'γράψαμε',
  past_2p: 'γράψατε',
  past_3p: 'έγραψαν',
  // Future tense
  future_1s: 'θα γράψω',
  future_2s: 'θα γράψεις',
  future_3s: 'θα γράψει',
  future_1p: 'θα γράψουμε',
  future_2p: 'θα γράψετε',
  future_3p: 'θα γράψουν',
  // Perfect tense
  perfect_1s: 'έχω γράψει',
  perfect_2s: 'έχεις γράψει',
  perfect_3s: 'έχει γράψει',
  perfect_1p: 'έχουμε γράψει',
  perfect_2p: 'έχετε γράψει',
  perfect_3p: 'έχουν γράψει',
  // Imperative
  imperative_2s: 'γράψε',
  imperative_2p: 'γράψτε',
};

// Partial mock verb data (only present and imperative)
const mockVerbDataPartial: VerbData = {
  voice: 'active',
  present_1s: 'τρέχω',
  present_2s: 'τρέχεις',
  present_3s: 'τρέχει',
  present_1p: 'τρέχουμε',
  present_2p: 'τρέχετε',
  present_3p: 'τρέχουν',
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
  imperative_2s: 'τρέξε',
  imperative_2p: 'τρέξτε',
};

describe('TenseTabs', () => {
  describe('Tab Triggers', () => {
    it('should render all 6 tense tab triggers', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Present' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Imperfect' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Past' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Future' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Perfect' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Imperative' })).toBeInTheDocument();
    });

    it('should have Present tab selected by default', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      const presentTab = screen.getByRole('tab', { name: 'Present' });
      expect(presentTab).toHaveAttribute('data-state', 'active');
    });

    it('should display Present tense content by default', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      // Present tense conjugation should be visible
      expect(screen.getByText('γράφω')).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('should switch to Past tense when clicking Past tab', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      const pastTab = screen.getByRole('tab', { name: 'Past' });
      await user.click(pastTab);

      expect(pastTab).toHaveAttribute('data-state', 'active');
      expect(screen.getByText('έγραψα')).toBeInTheDocument();
    });

    it('should switch to Imperative tense and show imperative forms', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      const imperativeTab = screen.getByRole('tab', { name: 'Imperative' });
      await user.click(imperativeTab);

      expect(imperativeTab).toHaveAttribute('data-state', 'active');
      expect(screen.getByText('γράψε')).toBeInTheDocument();
      expect(screen.getByText('γράψτε')).toBeInTheDocument();
    });

    it('should switch to Future tense when clicking Future tab', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      const futureTab = screen.getByRole('tab', { name: 'Future' });
      await user.click(futureTab);

      expect(futureTab).toHaveAttribute('data-state', 'active');
      expect(screen.getByText('θα γράψω')).toBeInTheDocument();
    });
  });

  describe('Disabled Tabs', () => {
    it('should disable tabs without data', () => {
      render(<TenseTabs verbData={mockVerbDataPartial} />);

      // Present and Imperative should be enabled
      expect(screen.getByRole('tab', { name: 'Present' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Imperative' })).not.toBeDisabled();

      // Other tenses should be disabled
      expect(screen.getByRole('tab', { name: 'Imperfect' })).toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Past' })).toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Future' })).toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Perfect' })).toBeDisabled();
    });

    it('should not switch to disabled tab when clicked', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataPartial} />);

      const presentTab = screen.getByRole('tab', { name: 'Present' });
      const pastTab = screen.getByRole('tab', { name: 'Past' });

      await user.click(pastTab);

      // Present should still be active since Past is disabled
      expect(presentTab).toHaveAttribute('data-state', 'active');
      expect(pastTab).toHaveAttribute('data-state', 'inactive');
    });
  });

  describe('i18n Labels', () => {
    it('should display correct English tense labels', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Present' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Imperfect' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Past' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Future' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Perfect' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Imperative' })).toBeInTheDocument();
    });
  });

  describe('Tab Content', () => {
    it('should render VerbConjugationGrid with selectedTense for non-imperative', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      // Check that person labels are visible in the table (single-tense view)
      expect(screen.getByText('You (singular)')).toBeInTheDocument();
      expect(screen.getByText('He/She')).toBeInTheDocument();

      // Switch to Past and verify content changes
      await user.click(screen.getByRole('tab', { name: 'Past' }));
      expect(screen.getByText('έγραψα')).toBeInTheDocument();
    });

    it('should render imperative form layout when Imperative tab is selected', async () => {
      const user = userEvent.setup();
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      await user.click(screen.getByRole('tab', { name: 'Imperative' }));

      // Should show singular/plural labels in table header
      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should enable all tabs when all tenses have data', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      expect(screen.getByRole('tab', { name: 'Present' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Imperfect' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Past' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Future' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Perfect' })).not.toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Imperative' })).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper tablist role', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have proper tab roles for all triggers', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(6);
    });

    it('should have proper tabpanel role for content', () => {
      render(<TenseTabs verbData={mockVerbDataComplete} />);

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });
});
