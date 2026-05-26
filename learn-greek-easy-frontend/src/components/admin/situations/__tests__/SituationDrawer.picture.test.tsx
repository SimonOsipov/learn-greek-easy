// src/components/admin/situations/__tests__/SituationDrawer.picture.test.tsx
//
// SIT-07c: SituationDrawerPicture unit tests.
// Covers: two-column layout with both wrapped panels, onCompleted wiring,
// empty state when picture is null.

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { PictureNested, SituationDetailResponse } from '@/types/situation';

// ── i18n mock ─────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'situations.detail.pictureEmpty') return 'No picture generated yet';
      return key;
    },
  }),
}));

// ── Store mock ────────────────────────────────────────────────────────────────

const mockFetchSituationDetail = vi.fn();

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: (
    selector: (s: { fetchSituationDetail: typeof mockFetchSituationDetail }) => unknown
  ) => selector({ fetchSituationDetail: mockFetchSituationDetail }),
}));

// ── Child component mocks ─────────────────────────────────────────────────────

let capturedOnCompleted: (() => void) | undefined;

vi.mock('../PictureGenerationPanel', () => ({
  PictureGenerationPanel: (props: {
    situationId: string;
    picture: PictureNested;
    onCompleted: () => void;
  }) => {
    capturedOnCompleted = props.onCompleted;
    return (
      <div data-testid="mock-picture-generation-panel" data-situation-id={props.situationId} />
    );
  },
}));

vi.mock('../SituationPicturePromptForm', () => ({
  PicturePromptForm: (props: { situationId: string; picture: PictureNested }) => (
    <div data-testid="mock-picture-prompt-form" data-situation-id={props.situationId} />
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const basePicture: PictureNested = {
  id: 'pic-1',
  image_prompt: 'A marketplace',
  status: 'ready',
  created_at: '2025-01-01T00:00:00Z',
  scene_en: 'A busy marketplace',
  scene_el: null,
  scene_ru: null,
  style_en: null,
  image_url: 'https://example.com/pic.jpg',
};

function makeSituation(overrides: Partial<SituationDetailResponse> = {}): SituationDetailResponse {
  return {
    id: 'sit-1',
    scenario_el: 'Γεια σου',
    scenario_en: 'Hello',
    scenario_ru: 'Привет',
    status: 'draft',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    description: null,
    picture: basePicture,
    dialog: null,
    ...overrides,
  };
}

// ── Import after mocks ────────────────────────────────────────────────────────

import { SituationDrawerPicture } from '../SituationDrawer.picture';

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnCompleted = undefined;
});

describe('SituationDrawerPicture — renders both panels when picture is set', () => {
  it('renders PictureGenerationPanel with correct situationId', () => {
    render(<SituationDrawerPicture situation={makeSituation()} />);
    const panel = screen.getByTestId('mock-picture-generation-panel');
    expect(panel).toBeInTheDocument();
    expect(panel.getAttribute('data-situation-id')).toBe('sit-1');
  });

  it('renders PicturePromptForm with correct situationId', () => {
    render(<SituationDrawerPicture situation={makeSituation()} />);
    const form = screen.getByTestId('mock-picture-prompt-form');
    expect(form).toBeInTheDocument();
    expect(form.getAttribute('data-situation-id')).toBe('sit-1');
  });

  it('renders both children inside the situation-drawer-picture wrapper', () => {
    render(<SituationDrawerPicture situation={makeSituation()} />);
    const wrapper = screen.getByTestId('situation-drawer-picture');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.querySelector('[data-testid="mock-picture-generation-panel"]')).not.toBeNull();
    expect(wrapper.querySelector('[data-testid="mock-picture-prompt-form"]')).not.toBeNull();
  });
});

describe('SituationDrawerPicture — onCompleted callback', () => {
  it('calling onCompleted triggers fetchSituationDetail with the situation id', () => {
    render(<SituationDrawerPicture situation={makeSituation()} />);
    expect(capturedOnCompleted).toBeDefined();
    capturedOnCompleted?.();
    expect(mockFetchSituationDetail).toHaveBeenCalledTimes(1);
    expect(mockFetchSituationDetail).toHaveBeenCalledWith('sit-1');
  });
});

describe('SituationDrawerPicture — empty state when picture is null', () => {
  it('renders situation-picture-empty testid when picture is null', () => {
    render(<SituationDrawerPicture situation={makeSituation({ picture: null })} />);
    expect(screen.getByTestId('situation-picture-empty')).toBeInTheDocument();
  });

  it('renders empty state text when picture is null', () => {
    render(<SituationDrawerPicture situation={makeSituation({ picture: null })} />);
    expect(screen.getByText('No picture generated yet')).toBeInTheDocument();
  });

  it('does not render PictureGenerationPanel when picture is null', () => {
    render(<SituationDrawerPicture situation={makeSituation({ picture: null })} />);
    expect(screen.queryByTestId('mock-picture-generation-panel')).toBeNull();
  });

  it('does not render PicturePromptForm when picture is null', () => {
    render(<SituationDrawerPicture situation={makeSituation({ picture: null })} />);
    expect(screen.queryByTestId('mock-picture-prompt-form')).toBeNull();
  });
});

// ── SAR2-26-12b: gradient fallback when picture exists but image_url is null ──

describe('SituationDrawerPicture — gradient fallback (SAR2-26-12b)', () => {
  it('renders gradient div when picture exists but image_url is null', () => {
    const pictureWithoutImage = { ...basePicture, image_url: null };
    render(<SituationDrawerPicture situation={makeSituation({ picture: pictureWithoutImage })} />);
    const gradient = screen.getByTestId('situation-picture-gradient');
    expect(gradient).toBeInTheDocument();
  });

  it('gradient div has sit-thumb class', () => {
    const pictureWithoutImage = { ...basePicture, image_url: null };
    render(<SituationDrawerPicture situation={makeSituation({ picture: pictureWithoutImage })} />);
    const gradient = screen.getByTestId('situation-picture-gradient');
    expect(gradient.className).toContain('sit-thumb');
  });

  it('gradient div has tone-specific class derived from situation id', () => {
    const pictureWithoutImage = { ...basePicture, image_url: null };
    render(<SituationDrawerPicture situation={makeSituation({ picture: pictureWithoutImage })} />);
    const gradient = screen.getByTestId('situation-picture-gradient');
    // Should have one of the sit-thumb-{tone} classes
    const hasToneClass = /sit-thumb-(blue|amber|violet|cyan|green|red)/.test(gradient.className);
    expect(hasToneClass).toBe(true);
  });

  it('does not render gradient when picture has image_url', () => {
    // basePicture already has image_url set
    render(<SituationDrawerPicture situation={makeSituation()} />);
    expect(screen.queryByTestId('situation-picture-gradient')).toBeNull();
  });
});
