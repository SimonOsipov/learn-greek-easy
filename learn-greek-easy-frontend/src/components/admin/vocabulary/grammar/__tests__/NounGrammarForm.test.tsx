/**
 * NounGrammarForm Component Tests
 *
 * Comprehensive tests for the NounGrammarForm component, covering:
 * - Basic form rendering with correct elements
 * - Gender selector with 3 options (masculine, feminine, neuter)
 * - Declension table with 8 input fields (4 cases x 2 numbers)
 * - All required test IDs present
 * - Form context integration with dot notation paths
 * - Disabled state when isSubmitting is true
 * - Responsive table styling
 *
 * Related feature: [ADMCARD-03] NounGrammarForm Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { FormProvider, useForm } from 'react-hook-form';

import { NounGrammarForm, type NounGrammarFormProps } from '../NounGrammarForm';
import i18n from '@/i18n';

// ============================================
// Test Utilities
// ============================================

/**
 * Default form values for testing
 */
const defaultFormValues = {
  noun_data: {
    gender: '',
    nominative_singular: '',
    nominative_plural: '',
    genitive_singular: '',
    genitive_plural: '',
    accusative_singular: '',
    accusative_plural: '',
    vocative_singular: '',
    vocative_plural: '',
  },
};

/**
 * Wrapper component that provides FormProvider context
 */
function FormWrapper({
  children,
  defaultValues = defaultFormValues,
}: {
  children: React.ReactNode;
  defaultValues?: typeof defaultFormValues;
}) {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

/**
 * Render helper with I18nextProvider and FormProvider
 */
const renderForm = (
  props: Partial<NounGrammarFormProps> = {},
  formValues: typeof defaultFormValues = defaultFormValues
) => {
  const defaultProps: NounGrammarFormProps = {
    isSubmitting: false,
    ...props,
  };

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <FormWrapper defaultValues={formValues}>
          <NounGrammarForm {...defaultProps} />
        </FormWrapper>
      </I18nextProvider>
    ),
    props: defaultProps,
  };
};

// ============================================
// Tests
// ============================================

