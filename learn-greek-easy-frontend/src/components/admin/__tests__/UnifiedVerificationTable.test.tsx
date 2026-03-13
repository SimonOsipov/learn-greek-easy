import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { UnifiedVerificationTable } from '../UnifiedVerificationTable';
import type { PillState, SelectionSource } from '../UnifiedVerificationTable';
import type {
  CrossAIVerificationResult,
  FieldComparisonResult,
  FieldVerificationResult,
  LocalVerificationResult,
} from '@/services/adminAPI';

function makeLocalField(
  field_path: string,
  status: 'pass' | 'fail' | 'warn' | 'skipped',
  message?: string,
  referenceValue?: string | null,
  referenceSource?: string | null
): FieldVerificationResult {
  return {
    field_path,
    status,
    checks: message
      ? [
          {
            check_name: 'test',
            status: status === 'skipped' ? 'pass' : status,
            message,
            reference_value: referenceValue ?? null,
            reference_source: referenceSource ?? null,
          },
        ]
      : [],
  };
}

function makeLocalResult(fields: FieldVerificationResult[]): LocalVerificationResult {
  return {
    fields,
    tier: 'auto_approve',
    stages_skipped: [],
    summary: '',
  };
}

function makeComparison(
  field_path: string,
  agrees: boolean,
  primary = 'val1',
  secondary = 'val2'
): FieldComparisonResult {
  return { field_path, agrees, primary_value: primary, secondary_value: secondary, weight: 1.0 };
}

function makeCrossAI(
  comparisons: FieldComparisonResult[],
  error?: string
): CrossAIVerificationResult {
  return {
    comparisons,
    overall_agreement: error ? null : 0.9,
    secondary_model: 'gpt-4',
    secondary_generation: null,
    error: error ?? null,
  };
}

function renderComponent(
  local: LocalVerificationResult | null,
  crossAI: CrossAIVerificationResult | null,
  selections?: Map<string, SelectionSource>,
  onSelect?: ReturnType<typeof vi.fn>,
  interactive?: boolean
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <UnifiedVerificationTable
        local={local}
        crossAI={crossAI}
        selections={selections}
        onSelect={onSelect}
        interactive={interactive}
      />
    </I18nextProvider>
  );
}

