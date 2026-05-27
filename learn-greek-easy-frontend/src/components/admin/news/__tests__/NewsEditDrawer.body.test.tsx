// src/components/admin/news/__tests__/NewsEditDrawer.body.test.tsx
//
// NEWS-07b / NADM-20: NewsEditDrawerBody — unit tests.

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from '../NewsEditDrawer';
import { NewsEditDrawerBody } from '../NewsEditDrawer.body';

// ── Module mocks ───────────────────────────────────────────────────────────────

// i18n mock: returns the key as-is, except for keys where the exact English
// text is needed to assert on rendered content.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'news.drawer.body.greekBodyHelper') {
        return 'Full article — shown to B2 learners; lower levels read a simplified scenario';
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

/** Harness that mounts Body and exposes a watched value div.
 *  Verifies that title_el in Body (Scenario B2 field) is wired to shared form state.
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

  it('renders the Scenario B2 textarea (5 rows)', () => {
    render(<Harness />);
    const textarea = screen.getByTestId('news-drawer-body-scenario-el');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('rows', '5');
  });

  it('renders the Title A2 textarea (2 rows)', () => {
    render(<Harness />);
    const textarea = screen.getByTestId('news-drawer-body-title-el-a2');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('rows', '2');
  });

  it('renders the Scenario A2 textarea', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-body-description-el-a2')).toBeInTheDocument();
  });

  it('all Greek textareas have lang="el"', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-body-description-el')).toHaveAttribute('lang', 'el');
    expect(screen.getByTestId('news-drawer-body-scenario-el')).toHaveAttribute('lang', 'el');
    expect(screen.getByTestId('news-drawer-body-title-el-a2')).toHaveAttribute('lang', 'el');
    expect(screen.getByTestId('news-drawer-body-description-el-a2')).toHaveAttribute('lang', 'el');
  });

  it('Scenario B2 label renders via i18n key', () => {
    render(<Harness />);
    // The i18n mock returns the key as-is — assert the label text matches the key
    expect(screen.getByText('news.drawer.body.scenarioB2')).toBeInTheDocument();
  });

  it('Title A2 label renders via i18n key', () => {
    render(<Harness />);
    expect(screen.getByText('news.drawer.body.titleA2')).toBeInTheDocument();
  });
});

// ── Tests: helper text ────────────────────────────────────────────────────────

describe('NewsEditDrawerBody — helper text', () => {
  it('renders the Greek body helper text with exact English string', () => {
    render(<Harness />);
    expect(
      screen.getByText(
        'Full article — shown to B2 learners; lower levels read a simplified scenario'
      )
    ).toBeInTheDocument();
  });
});

// ── Tests: shared FormProvider sync ──────────────────────────────────────────

describe('NewsEditDrawerBody — shared FormProvider sync with Translations tab', () => {
  it('Scenario B2 field (title_el) typed in Body tab updates the shared RHF form state', async () => {
    const user = userEvent.setup();
    render(<HarnessBoth defaults={{ title_el: '' }} />);

    const scenarioB2 = screen.getByTestId('news-drawer-body-scenario-el');

    await user.type(scenarioB2, 'Κείμενο');

    // form-title-el-value reads from form.watch('title_el') — same field used by Translations tab.
    // This proves the Scenario B2 textarea is wired to the shared title_el form state.
    await waitFor(() => {
      expect(screen.getByTestId('form-title-el-value')).toHaveTextContent('Κείμενο');
    });
  });
});

// ── Tests: Title A2 editability ───────────────────────────────────────────────

describe('NewsEditDrawerBody — Title A2 input', () => {
  it('Title A2 textarea is editable', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el_a2: null }} />);

    const titleA2 = screen.getByTestId('news-drawer-body-title-el-a2');
    await user.type(titleA2, 'Απλός τίτλος');

    expect(titleA2).toHaveValue('Απλός τίτλος');
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
    // Pre-fill title_el_a2 via defaults, leave description_el_a2 empty —
    // the validation effect fires on mount.
    render(<Harness defaults={{ title_el_a2: 'Σενάριο', description_el_a2: null }} />);

    await waitFor(() => {
      expect(screen.getByTestId('news-drawer-body-a2-error')).toBeInTheDocument();
    });

    // The error message key is returned as-is by the i18n mock
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
