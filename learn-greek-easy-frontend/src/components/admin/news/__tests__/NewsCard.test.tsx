/**
 * NewsCard Component Tests
 *
 * Covers NEWS-04 + NEWS-10-fix + NADM-16 acceptance criteria:
 * - Renders thumb (image or gradient fallback via pickNewsThumb), flag, date, title,
 *   level chips (.news-level), audio chip, publication date, hover-revealed Edit + Delete buttons.
 * - Card is keyboard-focusable; Enter and Space write `?edit=<id>` to URL
 *   (NewsTab's URL→store effect opens the drawer reactively).
 * - Delete IconButton stopPropagation — does not also write `?edit=`.
 * - NADM-16: horizontal grid layout, 96×72 thumb, overlay anchoring, .news-level pills,
 *   focus-within reveals actions.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

// ── Mock newsThumbs (NADM-04) ──────────────────────────────────────────
vi.mock('../newsThumbs', () => ({
  pickNewsThumb: (id: string) => `linear-gradient(stub-${id})`,
}));

// ── Mock i18n ──────────────────────────────────────────────────────────
const mockLanguage = { value: 'en' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'news.card.editLabel': 'Edit',
        'news.card.deleteLabel': 'Delete',
      };
      return map[key] ?? key;
    },
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

  // ── NADM-16: horizontal layout + visual token changes ─────────────────

  it('NADM-16: news-card element is present (horizontal grid class applied via CSS)', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />
    );
    const card = container.querySelector('.news-card');
    expect(card).toBeInTheDocument();
  });

  it('NADM-16: thumb has .news-thumb class and is a child of .news-card', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />
    );
    const card = container.querySelector('.news-card');
    const thumb = card?.querySelector('.news-thumb');
    expect(thumb).toBeInTheDocument();
  });

  it('NADM-16: flag overlay has .news-thumb-flag class inside .news-thumb (top-left anchor)', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'greece' })} onRequestDelete={mockOnRequestDelete} />
    );
    const thumb = container.querySelector('.news-thumb');
    const flag = thumb?.querySelector('.news-thumb-flag');
    expect(flag).toBeInTheDocument();
    expect(flag?.textContent).toBe('🇬🇷');
  });

  it('NADM-16: date overlay has .news-thumb-date class inside .news-thumb (bottom-left anchor)', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ publication_date: '2025-03-15' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const thumb = container.querySelector('.news-thumb');
    const dateEl = thumb?.querySelector('.news-thumb-date');
    expect(dateEl).toBeInTheDocument();
    expect(dateEl?.textContent).toBe('15 Mar 2025');
  });

  it('NADM-16: B2 pill uses .news-level class (not <Badge>)', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'Some text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const levelPill = container.querySelector('.news-level');
    expect(levelPill).toBeInTheDocument();
    expect(levelPill?.textContent).toBe('B2');
    // Verify it is a <span> (not shadcn Badge <div>)
    expect(levelPill?.tagName.toLowerCase()).toBe('span');
  });

  it('NADM-16: A2 pill uses .news-level class', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ description_el_a2: 'A2 text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const levelPills = container.querySelectorAll('.news-level');
    const texts = Array.from(levelPills).map((el) => el.textContent);
    expect(texts).toContain('A2');
  });

  it('NADM-16: both B2 and A2 pills use .news-level class when both present', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'B2 text', description_el_a2: 'A2 text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const levelPills = container.querySelectorAll('.news-level');
    expect(levelPills).toHaveLength(2);
    const texts = Array.from(levelPills).map((el) => el.textContent);
    expect(texts).toContain('B2');
    expect(texts).toContain('A2');
  });

  it('NADM-16: actions column has .news-actions class inside .news-card', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />
    );
    const card = container.querySelector('.news-card');
    expect(card).toBeInTheDocument();
    const actions = container.querySelector('.news-actions');
    expect(actions).toBeInTheDocument();
    // Verify actions is inside the card
    expect(card?.contains(actions)).toBe(true);
  });

  it('NADM-16: pickNewsThumb used as fallback background when image_url is null', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ image_url: null, id: 'test-id' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const fallback = container.querySelector('.news-thumb-fallback') as HTMLElement | null;
    expect(fallback).toBeInTheDocument();
    // The mock returns `linear-gradient(stub-test-id)` for id='test-id'
    expect(fallback?.style.background).toContain('linear-gradient');
  });

  it('NADM-16: focus-within on action button reveals actions (opacity behaviour is CSS; actions are in DOM)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />);
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    // Tab focus into the action button — DOM element must be focusable
    await user.tab();
    // Actions container stays in the DOM regardless (CSS controls opacity)
    expect(editBtn.closest('.news-actions')).toBeInTheDocument();
    // The article must have tabIndex=0 for :focus-within to fire in browser
    const article = editBtn.closest('article');
    expect(article).toHaveAttribute('tabindex', '0');
  });
});