describe('NounGrammarForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering Tests
  // ============================================

  describe('Rendering', () => {
    it('should render form with correct test id', () => {
      renderForm();
      expect(screen.getByTestId('noun-grammar-form')).toBeInTheDocument();
    });

    it('should render gender selector', () => {
      renderForm();
      expect(screen.getByTestId('noun-gender-select')).toBeInTheDocument();
    });

    it('should render declension table', () => {
      renderForm();
      // Table should have header row and 4 case rows
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should render all 8 declension input fields', () => {
      renderForm();
      // Singular inputs
      expect(screen.getByTestId('noun-nominative-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-genitive-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-accusative-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-vocative-singular')).toBeInTheDocument();
      // Plural inputs
      expect(screen.getByTestId('noun-nominative-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-genitive-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-accusative-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-vocative-plural')).toBeInTheDocument();
    });

    it('should render table headers for Singular and Plural columns', () => {
      renderForm();
      expect(screen.getByText('Singular')).toBeInTheDocument();
      expect(screen.getByText('Plural')).toBeInTheDocument();
    });

    it('should render all 4 case labels', () => {
      renderForm();
      expect(screen.getByText('Nominative')).toBeInTheDocument();
      expect(screen.getByText('Genitive')).toBeInTheDocument();
      expect(screen.getByText('Accusative')).toBeInTheDocument();
      expect(screen.getByText('Vocative')).toBeInTheDocument();
    });

    it('should render gender label', () => {
      renderForm();
      expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('should have responsive table styling with overflow-hidden and rounded-md border', () => {
      renderForm();
      const tableContainer = screen.getByRole('table').closest('.overflow-hidden');
      expect(tableContainer).toHaveClass('overflow-hidden', 'rounded-md', 'border');
    });
  });

  // ============================================
  // Gender Selector Tests
  // ============================================

  describe('Gender Selector', () => {
    it('should show placeholder when no gender selected', () => {
      renderForm();
      expect(screen.getByText('Select gender')).toBeInTheDocument();
    });

    // NOTE: Direct Select dropdown interaction tests are skipped because
    // Radix UI Select has known issues with hasPointerCapture in happy-dom/jsdom.
    // Gender selection functionality is tested via pre-population tests below.

    it('should display masculine gender when pre-populated', () => {
      const formValues = {
        noun_data: {
          ...defaultFormValues.noun_data,
          gender: 'masculine',
        },
      };
      renderForm({}, formValues);
      expect(screen.getByTestId('noun-gender-select')).toHaveTextContent('Masculine');
    });

    it('should display feminine gender when pre-populated', () => {
      const formValues = {
        noun_data: {
          ...defaultFormValues.noun_data,
          gender: 'feminine',
        },
      };
      renderForm({}, formValues);
      expect(screen.getByTestId('noun-gender-select')).toHaveTextContent('Feminine');
    });

    it('should display neuter gender when pre-populated', () => {
      const formValues = {
        noun_data: {
          ...defaultFormValues.noun_data,
          gender: 'neuter',
        },
      };
      renderForm({}, formValues);
      expect(screen.getByTestId('noun-gender-select')).toHaveTextContent('Neuter');
    });
  });

  // ============================================
  // Declension Input Tests
  // ============================================

  describe('Declension Inputs', () => {
    it('should allow typing in nominative singular field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-nominative-singular');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in nominative plural field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-nominative-plural');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in genitive singular field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-genitive-singular');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in genitive plural field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-genitive-plural');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in accusative singular field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-accusative-singular');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in accusative plural field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-accusative-plural');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in vocative singular field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-vocative-singular');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should allow typing in vocative plural field', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('noun-vocative-plural');
      await user.type(input, 'test value');

      expect(input).toHaveValue('test value');
    });

    it('should have text-center class on inputs', () => {
      renderForm();

      const input = screen.getByTestId('noun-nominative-singular');
      expect(input).toHaveClass('text-center');
    });

    it('should have compact height (h-8) on inputs', () => {
      renderForm();

      const input = screen.getByTestId('noun-nominative-singular');
      expect(input).toHaveClass('h-8');
    });
  });

  // ============================================
  // Form Pre-population Tests
  // ============================================

  describe('Pre-population', () => {
    it('should pre-populate gender from form context', () => {
      const formValues = {
        noun_data: {
          ...defaultFormValues.noun_data,
          gender: 'masculine',
        },
      };
      renderForm({}, formValues);

      expect(screen.getByTestId('noun-gender-select')).toHaveTextContent('Masculine');
    });

    it('should pre-populate declension fields from form context', () => {
      const formValues = {
        noun_data: {
          gender: 'masculine',
          nominative_singular: 'nom_sg_value',
          nominative_plural: 'nom_pl_value',
          genitive_singular: 'gen_sg_value',
          genitive_plural: 'gen_pl_value',
          accusative_singular: 'acc_sg_value',
          accusative_plural: 'acc_pl_value',
          vocative_singular: 'voc_sg_value',
          vocative_plural: 'voc_pl_value',
        },
      };
      renderForm({}, formValues);

      expect(screen.getByTestId('noun-nominative-singular')).toHaveValue('nom_sg_value');
      expect(screen.getByTestId('noun-nominative-plural')).toHaveValue('nom_pl_value');
      expect(screen.getByTestId('noun-genitive-singular')).toHaveValue('gen_sg_value');
      expect(screen.getByTestId('noun-genitive-plural')).toHaveValue('gen_pl_value');
      expect(screen.getByTestId('noun-accusative-singular')).toHaveValue('acc_sg_value');
      expect(screen.getByTestId('noun-accusative-plural')).toHaveValue('acc_pl_value');
      expect(screen.getByTestId('noun-vocative-singular')).toHaveValue('voc_sg_value');
      expect(screen.getByTestId('noun-vocative-plural')).toHaveValue('voc_pl_value');
    });
  });

  // ============================================
  // Disabled State Tests
  // ============================================

  describe('Disabled State (isSubmitting)', () => {
    it('should disable gender selector when isSubmitting is true', () => {
      renderForm({ isSubmitting: true });

      const selectTrigger = screen.getByTestId('noun-gender-select');
      expect(selectTrigger).toBeDisabled();
    });

    it('should disable all declension inputs when isSubmitting is true', () => {
      renderForm({ isSubmitting: true });

      const inputs = [
        'noun-nominative-singular',
        'noun-nominative-plural',
        'noun-genitive-singular',
        'noun-genitive-plural',
        'noun-accusative-singular',
        'noun-accusative-plural',
        'noun-vocative-singular',
        'noun-vocative-plural',
      ];

      inputs.forEach((testId) => {
        expect(screen.getByTestId(testId)).toBeDisabled();
      });
    });

    it('should enable all inputs when isSubmitting is false', () => {
      renderForm({ isSubmitting: false });

      const selectTrigger = screen.getByTestId('noun-gender-select');
      expect(selectTrigger).not.toBeDisabled();

      const inputs = [
        'noun-nominative-singular',
        'noun-nominative-plural',
        'noun-genitive-singular',
        'noun-genitive-plural',
        'noun-accusative-singular',
        'noun-accusative-plural',
        'noun-vocative-singular',
        'noun-vocative-plural',
      ];

      inputs.forEach((testId) => {
        expect(screen.getByTestId(testId)).not.toBeDisabled();
      });
    });
  });

  // ============================================
  // Table Structure Tests
  // ============================================

  describe('Table Structure', () => {
    it('should have 4 data rows for 4 cases', () => {
      renderForm();

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      // 1 header row + 4 case rows = 5 total
      expect(rows).toHaveLength(5);
    });

    it('should have 3 columns (case label, singular, plural)', () => {
      renderForm();

      const table = screen.getByRole('table');
      const headerCells = within(table).getAllByRole('columnheader');
      expect(headerCells).toHaveLength(3);
    });

    it('should order cases as nominative, genitive, accusative, vocative', () => {
      renderForm();

      const table = screen.getByRole('table');
      const dataRows = within(table).getAllByRole('row').slice(1); // Skip header

      expect(dataRows[0]).toHaveTextContent('Nominative');
      expect(dataRows[1]).toHaveTextContent('Genitive');
      expect(dataRows[2]).toHaveTextContent('Accusative');
      expect(dataRows[3]).toHaveTextContent('Vocative');
    });
  });

  // ============================================
  // Test ID Verification
  // ============================================

  describe('Test IDs', () => {
    it('should have all 10 required test IDs present', () => {
      renderForm();

      // Container
      expect(screen.getByTestId('noun-grammar-form')).toBeInTheDocument();

      // Gender select
      expect(screen.getByTestId('noun-gender-select')).toBeInTheDocument();

      // 8 declension inputs
      expect(screen.getByTestId('noun-nominative-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-nominative-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-genitive-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-genitive-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-accusative-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-accusative-plural')).toBeInTheDocument();
      expect(screen.getByTestId('noun-vocative-singular')).toBeInTheDocument();
      expect(screen.getByTestId('noun-vocative-plural')).toBeInTheDocument();
    });
  });

  // ============================================
  // Form Context Integration Tests
  // ============================================

  describe('Form Context Integration', () => {
    // NOTE: Gender selection via dropdown is not testable in happy-dom due to
    // Radix UI Select's hasPointerCapture issue. Gender integration is verified
    // via the pre-population tests that confirm the form reads from noun_data.gender.

    it('should use noun_data.{field} paths for declension fields', async () => {
      const user = userEvent.setup();

      const TestWrapper = () => {
        const methods = useForm({ defaultValues: defaultFormValues });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <NounGrammarForm />
              <div data-testid="form-state">{JSON.stringify(methods.watch())}</div>
            </FormProvider>
          </I18nextProvider>
        );
      };

      render(<TestWrapper />);

      await user.type(screen.getByTestId('noun-nominative-singular'), 'test');

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent || '{}');
        expect(formState.noun_data.nominative_singular).toBe('test');
      });
    });

    it('should use noun_data.gender path (verified via pre-population)', () => {
      // This test verifies that the form reads from noun_data.gender path
      // by checking that pre-populated gender values display correctly
      const formValues = {
        noun_data: {
          ...defaultFormValues.noun_data,
          gender: 'neuter',
        },
      };
      renderForm({}, formValues);

      // If the form uses the correct path, it will display the gender
      expect(screen.getByTestId('noun-gender-select')).toHaveTextContent('Neuter');
    });
  });
});
