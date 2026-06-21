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
        'news.card.statusDraft': 'Draft',
        'news.card.statusPublished': 'Published',
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
    alt_text: null,
    photo_credit: null,
    status: 'published' as const,
    linked_situation: null,
    image_variants: null,
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
    const { container } = renderWithRouter(
      <NewsCard item={makeItem()} onRequestDelete={mockOnRequestDelete} />
    );
    // Use querySelector for the actual <img> element to avoid ambiguity with
    // the status dot span which also carries role="img".
    const img = container.querySelector('img');
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

  it('renders country flag for greece in meta row', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'greece' })} onRequestDelete={mockOnRequestDelete} />
    );
    // F4: flag now lives in .news-meta via .news-meta-flag, not on the thumbnail
    const flag = container.querySelector('.news-meta-flag');
    expect(flag?.textContent).toBe('🇬🇷');
    // .news-thumb-flag must be absent
    expect(container.querySelector('.news-thumb-flag')).not.toBeInTheDocument();
  });

  it('renders country flag for cyprus in meta row', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'cyprus' })} onRequestDelete={mockOnRequestDelete} />
    );
    const flag = container.querySelector('.news-meta-flag');
    expect(flag?.textContent).toBe('🇨🇾');
    expect(container.querySelector('.news-thumb-flag')).not.toBeInTheDocument();
  });

  it('renders country flag for world in meta row', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'world' })} onRequestDelete={mockOnRequestDelete} />
    );
    const flag = container.querySelector('.news-meta-flag');
    expect(flag?.textContent).toBe('🌍');
    expect(container.querySelector('.news-thumb-flag')).not.toBeInTheDocument();
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

  it('renders B1 badge when description_el is non-empty', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'Some text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(screen.getByText('B1')).toBeInTheDocument();
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

  it('renders both B1 and A2 badges when both are present', () => {
    renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'B1', description_el_a2: 'A2' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  // ADMIN2-39-05 F7: durations are now rendered per level, never summed.
  // (Superseded the old "combined duration 3:00" assertion — see the
  // "F7 — per-level audio durations" describe block below for full coverage.)
  it('renders per-level audio chips when audio is present (not the sum)', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ audio_duration_seconds: 120, audio_a2_duration_seconds: 60 })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    // B1 120s = "2:00", A2 60s = "1:00" — two separate indicators.
    expect(screen.getByText(/2:00/)).toBeInTheDocument();
    expect(screen.getByText(/1:00/)).toBeInTheDocument();
    // The sum (180s = "3:00") must NOT be rendered.
    expect(container.textContent).not.toContain('3:00');
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

  it('NADM-16: flag is now in .news-meta (not .news-thumb) — F4 move', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ country: 'greece' })} onRequestDelete={mockOnRequestDelete} />
    );
    // F4: flag moved out of the thumbnail block and into .news-meta
    const meta = container.querySelector('.news-meta');
    const flag = meta?.querySelector('.news-meta-flag');
    expect(flag).toBeInTheDocument();
    expect(flag?.textContent).toBe('🇬🇷');
    // Confirm .news-thumb-flag is absent from the entire card
    expect(container.querySelector('.news-thumb-flag')).not.toBeInTheDocument();
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

  it('NADM-16: B1 pill uses .news-level class (not <Badge>)', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'Some text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const levelPill = container.querySelector('.news-level');
    expect(levelPill).toBeInTheDocument();
    expect(levelPill?.textContent).toBe('B1');
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

  it('NADM-16: both B1 and A2 pills use .news-level class when both present', () => {
    const { container } = renderWithRouter(
      <NewsCard
        item={makeItem({ description_el: 'B1 text', description_el_a2: 'A2 text' })}
        onRequestDelete={mockOnRequestDelete}
      />
    );
    const levelPills = container.querySelectorAll('.news-level');
    expect(levelPills).toHaveLength(2);
    const texts = Array.from(levelPills).map((el) => el.textContent);
    expect(texts).toContain('B1');
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

  // ── F5: publish-status dot ─────────────────────────────────────────────────
  it('F5: status dot renders with bg-success and aria-label "Published" when status=published', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ status: 'published' })} onRequestDelete={mockOnRequestDelete} />
    );
    const dot = container.querySelector('.news-status-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-success');
    expect(dot).not.toHaveClass('bg-warning');
    expect(dot).toHaveAttribute('aria-label', 'Published');
    expect(dot).toHaveAttribute('role', 'img');
  });

  it('F5: status dot renders with bg-warning and aria-label "Draft" when status=draft', () => {
    const { container } = renderWithRouter(
      <NewsCard item={makeItem({ status: 'draft' })} onRequestDelete={mockOnRequestDelete} />
    );
    const dot = container.querySelector('.news-status-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-warning');
    expect(dot).not.toHaveClass('bg-success');
    expect(dot).toHaveAttribute('aria-label', 'Draft');
    expect(dot).toHaveAttribute('role', 'img');
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

  // ── ADMIN2-39-05 F7: two separate per-level audio durations (no summing) ──
  // The current implementation renders ONE `.news-audio` span showing the SUM
  // (B1 + A2). The target renders TWO separate indicators (one per level),
  // each suppressed when its track is absent OR has a 0-second duration.
  describe('F7 — per-level audio durations (no summing, suppress 0-second)', () => {
    it('renders B1 and A2 durations separately', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 90, audio_a2_duration_seconds: 45 })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      // Two separate indicators — B1 90s = "1:30", A2 45s = "0:45".
      expect(screen.getByText(/1:30/)).toBeInTheDocument();
      expect(screen.getByText(/0:45/)).toBeInTheDocument();
      // The SUM (135s = "2:15") must NOT be rendered anywhere.
      expect(container.textContent).not.toContain('2:15');
      // Two audio indicators present (one per level), not a single summed span.
      expect(container.querySelectorAll('.news-audio')).toHaveLength(2);
    });

    it('omits a missing track', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 90, audio_a2_duration_seconds: null })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      // B1 present (90s = "1:30"); A2 absent → exactly one indicator.
      expect(screen.getByText(/1:30/)).toBeInTheDocument();
      expect(container.querySelectorAll('.news-audio')).toHaveLength(1);
    });

    it('suppresses a 0-second track (boundary)', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 90, audio_a2_duration_seconds: 0 })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      // B1 present (90s = "1:30"); A2 is 0s → suppressed, never rendered as "0:00".
      expect(screen.getByText(/1:30/)).toBeInTheDocument();
      expect(container.textContent).not.toContain('0:00');
      expect(container.querySelectorAll('.news-audio')).toHaveLength(1);
    });

    it('no audio row when both tracks are null', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: null, audio_a2_duration_seconds: null })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      expect(container.querySelector('.news-audio')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('0:00');
    });

    it('no audio row when both tracks are 0 seconds', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 0, audio_a2_duration_seconds: 0 })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      expect(container.querySelector('.news-audio')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('0:00');
    });

    it('no audio row when B1 is 0 seconds and A2 is null (0/null boundary)', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 0, audio_a2_duration_seconds: null })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      expect(container.querySelector('.news-audio')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('0:00');
    });

    // ── ADMIN2-39-05 QA edge coverage (Mode B) ──────────────────────────────
    // The RED specs assert the .news-audio COUNT + the duration strings, but not
    // that the single rendered indicator carries the CORRECT level label. These
    // prove per-level labeling: a B1-only item labels its one indicator "B1"
    // (never "A2"), and an A2-only item labels its one indicator "A2".

    it('B1-only item (90/null) renders ONE B1-labeled indicator "1:30" and no A2', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 90, audio_a2_duration_seconds: null })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      const audios = container.querySelectorAll('.news-audio');
      expect(audios).toHaveLength(1);
      const text = audios[0].textContent ?? '';
      // The single indicator is the B1 track: "B1 1:30", never labeled "A2".
      expect(text).toContain('B1');
      expect(text).toContain('1:30');
      expect(text).not.toContain('A2');
    });

    it('A2-only item (null/45) renders ONE A2-labeled indicator "0:45" and no B1', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: null, audio_a2_duration_seconds: 45 })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      const audios = container.querySelectorAll('.news-audio');
      expect(audios).toHaveLength(1);
      const text = audios[0].textContent ?? '';
      // The single indicator is the A2 track: "A2 0:45", never labeled "B1".
      expect(text).toContain('A2');
      expect(text).toContain('0:45');
      expect(text).not.toContain('B1');
    });

    it('both present: B1 indicator carries 1:30 and A2 indicator carries 0:45 (no cross-labeling)', () => {
      const { container } = renderWithRouter(
        <NewsCard
          item={makeItem({ audio_duration_seconds: 90, audio_a2_duration_seconds: 45 })}
          onRequestDelete={mockOnRequestDelete}
        />
      );
      const audios = Array.from(container.querySelectorAll('.news-audio'));
      expect(audios).toHaveLength(2);
      const b1 = audios.find((el) => (el.textContent ?? '').includes('B1'));
      const a2 = audios.find((el) => (el.textContent ?? '').includes('A2'));
      // Each level's duration lives on its own labeled indicator, not swapped.
      expect(b1?.textContent).toContain('1:30');
      expect(b1?.textContent).not.toContain('0:45');
      expect(a2?.textContent).toContain('0:45');
      expect(a2?.textContent).not.toContain('1:30');
    });
  });
});
