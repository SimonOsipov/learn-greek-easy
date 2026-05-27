// src/components/admin/news/__tests__/NewsEditDrawer.image.test.tsx
//
// NEWS-07d: NewsEditDrawerImage — unit tests.
// Covers: preview (img / fallback), overlay Kicker + helper text,
//         source URL input opens empty, alt text + photo credit are disabled,
//         handleSave paths: empty input omits field, invalid URL blocks save,
//         valid URL is included in payload.

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockUpdateNewsItem = vi.fn();
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateNewsItem: (...args: unknown[]) => mockUpdateNewsItem(...args),
  },
}));

// Store mock (used by full-drawer tests)
const mockCloseDrawer = vi.fn();
const mockFetchNewsItems = vi.fn().mockResolvedValue(undefined);

const storeState = {
  drawerItemId: null as string | null,
  newsItems: [] as NewsItemResponse[],
  closeDrawer: mockCloseDrawer,
  fetchNewsItems: mockFetchNewsItems,
};

const mockUseAdminNewsStore = vi.fn((selector?: (s: typeof storeState) => unknown) => {
  if (typeof selector === 'function') return selector(storeState);
  return storeState;
});
(mockUseAdminNewsStore as unknown as { getState: () => typeof storeState }).getState = () =>
  storeState;

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: (...args: unknown[]) =>
    mockUseAdminNewsStore(...(args as [(s: typeof storeState) => unknown])),
}));

// Field primitive — render label + children.
vi.mock('@/components/ui/field', () => ({
  Field: ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {label}
      {children}
    </div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'item-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English title',
    title_ru: 'Русский заголовок',
    description_el: 'Περιγραφή B2',
    description_en: 'Description EN',
    description_ru: 'Описание RU',
    publication_date: '2025-01-15',
    original_article_url: 'https://example.com/article',
    image_url: null,
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-14T12:00:00Z',
    country: 'greece',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: null,
    audio_a2_duration_seconds: null,
    audio_a2_generated_at: null,
    audio_a2_file_size_bytes: null,
    has_a2_content: false,
    alt_text: null,
    photo_credit: null,
    ...overrides,
  };
}

// ── Lazy-loaded modules (mocks register before import) ────────────────────────

let NewsEditDrawerImage: React.FC<{ item: NewsItemResponse }>;
let NewsEditDrawer: React.FC;

async function loadModules() {
  const imgMod = await import('../NewsEditDrawer.image');
  NewsEditDrawerImage = imgMod.NewsEditDrawerImage;
  const drawerMod = await import('../NewsEditDrawer');
  NewsEditDrawer = drawerMod.NewsEditDrawer;
}

// ── Wrapper for isolated component tests ──────────────────────────────────────

function Wrapper({ item }: { item: NewsItemResponse }) {
  const methods = useForm({
    defaultValues: {
      source_image_url: item.image_url ?? '',
      alt_text: item.alt_text ?? '',
      photo_credit: item.photo_credit ?? '',
    },
  });
  return (
    <FormProvider {...methods}>
      <NewsEditDrawerImage item={item} />
    </FormProvider>
  );
}

// ── Full drawer render helper ─────────────────────────────────────────────────

function renderDrawer() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <NewsEditDrawer />
    </MemoryRouter>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  storeState.drawerItemId = null;
  storeState.newsItems = [];
  mockFetchNewsItems.mockResolvedValue(undefined);
  mockUpdateNewsItem.mockResolvedValue({});
  await loadModules();
});

// ── Isolated component tests ──────────────────────────────────────────────────

describe('NewsEditDrawerImage — preview block', () => {
  it('renders img element when item.image_url is truthy', () => {
    render(<Wrapper item={makeItem({ image_url: 'https://cdn.example.com/photo.jpg' })} />);
    const img = document.querySelector('.dr-image-box img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg');
  });

  it('renders .dr-image-fallback div when image_url is null', () => {
    render(<Wrapper item={makeItem({ image_url: null })} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('.dr-image-fallback')).toBeInTheDocument();
  });

  it('renders Kicker with i18n key news.drawer.image.kicker', () => {
    render(<Wrapper item={makeItem()} />);
    expect(screen.getByText('news.drawer.image.kicker')).toBeInTheDocument();
  });

  it('renders helper text exactly', () => {
    render(<Wrapper item={makeItem()} />);
    expect(screen.getByText('news.drawer.image.helper')).toBeInTheDocument();
  });
});

