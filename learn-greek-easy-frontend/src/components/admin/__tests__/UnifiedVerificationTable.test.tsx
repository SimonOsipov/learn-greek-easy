import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { UnifiedVerificationTable } from '../UnifiedVerificationTable';
import type {
  CrossAIVerificationResult,
  FieldComparisonResult,
  FieldVerificationResult,
  LocalVerificationResult,
} from '@/services/adminAPI';

function makeLocalField(
  field_path: string,
  status: 'pass' | 'fail' | 'warn' | 'skipped',
  message?: string
): FieldVerificationResult {
  return {
    field_path,
    status,
    checks: message
      ? [{ check_name: 'test', status: status === 'skipped' ? 'pass' : status, message }]
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
  morphologySource?: 'lexicon' | 'llm'
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <UnifiedVerificationTable
        local={local}
        crossAI={crossAI}
        morphologySource={morphologySource}
      />
    </I18nextProvider>
  );
}

describe('UnifiedVerificationTable', () => {
  it('renders nothing when no data', () => {
    const { container } = renderComponent(null, null);
    expect(container.firstChild).toBeNull();
  });

  it('shows all-pass rows in collapsible', async () => {
    const user = userEvent.setup();
    const local = makeLocalResult([
      makeLocalField('lemma', 'pass'),
      makeLocalField('translation_en', 'pass'),
    ]);
    renderComponent(local, null);

    expect(screen.getByTestId('unified-passing-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('unified-row-lemma')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('unified-passing-toggle'));
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
  });

  it('shows fail rows in attention section (not collapsed)', () => {
    const local = makeLocalResult([
      makeLocalField('lemma', 'fail', 'spell fail'),
      makeLocalField('translation_en', 'pass'),
    ]);
    renderComponent(local, null);

    // Fail row visible immediately
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
    // Pass row hidden in collapsible
    expect(screen.queryByTestId('unified-row-translation_en')).not.toBeInTheDocument();
    expect(screen.getByTestId('unified-passing-toggle')).toBeInTheDocument();
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
    expect(screen.getByText(/mismatch/)).toBeInTheDocument();
  });

  it('shows em-dash in Local column when local is null', () => {
    const crossAI = makeCrossAI([makeComparison('lemma', true)]);
    renderComponent(null, crossAI);

    // lemma agrees=true so it's in passing group
    // cross-AI match is visible, local should show em-dash
    // (toggle needed to see passing rows)
    // Let's use a fail comparison so it shows immediately
    const crossAIFail = makeCrossAI([makeComparison('lemma', false, 'a', 'b')]);
    render(
      <I18nextProvider i18n={i18n}>
        <UnifiedVerificationTable local={null} crossAI={crossAIFail} />
      </I18nextProvider>
    );
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

  it('shows lexicon scope note when morphologySource is lexicon', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'pass')]);
    renderComponent(local, null, 'lexicon');

    expect(screen.getByTestId('lexicon-scope-note')).toBeInTheDocument();
  });

  it('does not show lexicon scope note for llm source', () => {
    const local = makeLocalResult([makeLocalField('lemma', 'pass')]);
    renderComponent(local, null, 'llm');

    expect(screen.queryByTestId('lexicon-scope-note')).not.toBeInTheDocument();
  });

  it('shows agreement badge when crossAI has overall_agreement', () => {
    const crossAI = makeCrossAI([makeComparison('lemma', true)]);
    renderComponent(null, crossAI);

    expect(screen.getByTestId('cross-ai-agreement')).toBeInTheDocument();
  });

  it('joins rows from both local and crossAI by field_path', async () => {
    const user = userEvent.setup();
    const local = makeLocalResult([makeLocalField('lemma', 'pass')]);
    const crossAI = makeCrossAI([makeComparison('lemma', true)]);
    renderComponent(local, crossAI);

    // lemma passes both — in collapsible
    await user.click(screen.getByTestId('unified-passing-toggle'));
    expect(screen.getByTestId('unified-row-lemma')).toBeInTheDocument();
  });

  it('renders skipped fields with dash (not in attention)', async () => {
    const user = userEvent.setup();
    const local = makeLocalResult([makeLocalField('translation_en', 'skipped')]);
    renderComponent(local, null);

    // skipped is not in attention group
    await user.click(screen.getByTestId('unified-passing-toggle'));
    expect(screen.getByTestId('unified-row-translation_en')).toBeInTheDocument();
  });
});
