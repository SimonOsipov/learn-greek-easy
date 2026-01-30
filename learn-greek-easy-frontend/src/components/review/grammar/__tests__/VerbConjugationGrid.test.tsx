/**
 * VerbConjugationGrid Component Tests
 *
 * Tests for the VerbConjugationGrid component, verifying:
 * - Renders 6x5 grid (6 persons x 5 tenses)
 * - Renders imperative section
 * - Displays correct i18n labels for tenses, persons, and imperatives
 * - Handles missing data with N/A placeholder
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VerbConjugationGrid } from '../VerbConjugationGrid';
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

// Partial mock verb data (missing some forms)
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
  past_1s: 'έτρεξα',
  past_2s: 'έτρεξες',
  past_3s: 'έτρεξε',
  past_1p: '',
  past_2p: '',
  past_3p: '',
  future_1s: 'θα τρέξω',
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
  imperative_2p: '',
};

// Empty mock verb data
const mockVerbDataEmpty: VerbData = {
  voice: 'passive',
  present_1s: '',
  present_2s: '',
  present_3s: '',
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

describe('VerbConjugationGrid', () => {
  describe('Tense Headers', () => {
    it('should render present tense header', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Present')).toBeInTheDocument();
    });

    it('should render imperfect tense header', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Imperfect')).toBeInTheDocument();
    });

    it('should render past tense header', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Past')).toBeInTheDocument();
    });

    it('should render future tense header', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Future')).toBeInTheDocument();
    });

    it('should render perfect tense header', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Perfect')).toBeInTheDocument();
    });
  });

  describe('Person Labels', () => {
    it('should render first person singular label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('I')).toBeInTheDocument();
    });

    it('should render second person singular label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('You (sg)')).toBeInTheDocument();
    });

    it('should render third person singular label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('He/She')).toBeInTheDocument();
    });

    it('should render first person plural label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('We')).toBeInTheDocument();
    });

    it('should render second person plural label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('You (pl)')).toBeInTheDocument();
    });

    it('should render third person plural label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('They')).toBeInTheDocument();
    });
  });

  describe('Imperative Section', () => {
    it('should render imperative title', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('Imperative')).toBeInTheDocument();
    });

    it('should render singular imperative label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      // The label includes "Singular:" with colon
      expect(screen.getByText(/Singular:/)).toBeInTheDocument();
    });

    it('should render plural imperative label', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      // The label includes "Plural:" with colon
      expect(screen.getByText(/Plural:/)).toBeInTheDocument();
    });

    it('should render imperative forms', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('γράψε')).toBeInTheDocument();
      expect(screen.getByText('γράψτε')).toBeInTheDocument();
    });
  });

  describe('Complete Data', () => {
    it('should render present tense conjugations', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('γράφω')).toBeInTheDocument();
      expect(screen.getByText('γράφεις')).toBeInTheDocument();
      expect(screen.getByText('γράφει')).toBeInTheDocument();
      expect(screen.getByText('γράφουμε')).toBeInTheDocument();
      expect(screen.getByText('γράφετε')).toBeInTheDocument();
      expect(screen.getByText('γράφουν')).toBeInTheDocument();
    });

    it('should render past tense conjugations', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('έγραψα')).toBeInTheDocument();
      expect(screen.getByText('έγραψες')).toBeInTheDocument();
      expect(screen.getByText('έγραψε')).toBeInTheDocument();
      expect(screen.getByText('γράψαμε')).toBeInTheDocument();
      expect(screen.getByText('γράψατε')).toBeInTheDocument();
      expect(screen.getByText('έγραψαν')).toBeInTheDocument();
    });

    it('should render future tense conjugations', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.getByText('θα γράψω')).toBeInTheDocument();
      expect(screen.getByText('θα γράψεις')).toBeInTheDocument();
      expect(screen.getByText('θα γράψει')).toBeInTheDocument();
      expect(screen.getByText('θα γράψουμε')).toBeInTheDocument();
      expect(screen.getByText('θα γράψετε')).toBeInTheDocument();
      expect(screen.getByText('θα γράψουν')).toBeInTheDocument();
    });

    it('should not display any N/A with complete data', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    });
  });

  describe('Partial Data', () => {
    it('should display N/A for missing conjugations', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataPartial} />);

      // Count N/A instances - should have many for missing forms
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display available conjugations correctly', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataPartial} />);

      // Present tense should be complete
      expect(screen.getByText('τρέχω')).toBeInTheDocument();
      expect(screen.getByText('τρέχεις')).toBeInTheDocument();

      // Some past tense forms
      expect(screen.getByText('έτρεξα')).toBeInTheDocument();

      // Future first person
      expect(screen.getByText('θα τρέξω')).toBeInTheDocument();
    });

    it('should display N/A for missing imperative plural', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataPartial} />);

      // Imperative singular should be present
      expect(screen.getByText('τρέξε')).toBeInTheDocument();

      // The N/A should appear in the imperative section
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty Data', () => {
    it('should display N/A for all empty conjugations', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataEmpty} />);

      // 30 conjugations (6 persons x 5 tenses) + 2 imperatives = 32 N/A
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(32);
    });

    it('should still render all tense and person labels', () => {
      render(<VerbConjugationGrid verbData={mockVerbDataEmpty} />);

      // Tenses
      expect(screen.getByText('Present')).toBeInTheDocument();
      expect(screen.getByText('Imperfect')).toBeInTheDocument();
      expect(screen.getByText('Past')).toBeInTheDocument();
      expect(screen.getByText('Future')).toBeInTheDocument();
      expect(screen.getByText('Perfect')).toBeInTheDocument();

      // Persons
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('You (sg)')).toBeInTheDocument();
      expect(screen.getByText('He/She')).toBeInTheDocument();
      expect(screen.getByText('We')).toBeInTheDocument();
      expect(screen.getByText('You (pl)')).toBeInTheDocument();
      expect(screen.getByText('They')).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('should render main conjugation table', () => {
      const { container } = render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      // Main table should have 6 person rows
      const tableBody = container.querySelector('tbody');
      const rows = tableBody?.querySelectorAll('tr');
      expect(rows?.length).toBe(6);
    });

    it('should render imperative section as separate grid', () => {
      const { container } = render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      // Imperative section has grid-cols-2 class
      const imperativeGrid = container.querySelector('.grid-cols-2');
      expect(imperativeGrid).toBeInTheDocument();
    });

    it('should have space-y-4 container for vertical spacing', () => {
      const { container } = render(<VerbConjugationGrid verbData={mockVerbDataComplete} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('space-y-4');
    });
  });
});
