/**
 * NewsCard Component Tests
 *
 * Covers NEWS-04 + NEWS-10-fix acceptance criteria:
 * - Renders thumb (image or gradient fallback), flag, date, title, level chips, audio chip,
 *   publication date, hover-revealed Edit + Delete IconButtons.
 * - Card is keyboard-focusable; Enter and Space write `?edit=<id>` to URL
 *   (NewsTab's URL→store effect opens the drawer reactively).
 * - Delete IconButton stopPropagation — does not also write `?edit=`.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

// ── Mock i18n ──────────────────────────────────────────────────────────
const mockLanguage = { value: 'en' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockLanguage.value },
  }),
}));

import { NewsCard } from '../NewsCard';

// Sentinel that surfaces the current `edit` URL param so tests can assert.
function EditParamSentinel() {
  const [params] = useSearchParams();
  return <div data-testid="edit-param">{params.get('edit') ?? ''}</div>;
}

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/admin?tab=news']}>
      {ui}
      <EditParamSentinel />
    </MemoryRouter>
  );
}

// ── Factory ────────────────────────────────────────────────────────────
function makeItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'news-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English Title',
    title_ru: 'Русский заголовок',
    description_el: 'Ελληνική περιγραφή',
    description_en: 'English description',
    description_ru: 'Русское описание',
    publication_date: '2025-03-15',
    original_article_url: 'https://example.com',
    image_url: 'https://example.com/img.jpg',
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: 120,
    audio_file_size_bytes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    country: 'greece',
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

describe('NewsCard', () => {
  const mockOnRequestDelete = vi.fn();

  beforeEach(() => {
    mockLanguage.value = 'en';
    vi.clearAllMocks();
  });

  it('renders image thumb when image_url is provided', () => {
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('renders gradient fallback div when image_url is null', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ image_url: null })} onRequestDelete={mockOnRequestDelete} />
    );
    const fallback = container.querySelector('.news-thumb-fallback');
    expect(fallback).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders country flag for greece', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'greece' })} onRequestDelete={mockOnRequestDelete} />
    );
    const flag = container.querySelector('.news-thumb-flag');
    expect(flag?.textContent).toBe('🇬🇷');
  });

  it('renders country flag for cyprus', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'cyprus' })} onRequestDelete={mockOnRequestDelete} />
    );
    const flag = container.querySelector('.news-thumb-flag');
    expect(flag?.textContent).toBe('🇨🇾');
  });

  it('renders country flag for world', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'world' })} onRequestDelete={mockOnRequestDelete} />
    );
    const flag = container.querySelector('.news-thumb-flag');
    expect(flag?.textContent).toBe('🌍');
  });

  it('renders date overlay in dd MMM yyyy format', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ publication_date: '2025-03-15' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const dateEl = container.querySelector('.news-thumb-date');
    expect(dateEl?.textContent).toBe('15 Mar 2025');
  });

  it('renders English title when i18n language is en', () => {
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    expect(screen.getByText('English Title')).toBeInTheDocument();
  });

  it('renders Greek title when i18n language is el', () => {
    mockLanguage.value = 'el';
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
  });

  it('renders Russian title when i18n language is ru', () => {
    mockLanguage.value = 'ru';
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    expect(screen.getByText('Русский заголовок')).toBeInTheDocument();
  });

  it('renders B2 badge when description_el is non-empty', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'Some text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(screen.getByText('B2')).toBeInTheDocument();
  });

  it('renders A2 badge when description_el_a2 is non-empty', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ description_el_a2: 'A2 text', audio_a2_duration_seconds: 60 })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  it('renders both B2 and A2 badges when both are present', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'B2', description_el_a2: 'A2' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(screen.getByText('B2')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  it('renders audio chip with combined duration when audio is present', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ audio_duration_seconds: 120, audio_a2_duration_seconds: 60 })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    // 180 seconds = 3:00
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('omits audio chip when both audio durations are null', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ audio_duration_seconds: null, audio_a2_duration_seconds: null })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(container.querySelector('.news-audio')).not.toBeInTheDocument();
  });

  it('renders Edit and Delete icon buttons', () => {
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('writes ?edit=<id> on card click', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NewsCard item={makeItem({ id: 'news-1' })} onRequestDelete={mockOnRequestDelete} />
    );
    expect(screen.getByTestId('edit-param').textContent).toBe('');
    const card = screen.getByRole('button', { name: /Edit/ }).closest('article')!;
    await user.click(card);
    expect(screen.getByTestId('edit-param').textContent).toBe('news-1');
  });

  it('writes ?edit=<id> on Enter key', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NewsCard item={makeItem({ id: 'news-1' })} onRequestDelete={mockOnRequestDelete} />
    );
    const article = screen.getByRole('button', { name: /Edit/ }).closest('article')!;
    article.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('edit-param').textContent).toBe('news-1');
  });

  it('writes ?edit=<id> on Space key', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NewsCard item={makeItem({ id: 'news-1' })} onRequestDelete={mockOnRequestDelete} />
    );
    const article = screen.getByRole('button', { name: /Edit/ }).closest('article')!;
    article.focus();
    await user.keyboard(' ');
    expect(screen.getByTestId('edit-param').textContent).toBe('news-1');
  });

  it('Delete button calls onRequestDelete and does NOT write ?edit=', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NewsCard item={makeItem({ id: 'news-1' })} onRequestDelete={mockOnRequestDelete} />
    );
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteBtn);
    expect(mockOnRequestDelete).toHaveBeenCalledWith('news-1');
    expect(screen.getByTestId('edit-param').textContent).toBe('');
  });

  it('Edit button writes ?edit=<id>', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <NewsCard item={makeItem({ id: 'news-1' })} onRequestDelete={mockOnRequestDelete} />
    );
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await user.click(editBtn);
    expect(screen.getByTestId('edit-param').textContent).toBe('news-1');
  });
});
