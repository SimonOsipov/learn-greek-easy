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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationListItem } from '@/types/situation';

// ── Mock i18n ──────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ── Mock store ─────────────────────────────────────────────────────────────
const mockOpenDrawer = vi.fn();

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = { openDrawer: mockOpenDrawer };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
}));

import { SituationCard, pickSitTone } from '../SituationCard';

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
    ...overrides,
  };
}

describe('SituationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: renders all fields ────────────────────────────────────────────
  it('renders scenario_el, scenario_en, status badge, and all 8 completion pill labels', () => {
    render(<SituationCard item={makeItem()} onRequestDelete={vi.fn()} />);

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
    const { container } = render(
      <SituationCard item={makeItem({ id })} onRequestDelete={vi.fn()} />
    );
    const thumb = container.querySelector(`.sit-thumb-${expectedTone}`);
    expect(thumb).toBeInTheDocument();
  });

  // ── Test 3: keyboard activation ───────────────────────────────────────────
  it('calls openDrawer on Enter keydown', () => {
    render(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOpenDrawer).toHaveBeenCalledWith('sit-1');
  });

  it('calls openDrawer on Space keydown', () => {
    render(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockOpenDrawer).toHaveBeenCalledWith('sit-1');
  });

  // ── Test 4: click activation ──────────────────────────────────────────────
  it('calls openDrawer on card click', async () => {
    const user = userEvent.setup();
    render(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    await user.click(card);
    expect(mockOpenDrawer).toHaveBeenCalledWith('sit-1');
  });

  // ── Test 5: delete stopPropagation ────────────────────────────────────────
  it('Delete button calls onRequestDelete and does NOT call openDrawer', async () => {
    const user = userEvent.setup();
    const onRequestDelete = vi.fn();
    render(
      <SituationCard
        item={makeItem({ id: 'sit-1', scenario_el: 'Στο εστιατόριο' })}
        onRequestDelete={onRequestDelete}
      />
    );
    const deleteBtn = screen.getByRole('button', { name: 'situations.actions.delete' });
    await user.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledWith({ id: 'sit-1', scenario_el: 'Στο εστιατόριο' });
    expect(mockOpenDrawer).not.toHaveBeenCalled();
  });

  // ── Test 6: edit propagation ──────────────────────────────────────────────
  it('Edit button calls openDrawer(item.id)', async () => {
    const user = userEvent.setup();
    render(<SituationCard item={makeItem({ id: 'sit-1' })} onRequestDelete={vi.fn()} />);
    const editBtn = screen.getByRole('button', { name: 'situations.actions.edit' });
    await user.click(editBtn);
    expect(mockOpenDrawer).toHaveBeenCalledWith('sit-1');
  });

  // ── Test 7: completion strip — none done ──────────────────────────────────
  it('all pills have is-todo class when all booleans false and all counts 0', () => {
    const { container } = render(<SituationCard item={makeItem()} onRequestDelete={vi.fn()} />);
    const pills = container.querySelectorAll('.dk-pill');
    expect(pills.length).toBe(8);
    pills.forEach((pill) => {
      expect(pill).toHaveClass('is-todo');
      expect(pill).not.toHaveClass('is-done');
    });
  });

  // ── Test 8: completion strip — partial ────────────────────────────────────
  it('has_dialog=true + dialog_exercises_count=3 → first and sixth pill are is-done', () => {
    const { container } = render(
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
    const { container } = render(
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
    render(<SituationCard item={makeItem()} onRequestDelete={vi.fn()} />);
    const card = screen.getByTestId('sit-card-sit-1');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabindex', '0');
  });
});
