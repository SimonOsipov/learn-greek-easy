/**
 * DecisionPill tests
 *
 * DecisionPill is a private component inside UnifiedVerificationTable.tsx.
 * We test it by rendering UnifiedVerificationTable with a `resolvedValues` Map
 * entry for a known field_path so the pill renders in the decision column.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { UnifiedVerificationTable } from '../UnifiedVerificationTable';
import type { PillState } from '../UnifiedVerificationTable';
import type { CrossAIVerificationResult, FieldComparisonResult } from '@/services/adminAPI';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComparison(
  field_path: string,
  agrees: boolean,
  primary = 'house',
  secondary = 'home'
): FieldComparisonResult {
  return { field_path, agrees, primary_value: primary, secondary_value: secondary, weight: 1.0 };
}

function makeCrossAI(comparisons: FieldComparisonResult[]): CrossAIVerificationResult {
  return {
    comparisons,
    overall_agreement: 0.9,
    secondary_model: 'gpt-4',
    secondary_generation: null,
    error: null,
  };
}

function makePillState(
  value: string,
  status: PillState['status'],
  source: PillState['source'] = 'auto'
): PillState {
  return { value, status, source };
}

/**
 * Render UnifiedVerificationTable with a single crossAI comparison for
 * `fieldPath`, plus a resolvedValues entry with the given PillState so the
 * DecisionPill renders in the decision column.
 */
function renderPill(
  fieldPath: string,
  pillState: PillState,
  onResolvedValueChange?: ReturnType<typeof vi.fn>
) {
  const comparisons = [makeComparison(fieldPath, pillState.status === 'agreed', 'val1', 'val2')];
  const resolvedValues = new Map<string, PillState>([[fieldPath, pillState]]);

  return render(
    <I18nextProvider i18n={i18n}>
      <UnifiedVerificationTable
        local={null}
        crossAI={makeCrossAI(comparisons)}
        resolvedValues={resolvedValues}
        onResolvedValueChange={onResolvedValueChange}
        interactive={true}
      />
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecisionPill (via UnifiedVerificationTable)', () => {
  describe('visual states', () => {
    it('renders agreed state with green border', () => {
      renderPill('translation_en', makePillState('house', 'agreed'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      // The inner border span should contain border-green-500
      const borderSpan = pill.querySelector('.border-green-500');
      expect(borderSpan).toBeTruthy();
    });

    it('renders resolved state with blue border', () => {
      renderPill('translation_en', makePillState('house', 'resolved'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      const borderSpan = pill.querySelector('.border-blue-500');
      expect(borderSpan).toBeTruthy();
    });

    it('renders unresolved non-editable (grammar_data.gender) with red border', () => {
      // grammar_data.gender is NOT in EDITABLE_FIELDS — pill should be non-editable
      renderPill('grammar_data.gender', makePillState('masculine', 'unresolved'));
      const pill = screen.getByTestId('decision-pill-grammar_data.gender');
      const borderSpan = pill.querySelector('.border-red-500');
      expect(borderSpan).toBeTruthy();
    });

    it('renders unresolved editable (translation_en) with red border', () => {
      // translation_en IS in EDITABLE_FIELDS — pill shows pencil and is clickable
      renderPill('translation_en', makePillState('house', 'unresolved'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      const borderSpan = pill.querySelector('.border-red-500');
      expect(borderSpan).toBeTruthy();
    });

    it('renders editable state with muted border and pencil', () => {
      // translation_en + status editable → border-muted-foreground
      renderPill('translation_en', makePillState('house', 'editable'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      const borderSpan = pill.querySelector('.border-muted-foreground');
      expect(borderSpan).toBeTruthy();
    });

    it('renders pill text showing the value', () => {
      renderPill('translation_en', makePillState('domicile', 'agreed'));
      expect(screen.getByText('domicile')).toBeInTheDocument();
    });
  });

  describe('pill text truncation', () => {
    it('pill text span has max-w-[120px] truncate classes', () => {
      renderPill('translation_en', makePillState('house', 'agreed'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      const textSpan = pill.querySelector('.truncate');
      expect(textSpan).toBeTruthy();
      // Also verify the max-w-[120px] class is present
      expect(textSpan?.className).toContain('max-w-[120px]');
    });
  });

  describe('popover interaction (editable fields)', () => {
    it('editable pill opens popover input on click', async () => {
      renderPill('translation_en', makePillState('house', 'editable'));
      const pill = screen.getByTestId('decision-pill-translation_en');
      // The PopoverTrigger is a clickable span inside the pill
      const trigger = pill.querySelector('span.cursor-pointer');
      await userEvent.click(trigger!);
      // Popover content should contain an input
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('Enter confirms edit and calls onResolvedValueChange', async () => {
      const onResolvedValueChange = vi.fn();
      renderPill('translation_en', makePillState('house', 'editable'), onResolvedValueChange);
      const pill = screen.getByTestId('decision-pill-translation_en');
      const trigger = pill.querySelector('span.cursor-pointer');
      await userEvent.click(trigger!);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'dwelling');
      await userEvent.keyboard('{Enter}');

      expect(onResolvedValueChange).toHaveBeenCalledWith('translation_en', 'dwelling');
    });

    it('Escape cancels edit and does not call onResolvedValueChange', async () => {
      const onResolvedValueChange = vi.fn();
      renderPill('translation_en', makePillState('house', 'editable'), onResolvedValueChange);
      const pill = screen.getByTestId('decision-pill-translation_en');
      const trigger = pill.querySelector('span.cursor-pointer');
      await userEvent.click(trigger!);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'dwelling');
      await userEvent.keyboard('{Escape}');

      expect(onResolvedValueChange).not.toHaveBeenCalled();
    });

    it('non-editable pill (grammar_data.gender, unresolved) does not render popover trigger', async () => {
      const onResolvedValueChange = vi.fn();
      renderPill(
        'grammar_data.gender',
        makePillState('masculine', 'unresolved'),
        onResolvedValueChange
      );
      const pill = screen.getByTestId('decision-pill-grammar_data.gender');
      // Non-editable: no cursor-pointer span inside
      const trigger = pill.querySelector('span.cursor-pointer');
      expect(trigger).toBeFalsy();
    });
  });
});
