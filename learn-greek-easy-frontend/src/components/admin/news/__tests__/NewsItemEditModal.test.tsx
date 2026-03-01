/**
 * NewsItemEditModal Component Tests
 *
 * Covers TASK-158 acceptance criteria:
 * - AC-2: audio_generated_at timestamp uses date-fns format() with locale parameter
 * - AC-3: Russian locale shows Cyrillic month names
 * - AC-4: English locale uses readable date format (dd MMM yyyy, HH:mm)
 * - AC-5: Greek locale shows Greek month names
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsItemEditModal } from '../NewsItemEditModal';

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
        'news.audio.statusTitle': 'Audio Status',
        'news.audio.hasAudio': 'Has audio',
        'news.audio.noAudio': 'No audio',
        'news.audio.noAudioGenerated': 'No audio generated yet',
        'news.audio.regenerate': 'Regenerate',
        'news.audio.regenerating': 'Regenerating...',
        'news.audio.regenerateSuccess': 'Audio regenerated',
        'news.audio.regenerateError': 'Failed to regenerate',
        'news.audio.duration': 'Duration',
        'news.audio.fileSize': 'File size',
        'news.audio.generated': 'Generated',
        'news.audio.loadError': 'Failed to load audio',
        'news.audio.b2StatusTitle': 'B2 Audio',
        'news.audio.a2StatusTitle': 'A2 Audio',
        'news.audio.regenerateB2': 'Regenerate B2 Audio',
        'news.audio.regenerateA2': 'Regenerate A2 Audio',
        'news.audio.regeneratingB2': 'Regenerating B2...',
        'news.audio.regeneratingA2': 'Regenerating A2...',
        'news.audio.regenerateA2Success': 'A2 audio regeneration started',
        'news.audio.regenerateA2Error': 'Failed to regenerate A2 audio',
        'news.audio.noA2Content': 'No A2 content',
        'news.create.imageDownloadFailed': 'Failed to download image',
        'news.validation.invalidJson': 'Invalid JSON',
        'news.validation.invalidArticleUrl': 'Invalid article URL',
        'news.validation.invalidImageUrl': 'Invalid image URL',
        'news.validation.invalidDate': 'Invalid date format',
        'news.validation.noFieldsToUpdate': 'No fields to update',
        'news.validation.a2FieldsPaired': 'Both A2 fields required',
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
const mockRegenerateAudio = vi.fn();
const mockRegenerateA2Audio = vi.fn();
vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: () => ({
    updateNewsItem: mockUpdateNewsItem,
    isUpdating: false,
    regenerateAudio: mockRegenerateAudio,
    regenerateA2Audio: mockRegenerateA2Audio,
  }),
}));

// Mock WaveformPlayer to avoid audio complexities
vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: () => <div data-testid="waveform-player" />,
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
    card_id: null,
    deck_id: null,
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

describe('NewsItemEditModal — audio_generated_at date formatting (AC-2)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('AC-4: shows audio_generated_at in English with dd MMM yyyy, HH:mm format', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_generated_at: '2025-03-15T14:30:00Z',
    });

    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    // date-fns default (English) formats March as "Mar"
    const generatedLabel = screen.getByText(/Generated:/);
    expect(generatedLabel.textContent).toMatch(/15 Mar 2025/);
  });

  it('AC-3: shows audio_generated_at with Cyrillic month name in Russian locale', () => {
    mockCurrentLanguage.value = 'ru';
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_generated_at: '2025-03-15T14:30:00Z',
    });

    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    // date-fns ru locale uses Cyrillic — March is "мар."
    const generatedLabel = screen.getByText(/Generated:/);
    expect(generatedLabel.textContent).toMatch(/мар/i);
  });

  it('AC-5: shows audio_generated_at with Greek month name in Greek locale', () => {
    mockCurrentLanguage.value = 'el';
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_generated_at: '2025-03-15T14:30:00Z',
    });

    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    // date-fns el locale — March abbreviated is "Μαρ"
    const generatedLabel = screen.getByText(/Generated:/);
    expect(generatedLabel.textContent).toMatch(/Μαρ/i);
  });

  it('does not show Generated line when audio_generated_at is null', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_generated_at: null,
    });

    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.queryByText(/Generated:/)).not.toBeInTheDocument();
  });

  it('does not show audio metadata section when audio_url is null', () => {
    const item = makeNewsItem({ audio_url: null, audio_generated_at: null });

    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.queryByText(/Generated:/)).not.toBeInTheDocument();
    expect(screen.getByText('No audio generated yet')).toBeInTheDocument();
  });
});

describe('NewsItemEditModal — Audio status section (no regression)', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('shows audio status section', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('audio-status-section')).toBeInTheDocument();
  });

  it('shows duration when audio_url is set with duration', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_duration_seconds: 90,
    });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    // 90s = 1:30
    expect(screen.getByText(/Duration:/).textContent).toMatch(/1:30/);
  });

  it('shows file size when audio_url is set with file size', () => {
    const item = makeNewsItem({
      audio_url: 'https://example.com/audio.mp3',
      audio_file_size_bytes: 204800, // 200 KB
    });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText(/File size:/).textContent).toMatch(/200.0 KB/);
  });

  it('renders modal with JSON textarea', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('news-edit-json-input')).toBeInTheDocument();
  });

  it('pre-fills JSON textarea with item data', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"title_en": "English Title"');
  });

  it('renders save and cancel buttons', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('news-edit-save')).toBeInTheDocument();
    expect(screen.getByTestId('news-edit-cancel')).toBeInTheDocument();
  });

  it('renders waveform players (B2 and A2)', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    // Two WaveformPlayer instances: one for B2 and one for A2
    const players = screen.getAllByTestId('waveform-player');
    expect(players).toHaveLength(2);
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

describe('NewsItemEditModal -- A2 Audio Section', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('A2 section renders with modal-regenerate-a2-audio button', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('modal-regenerate-a2-audio')).toBeInTheDocument();
  });

  it('A2 regen button is disabled when has_a2_content is false', () => {
    const item = makeNewsItem({ has_a2_content: false });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const button = screen.getByTestId('modal-regenerate-a2-audio');
    expect(button).toBeDisabled();
  });

  it('A2 regen button is enabled when has_a2_content is true', () => {
    const item = makeNewsItem({
      has_a2_content: true,
      title_el_a2: 'Α2 τίτλος',
      description_el_a2: 'Α2 περιγραφή',
    });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const button = screen.getByTestId('modal-regenerate-a2-audio');
    expect(button).not.toBeDisabled();
  });

  it('B2 and A2 buttons render independently (both testids present)', () => {
    const item = makeNewsItem();
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByTestId('modal-regenerate-b2-audio')).toBeInTheDocument();
    expect(screen.getByTestId('modal-regenerate-a2-audio')).toBeInTheDocument();
  });

  it('shows no A2 content message when has_a2_content is false', () => {
    const item = makeNewsItem({ has_a2_content: false });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText('No A2 content')).toBeInTheDocument();
  });

  it('shows A2 metadata when A2 audio exists', () => {
    const item = makeNewsItem({
      has_a2_content: true,
      audio_a2_url: 'https://example.com/audio_a2.mp3',
      audio_a2_duration_seconds: 45,
    });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    expect(screen.getByText('45s')).toBeInTheDocument();
  });
});

describe('NewsItemEditModal -- A2 JSON fields', () => {
  beforeEach(() => {
    mockCurrentLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('JSON textarea includes A2 fields pre-filled from item data', () => {
    const item = makeNewsItem({
      title_el_a2: 'Α2 τίτλος',
      description_el_a2: 'Α2 περιγραφή',
    });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"title_el_a2": "Α2 τίτλος"');
    expect(textarea.value).toContain('"description_el_a2": "Α2 περιγραφή"');
  });

  it('JSON shows empty strings for null A2 fields', () => {
    const item = makeNewsItem({ title_el_a2: null, description_el_a2: null });
    render(<NewsItemEditModal open={true} onOpenChange={vi.fn()} item={item} />);

    const textarea = screen.getByTestId('news-edit-json-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"title_el_a2": ""');
    expect(textarea.value).toContain('"description_el_a2": ""');
  });
});
