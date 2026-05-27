// src/components/admin/news/__tests__/NewsEditDrawer.translations.test.tsx
//
// NEWS-07a: NewsEditDrawerTranslations — unit tests.

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from '../NewsEditDrawer';
import { NewsEditDrawerTranslations } from '../NewsEditDrawer.translations';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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

  return (
    <FormProvider {...form}>
      <NewsEditDrawerTranslations item={{} as NewsItemResponse} />
      <div data-testid="dirty">{String(form.formState.isDirty)}</div>
    </FormProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NewsEditDrawerTranslations — structure', () => {
  it('renders the wrapper with correct data-testid', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-tab-translations-content')).toBeInTheDocument();
  });

  it('renders three textarea fields', () => {
    render(<Harness />);
    expect(screen.getByTestId('news-drawer-translations-title-en')).toBeInTheDocument();
    expect(screen.getByTestId('news-drawer-translations-title-el')).toBeInTheDocument();
    expect(screen.getByTestId('news-drawer-translations-title-ru')).toBeInTheDocument();
  });

  it('renders labels for each field using i18n keys', () => {
    render(<Harness />);
    expect(screen.getByText('news.drawer.translations.titleEn')).toBeInTheDocument();
    expect(screen.getByText('news.drawer.translations.titleEl')).toBeInTheDocument();
    expect(screen.getByText('news.drawer.translations.titleRu')).toBeInTheDocument();
  });

  it('every input is reachable via getByLabelText (a11y contract)', () => {
    render(<Harness />);
    expect(screen.getByLabelText('news.drawer.translations.titleEn')).toBeInTheDocument();
    expect(screen.getByLabelText('news.drawer.translations.titleEl')).toBeInTheDocument();
    expect(screen.getByLabelText('news.drawer.translations.titleRu')).toBeInTheDocument();
  });

  it('renders hint paragraphs for each field using i18n keys', () => {
    render(<Harness />);
    expect(screen.getByText('news.drawer.translations.hintEn')).toBeInTheDocument();
    expect(screen.getByText('news.drawer.translations.hintEl')).toBeInTheDocument();
    expect(screen.getByText('news.drawer.translations.hintRu')).toBeInTheDocument();
  });

  it('Greek textarea has lang="el"', () => {
    render(<Harness />);
    const elTextarea = screen.getByTestId('news-drawer-translations-title-el');
    expect(elTextarea).toHaveAttribute('lang', 'el');
  });

  it('Greek textarea has className containing "serif"', () => {
    render(<Harness />);
    const elTextarea = screen.getByTestId('news-drawer-translations-title-el');
    expect(elTextarea.className).toContain('serif');
  });
});

describe('NewsEditDrawerTranslations — initial values', () => {
  it('pre-fills title_en from form defaults', () => {
    render(<Harness defaults={{ title_en: 'EN default' }} />);
    expect(screen.getByTestId('news-drawer-translations-title-en')).toHaveValue('EN default');
  });

  it('pre-fills title_el from form defaults', () => {
    render(<Harness defaults={{ title_el: 'EL default' }} />);
    expect(screen.getByTestId('news-drawer-translations-title-el')).toHaveValue('EL default');
  });

  it('pre-fills title_ru from form defaults', () => {
    render(<Harness defaults={{ title_ru: 'RU default' }} />);
    expect(screen.getByTestId('news-drawer-translations-title-ru')).toHaveValue('RU default');
  });
});

describe('NewsEditDrawerTranslations — dirty state', () => {
  it('formState.isDirty becomes true after typing into title_en', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_en: 'original' }} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');

    const textarea = screen.getByTestId('news-drawer-translations-title-en');
    await user.clear(textarea);
    await user.type(textarea, 'changed');

    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  });

  it('formState.isDirty becomes true after typing into title_el', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_el: 'original' }} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');

    const textarea = screen.getByTestId('news-drawer-translations-title-el');
    await user.clear(textarea);
    await user.type(textarea, 'changed');

    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  });

  it('formState.isDirty becomes true after typing into title_ru', async () => {
    const user = userEvent.setup();
    render(<Harness defaults={{ title_ru: 'original' }} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');

    const textarea = screen.getByTestId('news-drawer-translations-title-ru');
    await user.clear(textarea);
    await user.type(textarea, 'changed');

    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  });
});
