// src/components/admin/news/__tests__/NewsEditDrawer.body.test.tsx
//
// NEWS-07b: NewsEditDrawerBody — unit tests.

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from '../NewsEditDrawer';
import { NewsEditDrawerBody } from '../NewsEditDrawer.body';

// ── Module mocks ───────────────────────────────────────────────────────────────

// Default i18n mock: returns the key as-is, except for the hint key which
// returns the exact English string so the hint text assertion can pass.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'news.drawer.body.titleB2Hint') {
        return 'This title doubles as the B2 scenario summary today. A dedicated scenario field is on the roadmap.';
      }
      return key;
    },
  }),
}));

// ── Test harness ───────────────────────────────────────────────────────────────

interface HarnessProps {
  defaults?: Partial<NewsDrawerFormData>;
}

function Harness({ defaults = {} }: HarnessProps) {
  const form = useForm<NewsDrawerFormData>({
    defaultValues: {
      title_en: '',
      title_el: '',
      title_ru: '',
      description_el: '',
      title_el_a2: null,
      description_el_a2: null,
      ...defaults,
    },
  });

  const errors = form.formState.errors;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <FormProvider {...form}>
      <NewsEditDrawerBody item={{} as NewsItemResponse} />
      {/* Sentinel Save button mirrors the real drawer's disabled logic */}
      <button
        type="button"
        disabled={form.formState.isSubmitting || hasErrors}
        data-testid="save-btn"
      >
        Save
      </button>
    </FormProvider>
  );
}

/** Harness that mounts ONLY Body but also exposes a watched value div.
 *  Verifies that title_el in Body is wired to the shared form state.
 */
function HarnessBoth({ defaults = {} }: HarnessProps) {
  const form = useForm<NewsDrawerFormData>({
    defaultValues: {
      title_en: '',
      title_el: '',
      title_ru: '',
      description_el: '',
      title_el_a2: null,
      description_el_a2: null,
      ...defaults,
    },
  });

  // Expose live form values so tests can verify RHF state updates.
  const titleEl = form.watch('title_el');

  return (
    <FormProvider {...form}>
      <div data-testid="form-title-el-value">{titleEl}</div>
      <NewsEditDrawerBody item={{} as NewsItemResponse} />
    </FormProvider>
  );
}

// ── Tests: structure ───────────────────────────────────────────────────────────

describe('NewsEditDrawerBody — structure', () => {
  it('renders the wrapper with correct data-testid', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-tab-body-content')).toBeInTheDocument();
  });

  it('renders the Greek body textarea (10 rows)', () => {
    render(<Harness />);
    const textarea = screen.getByTestId('news-drawer-body-description-el');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('rows', '10');
  });

  it('renders the Title B2 textarea', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-body-title-el')).toBeInTheDocument();
  });

  it('renders the Scenario A2 textarea', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-body-description-el-a2')).toBeInTheDocument();
  });

  it('all 3 Greek textareas have lang="el"', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-body-description-el')).toHaveAttribute('lang', 'el');
    expect(screen.getByTestId('news-drawer-body-title-el')).toHaveAttribute('lang', 'el');
    expect(screen.getByTestId('news-drawer-body-description-el-a2')).toHaveAttribute('lang', 'el');
  });
});

// ── Tests: hint text ──────────────────────────────────────────────────────────

describe('NewsEditDrawerBody — hint text', () => {
  it('renders the Title B2 hint with exact text', () => {
    render(<Harness />);
    expect(
      screen.getByText(
        'This title doubles as the B2 scenario summary today. A dedicated scenario field is on the roadmap.'
      )
    ).toBeInTheDocument();
  });
});

// ── Tests: shared FormProvider sync ──────────────────────────────────────────

