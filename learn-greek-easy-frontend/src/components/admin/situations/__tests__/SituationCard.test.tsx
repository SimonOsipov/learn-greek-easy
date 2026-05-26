/**
 * SituationCard Component Tests
 *
 * Covers SIT-04 acceptance criteria:
 * - Renders thumb (deterministic gradient by id hash), status badge,
 *   EN/EL titles, 8 completion pills, hover-revealed Edit + Delete icon buttons.
 * - Deterministic tone selection: same id → same tone, all 6 tones covered.
 * - Card is keyboard-focusable; Enter and Space call store's openDrawer(id).
 * - Delete .icon-btn stopPropagation — does NOT call openDrawer.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationListItem } from '@/types/situation';

// ── Mock i18n ──────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { SituationCard, pickSitTone } from '../SituationCard';

// Sentinel that surfaces the current `edit` URL param so tests can assert.
function EditParamSentinel() {
  const [params] = useSearchParams();
  return <div data-testid="edit-param">{params.get('edit') ?? ''}</div>;
}

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/admin?tab=situations']}>
      {ui}
      <EditParamSentinel />
    </MemoryRouter>
  );
}

// ── Factory ────────────────────────────────────────────────────────────────
function makeItem(overrides: Partial<SituationListItem> = {}): SituationListItem {
  return {
    id: 'sit-1',
    scenario_el: 'Στο εστιατόριο',
    scenario_en: 'At the restaurant',
    scenario_ru: 'В ресторане',
    status: 'draft',
    created_at: '2025-01-01T00:00:00Z',
    has_dialog: false,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
    description_timestamps_count: 0,
    dialog_exercises_count: 0,
    description_exercises_count: 0,
    picture_exercises_count: 0,
    levels: [],
    dialog_lines_count: 0,
    roles: [],
    picture_image_url: null,
    audio_duration_seconds: null,
    source_title_en: null,
    source_country: null,
    ...overrides,
  };
}

describe('SituationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: URL writes are asserted via the EditParamSentinel rendered by renderWithRouter.

  // ── Test 1: renders all fields ────────────────────────────────────────────
  it('renders scenario_el, scenario_en, status badge, and all 8 completion pill labels', () => {
    renderWithRouter(<SituationCard item={makeItem()} onRequestDelete={vi.fn()} />);

    // Titles
    expect(screen.getByText('Στο εστιατόριο')).toBeInTheDocument();
    expect(screen.getByText('At the restaurant')).toBeInTheDocument();

    // Status badge (via t() mock, returns the key)
    expect(screen.getByText('situations.status.draft')).toBeInTheDocument();

    // All 8 completion pill labels (returned as keys by t() mock)
    expect(screen.getByText('situations.completion.dialog')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.dialogAudio')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.description')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.descAudio')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.picture')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.dialogEx')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.descEx')).toBeInTheDocument();
    expect(screen.getByText('situations.completion.picEx')).toBeInTheDocument();
  });

  // ── Test 2: deterministic tone ────────────────────────────────────────────
  it('assigns deterministic tone: same id → same class; all 6 tones are reachable', () => {
    // Hand-pick ids that span all 6 modulo slots (0..5)
    // sum of charCodes for each id must cover mod 6 = 0,1,2,3,4,5
    // We verify via pickSitTone directly (exported)
    const tones = new Set<string>();

    // Brute-force 20 short ids to collect all 6 tones
    for (let i = 0; i < 100; i++) {
      tones.add(pickSitTone(`id-${i}`));
    }
    expect(tones.size).toBe(6);

    // Determinism: same id yields same tone across two calls
    const id = 'test-stability-id';
    expect(pickSitTone(id)).toBe(pickSitTone(id));
  });

  it('applies the correct sit-thumb-{tone} class to the thumb element', () => {
    const id = 'my-situation-123';
    const expectedTone = pickSitTone(id);
    const { container } = renderWithRouter(
      <SituationCard item={makeItem({ id })} onRequestDelete={vi.fn()} />
    );
    const thumb = container.querySelector(`.sit-thumb-${expectedTone}`);
    expect(thumb).toBeInTheDocument();
  });

  // ── Test 3: keyboard activation ───────────────────────────────────────────
  it('calls openDrawer on Enter keydown', () => {
    renderWithRouter(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByTestId('edit-param').textContent).toBe('sit-1');
  });

  it('calls openDrawer on Space keydown', () => {
    renderWithRouter(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    fireEvent.keyDown(card, { key: ' ' });
    expect(screen.getByTestId('edit-param').textContent).toBe('sit-1');
  });

  // ── Test 4: click activation ──────────────────────────────────────────────
  it('calls openDrawer on card click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    await user.click(card);
    expect(screen.getByTestId('edit-param').textContent).toBe('sit-1');
  });

  // ── Test 5: delete stopPropagation ────────────────────────────────────────
  it('Delete button calls onRequestDelete and does NOT call openDrawer', async () => {
    const user = userEvent.setup();
    const onRequestDelete = vi.fn();
    renderWithRouter(
      <SituationCard
        item={makeItem({ id: 'sit-1', scenario_el: 'Στο εστιατόριο' })}
        onRequestDelete={onRequestDelete}
      />
    );
    const deleteBtn = screen.getByRole('button', { name: 'situations.actions.delete' });
    await user.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledWith({ id: 'sit-1', scenario_el: 'Στο εστιατόριο' });
    expect(screen.getByTestId('edit-param').textContent).toBe('');
  });

  // ── Test 6: edit propagation ──────────────────────────────────────────────
  it('Edit button calls openDrawer(item.id)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const editBtn = screen.getByRole('button', { name: 'situations.actions.edit' });
    await user.click(editBtn);
    expect(screen.getByTestId('edit-param').textContent).toBe('sit-1');
  });

  // ── Test 7: completion strip — none done ──────────────────────────────────
  it('all pills have is-todo class when all booleans false and all counts 0', () => {
    const { container } = renderWithRouter(
      <SituationCard item={makeItem()} onRequestDelete={vi.fn()} />
    );
    const pills = container.querySelectorAll('.dk-pill');
    expect(pills.length).toBe(8);
    pills.forEach((pill) => {
      expect(pill).toHaveClass('is-todo');
      expect(pill).not.toHaveClass('is-done');
    });
  });

  // ── Test 8: completion strip — partial ────────────────────────────────────
  it('has_dialog=true + dialog_exercises_count=3 → first and sixth pill are is-done', () => {
    const { container } = renderWithRouter(
      <SituationCard
        item={makeItem({ has_dialog: true, dialog_exercises_count: 3 })}
        onRequestDelete={vi.fn()}
      />
    );
    const pills = container.querySelectorAll('.dk-pill');
    expect(pills[0]).toHaveClass('is-done'); // dialog boolean
    expect(pills[1]).toHaveClass('is-todo'); // dialogAudio
    expect(pills[2]).toHaveClass('is-todo'); // description
    expect(pills[3]).toHaveClass('is-todo'); // descAudio
    expect(pills[4]).toHaveClass('is-todo'); // picture
    expect(pills[5]).toHaveClass('is-done'); // dialogEx with count=3
    expect(pills[5].textContent).toContain('3');
    expect(pills[6]).toHaveClass('is-todo'); // descEx
    expect(pills[7]).toHaveClass('is-todo'); // picEx
  });

  // ── Test 9: completion strip — all done ───────────────────────────────────
  it('all pills are is-done when all booleans true and all counts > 0', () => {
    const { container } = renderWithRouter(
      <SituationCard
        item={makeItem({
          has_dialog: true,
          has_dialog_audio: true,
          has_description: true,
          has_description_audio: true,
          has_picture: true,
          dialog_exercises_count: 5,
          description_exercises_count: 3,
          picture_exercises_count: 2,
        })}
        onRequestDelete={vi.fn()}
      />
    );
    const pills = container.querySelectorAll('.dk-pill');
    expect(pills.length).toBe(8);
    pills.forEach((pill) => {
      expect(pill).toHaveClass('is-done');
      expect(pill).not.toHaveClass('is-todo');
    });
    // Count pills show their values
    expect(pills[5].textContent).toContain('5');
    expect(pills[6].textContent).toContain('3');
    expect(pills[7].textContent).toContain('2');
  });

  // ── Test 10: tabIndex + role ──────────────────────────────────────────────
  it('has role="button" and tabIndex=0', () => {
    renderWithRouter(<SituationCard item={makeItem()} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  // ── Test 11: real picture thumbnail ──────────────────────────────────────
  it('renders <img> with sit-thumb-img class when picture_image_url is set', () => {
    const { container } = renderWithRouter(
      <SituationCard
        item={makeItem({ picture_image_url: 'https://example.com/img.jpg' })}
        onRequestDelete={vi.fn()}
      />
    );
    const img = container.querySelector('img.sit-thumb-img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/img.jpg');
    // No gradient div when picture is present
    const gradientDiv = container.querySelector(
      '.sit-thumb-blue,.sit-thumb-amber,.sit-thumb-violet,.sit-thumb-cyan,.sit-thumb-green,.sit-thumb-red'
    );
    expect(gradientDiv).not.toBeInTheDocument();
  });

  it('renders gradient fallback when picture_image_url is null', () => {
    const id = 'my-situation-456';
    const expectedTone = pickSitTone(id);
    const { container } = renderWithRouter(
      <SituationCard item={makeItem({ id, picture_image_url: null })} onRequestDelete={vi.fn()} />
    );
    const thumb = container.querySelector(`.sit-thumb-${expectedTone}`);
    expect(thumb).toBeInTheDocument();
    const img = container.querySelector('img.sit-thumb-img');
    expect(img).not.toBeInTheDocument();
  });

  // ── Test 12: thumbnail overlays — roles ───────────────────────────────────
  it('renders role chips for each item in roles[]', () => {
    renderWithRouter(
      <SituationCard item={makeItem({ roles: ['Vet', 'Farmer'] })} onRequestDelete={vi.fn()} />
    );
    expect(screen.getByText('Vet')).toBeInTheDocument();
    expect(screen.getByText('Farmer')).toBeInTheDocument();
    expect(document.querySelectorAll('.sit-role-chip')).toHaveLength(2);
  });

  it('renders no role chips when roles is empty', () => {
    renderWithRouter(<SituationCard item={makeItem({ roles: [] })} onRequestDelete={vi.fn()} />);
    expect(document.querySelectorAll('.sit-role-chip')).toHaveLength(0);
  });

  // ── Test 13: thumbnail overlays — audio pill ─────────────────────────────
  it('renders audio pill when audio_duration_seconds is set', () => {
    const { container } = renderWithRouter(
      <SituationCard
        item={makeItem({ audio_duration_seconds: 125, dialog_lines_count: 8 })}
        onRequestDelete={vi.fn()}
      />
    );
    const pills = container.querySelectorAll('.sit-thumb-pill');
    // First pill: lines count; second: duration
    expect(pills).toHaveLength(2);
    expect(pills[1].textContent).toContain('2:05');
  });

  it('omits audio pill when audio_duration_seconds is null', () => {
    const { container } = renderWithRouter(
      <SituationCard item={makeItem({ audio_duration_seconds: null })} onRequestDelete={vi.fn()} />
    );
    const pills = container.querySelectorAll('.sit-thumb-pill');
    expect(pills).toHaveLength(1); // only lines pill
  });

  // ── Test 14: level badges ─────────────────────────────────────────────────
  it('renders one violet badge per item in levels[]', () => {
    const { container } = renderWithRouter(
      <SituationCard item={makeItem({ levels: ['B1', 'A2'] })} onRequestDelete={vi.fn()} />
    );
    const levelBadges = container.querySelectorAll('.sit-levels .badge');
    expect(levelBadges).toHaveLength(2);
    expect(levelBadges[0].textContent).toBe('B1');
    expect(levelBadges[1].textContent).toBe('A2');
  });

  it('renders no level badges when levels is empty', () => {
    const { container } = renderWithRouter(
      <SituationCard item={makeItem({ levels: [] })} onRequestDelete={vi.fn()} />
    );
    expect(container.querySelectorAll('.sit-levels')).toHaveLength(0);
  });

  // ── Test 15: FROM NEWS kicker ─────────────────────────────────────────────
  it('renders FROM NEWS kicker when source_title_en is set', () => {
    renderWithRouter(
      <SituationCard
        item={makeItem({ source_title_en: 'Kathimerini article' })}
        onRequestDelete={vi.fn()}
      />
    );
    const kicker = document.querySelector('.sit-from');
    expect(kicker).toBeInTheDocument();
    expect(kicker!.textContent).toContain('Kathimerini article');
  });

  it('hides FROM NEWS kicker when source_title_en is null', () => {
    renderWithRouter(
      <SituationCard item={makeItem({ source_title_en: null })} onRequestDelete={vi.fn()} />
    );
    expect(document.querySelector('.sit-from')).not.toBeInTheDocument();
  });
});