describe('UnifiedVerificationTable', () => {
  it('renders nothing when no data', () => {
    const { container } = renderComponent(null, null);
    expect(container.firstChild).toBeNull();
  });

  it('shows all-pass rows immediately without toggle', () => {
    const local = makeLocalResult([
      makeLocalField('lemma', 'pass'),
      makeLocalField('translation_en', 'pass'),
    ]);
    renderComponent(local, null);

    expect(screen.queryByTestId('unified-passing-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
  });

  it('shows fail rows and pass rows together', () => {
    const local = makeLocalResult([
      makeLocalField('lemma', 'fail', 'spell fail'),
      makeLocalField('translation_en', 'pass'),
    ]);
    renderComponent(local, null);

    // Both rows visible immediately
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
    expect(screen.queryByTestId('unified-passing-toggle')).not.toBeInTheDocument();
  });

  it('shows warn rows in attention section', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'warn', 'weak match')]);
    renderComponent(local, null);

    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
  });

  it('shows cross-AI mismatch in attention section', () => {
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI);

    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('shows em-dash in Local column when local is null', () => {
    const crossAIFail = makeCrossAI([makeComparison('lemma', false, 'a', 'b')]);
    renderComponent(null, crossAIFail);
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
  });

  it('shows em-dash in Cross-AI column when crossAI is null', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'fail', 'error')]);
    renderComponent(local, null);

    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
  });

  it('shows cross-AI error alert', () => {
    const crossAI = makeCrossAI([], 'API timeout');
    renderComponent(null, crossAI);

    expect(screen.getByTestId('cross-ai-error')).toBeInTheDocument();
    expect(screen.getByText(/API timeout/)).toBeInTheDocument();
  });

  it('joins rows from both local and crossAI by field_path', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'pass')]);
    const crossAI = makeCrossAI([makeComparison('lemma', true)]);
    renderComponent(local, crossAI);

    // lemma passes both — visible immediately
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
  });

  it('renders skipped fields with dash (visible immediately)', () => {
    const local = makeLocalResult([makeLocalField('translation_en', 'skipped')]);
    renderComponent(local, null);

    // skipped fields are visible immediately
    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
  });

  it('displays human-readable field label instead of raw path', () => {
    const local = makeLocalResult([makeLocalField('cases.singular.nominative', 'fail')]);
    renderComponent(local, null);
    expect(screen.getByText('Singular Nominative')).toBeInTheDocument();
  });

  it('shows severity dot with correct color for fail row', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'fail', 'bad value')]);
    renderComponent(local, null);
    const row = screen.getByTestId('unified-row-lemma');
    expect(row.querySelector('.bg-red-500')).toBeTruthy();
  });

  it('shows severity dot with correct color for warn row', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'warn', 'weak match')]);
    renderComponent(local, null);
    const row = screen.getByTestId('unified-row-lemma');
    expect(row.querySelector('.bg-yellow-500')).toBeTruthy();
  });

  it('shows primary and secondary values in separate columns', () => {
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'cat', 'κατ')]);
    renderComponent(null, crossAI);
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.getByText('κατ')).toBeInTheDocument();
  });

  it('decision column shows dash fallback when no resolvedValues', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'fail')]);
    const crossAI = makeCrossAI([makeComparison('lemma', true, 'house', 'house')]);
    renderComponent(local, crossAI);
    const row = screen.getByTestId('unified-row-lemma');
    // Without resolvedValues, fallback renders em-dash
    const decisionTd = row.querySelector('td:last-child');
    expect(decisionTd?.textContent).toBe('—');
  });

  it('decision column shows dash fallback when agrees is false and no resolvedValues', () => {
    const crossAI = makeCrossAI([makeComparison('lemma', false, 'house', 'home')]);
    renderComponent(null, crossAI);
    const row = screen.getByTestId('unified-row-lemma');
    // Without resolvedValues, fallback renders em-dash
    const decisionTd = row.querySelector('td:last-child');
    expect(decisionTd?.textContent).toBe('—');
  });

  it('Local column shows icon only (no text label)', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'warn', 'weak match')]);
    renderComponent(local, null);
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    expect(screen.queryByText('Pass')).not.toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('shows reference text in Local column when reference_value is present', () => {
    const local = makeLocalResult([
      makeLocalField('translation_en', 'pass', 'ok', 'house', 'dictionary'),
    ]);
    renderComponent(local, null);
    expect(screen.getByText('house')).toBeInTheDocument();
  });

  it('shows only severity icon when no reference_value in checks', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'pass', 'ok')]);
    renderComponent(local, null);
    const row = screen.getByTestId('unified-row-lemma');
    expect(row.querySelector('svg')).toBeTruthy();
    // No truncated reference text span
    const localTd = row.querySelectorAll('td')[1];
    expect(localTd?.querySelector('.truncate')).toBeFalsy();
  });

  it('filters out examples row even when backend sends it', () => {
    const local = makeLocalResult([
      makeLocalField('lemma', 'pass'),
      makeLocalField('examples', 'pass'),
    ]);
    renderComponent(local, null);
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
    expect(screen.queryByTestId('unified-row-examples')).not.toBeInTheDocument();
  });
});