describe('NewsEditDrawerBody — shared FormProvider sync with Translations tab', () => {
  it('title_el typed in Body tab updates the shared RHF form state', async () => {
    const user = userEvent.setup();
    render(<HarnessBoth defaults={{ title_el: '' }} />);

    const bodyTitleEl = screen.getByTestId('news-drawer-body-title-el');

    await user.type(bodyTitleEl, 'Κείμενο');

    // The form-title-el-value display reads from form.watch('title_el'),
    // which reflects the same key used by the Translations tab.
    // This proves Body's title_el textarea is wired to the shared form state.
    await waitFor(() => {
      expect(screen.getByTestId('form-title-el-value')).toHaveTextContent('Κείμενο');
    });
  });
});

// ── Tests: A2 pair validation ─────────────────────────────────────────────────

describe('NewsEditDrawerBody — A2 pair validation', () => {
  it('no inline error when both A2 fields are empty (both null)', () => {
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);
    expect(screen.queryByTestId('news-drawer-body-a2-error')).not.toBeInTheDocument();
  });

  it('no inline error when both A2 fields are populated', async () => {
    render(
      <Harness
        defaults={{
          title_el_a2: 'Σενάριο Α2',
          description_el_a2: 'Κείμενο Α2',
        }}
      />
    );
    await waitFor(() => {
      expect(screen.queryByTestId('news-drawer-body-a2-error')).not.toBeInTheDocument();
    });
  });

  it('shows inline error when title_el_a2 is set but description_el_a2 is empty', async () => {
    // title_el_a2 has no dedicated testid so we pre-fill it via defaults and leave
    // description_el_a2 empty — the validation effect fires on mount.
    render(<Harness defaults={{ title_el_a2: 'Σενάριο', description_el_a2: null }} />);

    await waitFor(() => {
      expect(screen.getByTestId('news-drawer-body-a2-error')).toBeInTheDocument();
    });

    // The error message key is returned as-is by i18n mock
    expect(screen.getByTestId('news-drawer-body-a2-error')).toHaveTextContent(
      'news.validation.a2FieldsPaired'
    );
  });

  it('shows inline error when description_el_a2 is set but title_el_a2 is empty', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);

    const scenarioA2 = screen.getByTestId('news-drawer-body-description-el-a2');
    await user.type(scenarioA2, 'Κείμενο');

    await waitFor(() => {
      expect(screen.getByTestId('news-drawer-body-a2-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('news-drawer-body-a2-error')).toHaveTextContent(
      'news.validation.a2FieldsPaired'
    );
  });

  it('error clears when description_el_a2 field is cleared back to empty', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);

    const scenarioA2 = screen.getByTestId('news-drawer-body-description-el-a2');
    await user.type(scenarioA2, 'Κείμενο');

    await waitFor(() => {
      expect(screen.getByTestId('news-drawer-body-a2-error')).toBeInTheDocument();
    });

    await user.clear(scenarioA2);

    await waitFor(() => {
      expect(screen.queryByTestId('news-drawer-body-a2-error')).not.toBeInTheDocument();
    });
  });
});

// ── Tests: Save button gating ─────────────────────────────────────────────────

describe('NewsEditDrawerBody — Save button gating', () => {
  it('Save button is enabled when A2 pair is valid (both empty)', async () => {
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);
    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).not.toBeDisabled();
    });
  });

  it('Save button becomes disabled when A2 pair is invalid', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);

    const scenarioA2 = screen.getByTestId('news-drawer-body-description-el-a2');
    await user.type(scenarioA2, 'Κείμενο');

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).toBeDisabled();
    });
  });

  it('Save button re-enables when A2 pair error is resolved', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el_a2: null, description_el_a2: null }} />);

    const scenarioA2 = screen.getByTestId('news-drawer-body-description-el-a2');
    await user.type(scenarioA2, 'Κείμενο');

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).toBeDisabled();
    });

    await user.clear(scenarioA2);

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).not.toBeDisabled();
    });
  });
});

// ── Todos ──────────────────────────────────────────────────────────────────────

it.todo(
  'end-to-end save payload uses scenario_*/text_* mapping — covered by NEWS-06 drawer-level test'
);
