/**
 * NewsItemEditModal Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsItemEditModal } from '../NewsItemEditModal';

// Mock adminAPI
vi.mock('@/services/adminAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/adminAPI')>();
  return {
    ...actual,
    adminAPI: {
      ...actual.adminAPI,
    },
  };
});

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'news.edit.title': 'Edit News Item',
        'news.edit.hint': 'Edit the JSON fields and save.',
        'news.edit.save': 'Save',
        'news.edit.saving': 'Saving...',
        'news.edit.cancel': 'Cancel',
        'news.edit.success': 'News item updated',
        'news.edit.error': 'Failed to update',
        'news.edit.validationError': 'Validation error',
        'news.edit.imageUrlPlaceholder': '(optional) https://...',
        'news.create.imageDownloadFailed': 'Failed to download image',
        'news.validation.invalidJson': 'Invalid JSON',
        'news.validation.invalidArticleUrl': 'Invalid article URL',
        'news.validation.invalidImageUrl': 'Invalid image URL',
        'news.validation.invalidDate': 'Invalid date format',
        'news.validation.noFieldsToUpdate': 'No fields to update',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock useLanguage
const mockCurrentLanguage = { value: 'en' };
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: mockCurrentLanguage.value }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (props: unknown) => mockToast(props),
}));

// Mock adminNewsStore
const mockUpdateNewsItem = vi.fn();
vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: () => ({
    updateNewsItem: mockUpdateNewsItem,
    isUpdating: false,
  }),
}));

// Factory for a complete NewsItemResponse
function makeNewsItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'item-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English Title',
    title_ru: 'Русский заголовок',
    description_el: 'Ελληνική περιγραφή',
    description_en: 'English description',
    description_ru: 'Русское описание',
    publication_date: '2025-03-15',
    original_article_url: 'https://example.com/article',
    image_url: null,
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
    country: 'cyprus',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: null,
    audio_a2_duration_seconds: null,
    audio_a2_generated_at: null,
    audio_a2_file_size_bytes: null,
    has_a2_content: false,
    ...overrides,
  };
}

describe('NewsItemEditModal — Core rendering', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('renders modal with JSON textarea', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('news-edit-json-input')).toBeInTheDocument();
  });

  it('pre-fills JSON textarea with item data using scenario_en field name', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"scenario_en": "English Title"');
  });

  it('renders save and cancel buttons', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('news-edit-save')).toBeInTheDocument();
    expect(screen.getByTestId('news-edit-cancel')).toBeInTheDocument();
  });

  it('returns null when item is null', () => {
    const { container } = render(
      <NewsItemEditModal open={true} onOpenChange={vi.fn()} item={null} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows localized title in modal description for English locale', () => {
    mockCurrentLanguage.value = 'en';
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText('English Title')).toBeInTheDocument();
  });

  it('shows localized title in modal description for Greek locale', () => {
    mockCurrentLanguage.value = 'el';
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
  });

  it('shows localized title in modal description for Russian locale', () => {
    mockCurrentLanguage.value = 'ru';
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText('Русский заголовок')).toBeInTheDocument();
  });
});

describe('NewsItemEditModal — Country field in JSON', () => {
  it('JSON textarea includes country field pre-filled', async () => {
    const item = makeNewsItem({ country: 'greece' });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);
    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"country": "greece"');
  });

  it('JSON textarea includes country as first field', async () => {
    const item = makeNewsItem({ country: 'world' });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);
    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value);
    const keys = Object.keys(parsed);
    expect(keys[0]).toBe('country');
  });
});