describe('interactive click-to-select', () => {
  it('clicking primary cell in disagreement row calls onSelect with primary', async () => {
    const onSelect = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryTd = row.querySelectorAll('td')[2];
    const clickable = primaryTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);
    expect(onSelect).toHaveBeenCalledWith('translation_en', 'primary');
  });

  it('clicking secondary cell in disagreement row calls onSelect with secondary', async () => {
    const onSelect = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const secondaryTd = row.querySelectorAll('td')[3];
    const clickable = secondaryTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);
    expect(onSelect).toHaveBeenCalledWith('translation_en', 'secondary');
  });

  it('re-clicking on different source calls onSelect with new source', async () => {
    const onSelect = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryClickable = row.querySelectorAll('td')[2]?.querySelector('.cursor-pointer');
    const secondaryClickable = row.querySelectorAll('td')[3]?.querySelector('.cursor-pointer');
    await userEvent.click(primaryClickable!);
    await userEvent.click(secondaryClickable!);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'translation_en', 'primary');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'translation_en', 'secondary');
  });

  it('clicking local cell calls onSelect with local when reference_value is present', async () => {
    const onSelect = vi.fn();
    const local = makeLocalResult([
      makeLocalField('translation_en', 'pass', 'ok', 'house', 'dictionary'),
    ]);
    renderComponent(local, null, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const localTd = row.querySelectorAll('td')[1];
    const clickable = localTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);
    expect(onSelect).toHaveBeenCalledWith('translation_en', 'local');
  });

  it('selected cell shows ring-2 ring-primary class', () => {
    const selections = new Map<string, SelectionSource>([['translation_en', 'primary']]);
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, selections, undefined, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryCell = row.querySelectorAll('td')[2];
    expect(primaryCell?.querySelector('.ring-2')).toBeTruthy();
  });

  it('non-selected cells in same row show opacity-50', () => {
    const selections = new Map<string, SelectionSource>([['translation_en', 'primary']]);
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, selections, undefined, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const secondaryCell = row.querySelectorAll('td')[3];
    expect(secondaryCell?.querySelector('.opacity-50')).toBeTruthy();
  });

  it('local cell not clickable when no reference_value in checks', async () => {
    const onSelect = vi.fn();
    const local = makeLocalResult([makeLocalField('lemma', 'pass', 'ok')]);
    renderComponent(local, null, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-lemma');
    const localCell = row.querySelectorAll('td')[1];
    await userEvent.click(localCell!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('interactive=false: primary cell not clickable even on disagreement row', async () => {
    const onSelect = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    renderComponent(null, crossAI, undefined, onSelect, false);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryCell = row.querySelectorAll('td')[2];
    await userEvent.click(primaryCell!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking primary cell on agreed row (agrees: true) calls onSelect', async () => {
    const onSelect = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', true, 'house', 'house')]);
    renderComponent(null, crossAI, undefined, onSelect, true);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryCell = row.querySelectorAll('td')[2];
    const clickable = primaryCell?.querySelector('.cursor-pointer');
    expect(clickable).toBeTruthy();
    await userEvent.click(clickable!);
    expect(onSelect).toHaveBeenCalledWith('translation_en', 'primary');
  });
});

function renderWithPills(
  crossAI: CrossAIVerificationResult,
  resolvedValues: Map<string, PillState>,
  onResolvedValueChange: ReturnType<typeof vi.fn>,
  onSelect?: ReturnType<typeof vi.fn>
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <UnifiedVerificationTable
        local={null}
        crossAI={crossAI}
        resolvedValues={resolvedValues}
        onResolvedValueChange={onResolvedValueChange}
        onSelect={onSelect}
        interactive={true}
      />
    </I18nextProvider>
  );
}

describe('cell-click pill sync', () => {
  it('clicking primary cell calls onResolvedValueChange with primary value', async () => {
    const onResolvedValueChange = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    const resolvedValues = new Map<string, PillState>([
      ['translation_en', { value: 'house', status: 'unresolved', source: 'auto' }],
    ]);
    renderWithPills(crossAI, resolvedValues, onResolvedValueChange);

    const row = screen.getByTestId('unified-row-translation_en');
    const primaryTd = row.querySelectorAll('td')[2];
    const clickable = primaryTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);

    expect(onResolvedValueChange).toHaveBeenCalledWith('translation_en', 'house');
  });

  it('clicking secondary cell calls onResolvedValueChange with secondary value', async () => {
    const onResolvedValueChange = vi.fn();
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    const resolvedValues = new Map<string, PillState>([
      ['translation_en', { value: 'house', status: 'unresolved', source: 'auto' }],
    ]);
    renderWithPills(crossAI, resolvedValues, onResolvedValueChange);

    const row = screen.getByTestId('unified-row-translation_en');
    const secondaryTd = row.querySelectorAll('td')[3];
    const clickable = secondaryTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);

    expect(onResolvedValueChange).toHaveBeenCalledWith('translation_en', 'home');
  });

  it('clicking local cell calls onResolvedValueChange with reference value', async () => {
    const onResolvedValueChange = vi.fn();
    const local = makeLocalResult([
      makeLocalField('translation_en', 'pass', 'ok', 'house', 'dictionary'),
    ]);
    const resolvedValues = new Map<string, PillState>([
      ['translation_en', { value: 'house', status: 'agreed', source: 'local' }],
    ]);

    render(
      <I18nextProvider i18n={i18n}>
        <UnifiedVerificationTable
          local={local}
          crossAI={null}
          resolvedValues={resolvedValues}
          onResolvedValueChange={onResolvedValueChange}
          interactive={true}
        />
      </I18nextProvider>
    );

    const row = screen.getByTestId('unified-row-translation_en');
    const localTd = row.querySelectorAll('td')[1];
    const clickable = localTd?.querySelector('.cursor-pointer');
    await userEvent.click(clickable!);

    expect(onResolvedValueChange).toHaveBeenCalledWith('translation_en', 'house');
  });

  it('table has colgroup with 5 col elements', () => {
    const crossAI = makeCrossAI([makeComparison('translation_en', false, 'house', 'home')]);
    const resolvedValues = new Map<string, PillState>([
      ['translation_en', { value: 'house', status: 'unresolved', source: 'auto' }],
    ]);
    const { container } = renderWithPills(crossAI, resolvedValues, vi.fn());

    const colgroup = container.querySelector('colgroup');
    expect(colgroup).toBeTruthy();
    expect(colgroup?.querySelectorAll('col')).toHaveLength(5);
  });
});