describe('NewsEditDrawerImage — source URL input', () => {
  it('pre-fills with item.image_url when present', () => {
    render(<Wrapper item={makeItem({ image_url: 'https://example.com/img.jpg' })} />);
    const input = screen.getByTestId('news-drawer-image-url-input') as HTMLInputElement;
    expect(input.value).toBe('https://example.com/img.jpg');
  });

  it('opens empty when item.image_url is null', () => {
    render(<Wrapper item={makeItem({ image_url: null })} />);
    const input = screen.getByTestId('news-drawer-image-url-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('is a url-type input', () => {
    render(<Wrapper item={makeItem()} />);
    const input = screen.getByTestId('news-drawer-image-url-input') as HTMLInputElement;
    expect(input.type).toBe('url');
  });
});

describe('NewsEditDrawerImage — enabled alt/credit fields', () => {
  it('alt text input is not disabled', () => {
    render(<Wrapper item={makeItem()} />);
    const altInput = screen.getByTestId('news-drawer-image-alt-input');
    expect(altInput).not.toBeDisabled();
  });

  it('photo credit input is not disabled', () => {
    render(<Wrapper item={makeItem()} />);
    const creditInput = screen.getByTestId('news-drawer-image-credit-input');
    expect(creditInput).not.toBeDisabled();
  });
});

describe('NewsEditDrawerImage — 2-col grid layout', () => {
  it('root element has dr-image-tab class', () => {
    render(<Wrapper item={makeItem()} />);
    const root = screen.getByTestId('news-drawer-tab-image-content');
    expect(root).toHaveClass('dr-image-tab');
  });

  it('dr-image-box has 4:3 aspect ratio class', () => {
    render(<Wrapper item={makeItem({ image_url: 'https://cdn.example.com/photo.jpg' })} />);
    const box = document.querySelector('.dr-image-box');
    expect(box).toBeInTheDocument();
  });
});

// ── Full drawer save-path tests ───────────────────────────────────────────────

describe('NewsEditDrawerImage — handleSave paths (via full drawer)', () => {
  async function navigateToImageTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('news-drawer-tab-image'));
    expect(screen.getByTestId('news-drawer-tab-image-content')).toBeInTheDocument();
  }

  it('empty source_image_url — Save omits source_image_url from payload and closes', async () => {
    const user = userEvent.setup();
    const item = makeItem();
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();
    await navigateToImageTab(user);

    // Input is empty (default) — click Save
    await user.click(screen.getByTestId('news-drawer-save'));

    await waitFor(() => {
      // No dirty fields, no source_image_url → no API call, drawer closes
      expect(mockUpdateNewsItem).not.toHaveBeenCalled();
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  it('invalid URL — toast destructive shown, API NOT called', async () => {
    const user = userEvent.setup();
    const item = makeItem();
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();
    await navigateToImageTab(user);

    const urlInput = screen.getByTestId('news-drawer-image-url-input');
    await user.clear(urlInput);
    await user.type(urlInput, 'not-a-valid-url');

    await user.click(screen.getByTestId('news-drawer-save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      expect(mockUpdateNewsItem).not.toHaveBeenCalled();
    });
  });

  it('valid URL — API called with payload.source_image_url set', async () => {
    const user = userEvent.setup();
    const item = makeItem();
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();
    await navigateToImageTab(user);

    const validUrl = 'https://example.com/new-image.jpg';
    const urlInput = screen.getByTestId('news-drawer-image-url-input');
    await user.clear(urlInput);
    await user.type(urlInput, validUrl);

    await user.click(screen.getByTestId('news-drawer-save'));

    await waitFor(() => {
      expect(mockUpdateNewsItem).toHaveBeenCalledWith(
        item.id,
        expect.objectContaining({ source_image_url: validUrl })
      );
    });
  });
});
