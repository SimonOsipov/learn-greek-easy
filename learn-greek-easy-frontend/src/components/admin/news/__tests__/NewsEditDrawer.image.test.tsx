// src/components/admin/news/__tests__/NewsEditDrawer.image.test.tsx
//
// NEWS-07d (updated ADMIN2-41 F3): NewsEditDrawerImage — display-only unit tests.
// The image tab now renders only the preview block (img / fallback + overlay Kicker).
// All editable fields (source URL, alt text, photo credit) and the helper paragraph
// were removed in ADMIN2-41 F3.  This file asserts:
//   - the 3 field inputs and the helper/alt-hint are GONE,
//   - the image preview still renders correctly.

import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

// ── Module mocks ───────────────────────────────────────────────────────────────

// I18NG-04: mock dropped — real i18n instance from test-setup resolves all admin keys.

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'item-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English title',
    title_ru: 'Русский заголовок',
    description_el: 'Περιγραφή B1',
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
    status: 'published' as const,
    linked_situation: null,
    image_variants: null,
    ...overrides,
  };
}

// ── Lazy-loaded modules (mocks register before import) ────────────────────────

let NewsEditDrawerImage: React.FC<{ item: NewsItemResponse }>;

async function loadModules() {
  const imgMod = await import('../NewsEditDrawer.image');
  NewsEditDrawerImage = imgMod.NewsEditDrawerImage;
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
    render(
      <NewsEditDrawerImage item={makeItem({ image_url: 'https://cdn.example.com/photo.jpg' })} />
    );
    const img = document.querySelector('.dr-image-box img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg');
  });

  it('renders .dr-image-fallback div when image_url is null', () => {
    render(<NewsEditDrawerImage item={makeItem({ image_url: null })} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('.dr-image-fallback')).toBeInTheDocument();
  });

  it('renders Kicker with i18n key news.drawer.image.kicker', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    // Resolves to "Source image"
    expect(screen.getByText('Source image')).toBeInTheDocument();
  });
});

describe('NewsEditDrawerImage — layout', () => {
  it('root element has dr-image-tab class (2-col grid)', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    const root = screen.getByTestId('news-drawer-tab-image-content');
    expect(root.classList.contains('dr-image-tab')).toBe(true);
  });
});

describe('NewsEditDrawerImage — F3 removal: fields gone', () => {
  it('source URL input is NOT rendered (F3 removal)', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    expect(screen.queryByTestId('news-drawer-image-url-input')).not.toBeInTheDocument();
  });

  it('alt text input is NOT rendered (F3 removal)', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    expect(screen.queryByTestId('news-drawer-image-alt-input')).not.toBeInTheDocument();
  });

  it('photo credit input is NOT rendered (F3 removal)', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    expect(screen.queryByTestId('news-drawer-image-credit-input')).not.toBeInTheDocument();
  });

  it('helper text paragraph is NOT rendered (F3 removal)', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    expect(
      screen.queryByText(
        'Enter a URL to replace the current image. The original source URL is not stored after upload.'
      )
    ).not.toBeInTheDocument();
  });

  it('alt-hint paragraph is NOT rendered (F3 removal)', () => {
    // Previously shown when image_url is set but alt_text is empty
    render(
      <NewsEditDrawerImage
        item={makeItem({ image_url: 'https://cdn.example.com/photo.jpg', alt_text: null })}
      />
    );
    expect(screen.queryByTestId('news-drawer-image-alt-hint')).not.toBeInTheDocument();
  });
});

describe('NewsEditDrawerImage — 2-col grid layout', () => {
  it('root element has dr-image-tab class', () => {
    render(<NewsEditDrawerImage item={makeItem()} />);
    const root = screen.getByTestId('news-drawer-tab-image-content');
    expect(root).toHaveClass('dr-image-tab');
  });

  it('dr-image-box is present', () => {
    render(
      <NewsEditDrawerImage item={makeItem({ image_url: 'https://cdn.example.com/photo.jpg' })} />
    );
    const box = document.querySelector('.dr-image-box');
    expect(box).toBeInTheDocument();
  });
});

describe('NewsEditDrawerImage — full drawer: image tab shows preview only', () => {
  // Minimal smoke test via the full drawer — navigate to Image tab and confirm
  // no field inputs appear (the tab is display-only after F3).

  let NewsEditDrawer: React.FC;

  beforeEach(async () => {
    const drawerMod = await import('../NewsEditDrawer');
    NewsEditDrawer = drawerMod.NewsEditDrawer;
  });

  function renderDrawer() {
    return render(
      <MemoryRouter initialEntries={['/admin']}>
        <NewsEditDrawer />
      </MemoryRouter>
    );
  }

  it('image tab renders no editable inputs after F3', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const item = makeItem({ image_url: 'https://cdn.example.com/photo.jpg' });
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();
    await user.click(screen.getByTestId('news-drawer-tab-image'));
    expect(screen.getByTestId('news-drawer-tab-image-content')).toBeInTheDocument();

    // All 3 field inputs removed
    expect(screen.queryByTestId('news-drawer-image-url-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('news-drawer-image-alt-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('news-drawer-image-credit-input')).not.toBeInTheDocument();

    // Preview still visible
    expect(document.querySelector('.dr-image-box img')).toBeInTheDocument();
  });
});
