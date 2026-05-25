/**
 * AdminExercisesStats unit tests (EXR-03 / EXR-19f)
 *
 * Validates that counts derived from the `items` prop are displayed correctly
 * across the four stat tiles. Bars are always hidden (AdminExerciseListItem
 * has no created_at field, so computeBars always returns []).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdminExercisesStats } from '../AdminExercisesStats';
import type { AdminExerciseListItem } from '@/types/situation';

function makeItem(overrides: Partial<AdminExerciseListItem>): AdminExerciseListItem {
  return {
    id: 'test-id',
    exercise_type: 'select_correct_answer',
    status: 'draft',
    source_type: 'description',
    modality: 'listening',
    audio_level: null,
    situation_id: 'sit-1',
    situation_title_el: 'Τίτλος',
    situation_title_en: 'Title',
    audio_url: null,
    reading_text: null,
    anchor_picture_url: null,
    anchor_description_text: null,
    item_count: 1,
    items: [],
    ...overrides,
  };
}

describe('AdminExercisesStats', () => {
  it('renders all four stat tiles with n=0 when items is empty', () => {
    render(<AdminExercisesStats items={[]} total={0} />);
    // All four tile titles should be present
    expect(screen.getByText('Total exercises')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect(screen.getByText('With audio')).toBeTruthy();
    // Total tile shows the `total` prop (0)
    // The n values render as text; 0 appears multiple times — just confirm no crash
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('does not crash with empty items', () => {
    expect(() => render(<AdminExercisesStats items={[]} total={0} />)).not.toThrow();
  });

  it('computes correct counts from a fixture of 4 items', () => {
    const items: AdminExerciseListItem[] = [
      makeItem({ id: '1', status: 'approved', audio_url: 'http://example.com/a.mp3' }),
      makeItem({ id: '2', status: 'pending', audio_url: null }),
      makeItem({ id: '3', status: 'draft', audio_url: null }),
      makeItem({ id: '4', status: 'approved', audio_url: null }),
    ];

    render(<AdminExercisesStats items={items} total={50} />);

    // Total tile shows `total` prop (50), not items.length
    expect(screen.getByText('50')).toBeTruthy();

    // Approved tile: 2 approved items
    expect(screen.getByText('2')).toBeTruthy();

    // With audio tile: 1 item has audio_url; pending also 1 — use getAllByText
    // Both pending (awaiting review) and withAudio show '1'
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('hides the bars row when items is empty (EXR-19f)', () => {
    const { container } = render(<AdminExercisesStats items={[]} total={0} />);
    // The .stat-bars div is only rendered when bars.length > 0
    const barsDivs = container.querySelectorAll('.stat-bars');
    expect(barsDivs).toHaveLength(0);
  });
});
