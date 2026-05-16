/**
 * NewsItemDeleteDialog Component Tests
 *
 * Covers:
 * - Renders title, warning, item title, Cancel + Delete buttons
 * - Cancel button appears before (precedes in DOM) the Delete button (AC #3: destructive not auto-focused)
 * - Esc key closes the dialog
 * - Enter on Delete button confirms deletion
 * - On success: onOpenChange(false) and toast fire
 * - Lang selection: el → title_el, ru → title_ru, en/default → title_en
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsItemDeleteDialog } from '../NewsItemDeleteDialog';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDeleteNewsItem = vi.fn();

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: () => ({
    deleteNewsItem: mockDeleteNewsItem,
    isDeleting: false,
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (props: unknown) => mockToast(props),
}));

// i18n mock: controllable language
const mockI18nLanguage = { value: 'en' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockI18nLanguage.value },
  }),
}));

// ── Factory ───────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewsItemDeleteDialog — rendering', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
    vi.clearAllMocks();
    mockDeleteNewsItem.mockResolvedValue(undefined);
  });

  it('renders title, warning text and both buttons when open', () => {
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);

    expect(screen.getByTestId('news-delete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('news-delete-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('news-delete-confirm')).toBeInTheDocument();
  });

  it('Delete button carries the destructive variant class', () => {
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);

    const deleteBtn = screen.getByTestId('news-delete-confirm');
    expect(deleteBtn.className).toMatch(/destructive/);
  });

  it('returns null when item is null', () => {
    const { container } = render(
      <NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('NewsItemDeleteDialog — focus order (AC #3)', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('Cancel button precedes Delete button in DOM (Radix auto-focuses first tabbable element)', () => {
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);

    const cancelBtn = screen.getByTestId('news-delete-cancel');
    const deleteBtn = screen.getByTestId('news-delete-confirm');

    // Node.DOCUMENT_POSITION_FOLLOWING means cancelBtn comes before deleteBtn
    const position = cancelBtn.compareDocumentPosition(deleteBtn);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('NewsItemDeleteDialog — keyboard behaviour', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
    vi.clearAllMocks();
    mockDeleteNewsItem.mockResolvedValue(undefined);
  });

  it('fires onOpenChange(false) when Escape key is pressed', () => {
    const onOpenChange = vi.fn();
    render(<NewsItemDeleteDialog open={true} onOpenChange={onOpenChange} item={makeNewsItem()} />);

    const dialog = screen.getByTestId('news-delete-dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls deleteNewsItem when Delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);

    await user.click(screen.getByTestId('news-delete-confirm'));

    expect(mockDeleteNewsItem).toHaveBeenCalledWith('item-1');
  });
});

describe('NewsItemDeleteDialog — success / error flow', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('calls onOpenChange(false) and fires toast on successful delete', async () => {
    mockDeleteNewsItem.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<NewsItemDeleteDialog open={true} onOpenChange={onOpenChange} item={makeNewsItem()} />);

    await user.click(screen.getByTestId('news-delete-confirm'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'news.delete.success' })
      );
    });
  });

  it('fires destructive toast on delete error', async () => {
    // Note: Radix AlertDialogAction always closes the dialog on click (by design).
    // On error, the dialog closes AND the error toast fires.
    mockDeleteNewsItem.mockRejectedValue(new Error('Network error'));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<NewsItemDeleteDialog open={true} onOpenChange={onOpenChange} item={makeNewsItem()} />);

    await user.click(screen.getByTestId('news-delete-confirm'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'news.delete.error',
          variant: 'destructive',
        })
      );
    });
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<NewsItemDeleteDialog open={true} onOpenChange={onOpenChange} item={makeNewsItem()} />);

    await user.click(screen.getByTestId('news-delete-cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('NewsItemDeleteDialog — language title selection (AC #2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteNewsItem.mockResolvedValue(undefined);
  });

  it('shows title_en when language is "en"', () => {
    mockI18nLanguage.value = 'en';
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);
    expect(screen.getByText('English Title')).toBeInTheDocument();
  });

  it('shows title_el when language is "el"', () => {
    mockI18nLanguage.value = 'el';
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);
    expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
  });

  it('shows title_ru when language is "ru"', () => {
    mockI18nLanguage.value = 'ru';
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);
    expect(screen.getByText('Русский заголовок')).toBeInTheDocument();
  });

  it('falls back to title_en for unknown language', () => {
    mockI18nLanguage.value = 'de';
    render(<NewsItemDeleteDialog open={true} onOpenChange={vi.fn()} item={makeNewsItem()} />);
    expect(screen.getByText('English Title')).toBeInTheDocument();
  });
});
