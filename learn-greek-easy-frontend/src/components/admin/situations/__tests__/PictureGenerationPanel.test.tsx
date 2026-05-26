/**
 * Vitest / RTL tests for PictureGenerationPanel.
 *
 * Mocks useSSE to capture onEvent/onError callbacks so tests can drive
 * SSE events directly — same pattern as GenerateNounDialog.sse.test.tsx.
 */

import React from 'react';

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PictureNested } from '@/types/situation';

// ============================================
// Mocks
// ============================================

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

const mockUploadSituationPicture = vi.fn();

vi.mock('@/services/adminAPI', () => ({
  getPictureGenerationStreamUrl: vi.fn(
    (id: string) => `/api/v1/situations/${id}/picture/generate/stream`
  ),
  adminAPI: {
    uploadSituationPicture: (...args: unknown[]) => mockUploadSituationPicture(...args),
  },
}));

// Capture SSE callbacks so tests can fire events directly
let capturedOnEvent: ((event: { type: string; data: unknown }) => void) | undefined;
let capturedOnError: ((err: Error) => void) | undefined;

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(
    (
      _url: string,
      options: { onEvent?: (e: unknown) => void; onError?: (e: unknown) => void; enabled?: boolean }
    ) => {
      if (options.enabled) {
        capturedOnEvent = options.onEvent as typeof capturedOnEvent;
        capturedOnError = options.onError as typeof capturedOnError;
      }
      return { state: 'disconnected', close: vi.fn() };
    }
  ),
}));

// ============================================
// Import component after mocks
// ============================================

import { PictureGenerationPanel } from '../PictureGenerationPanel';

// ============================================
// Test Utilities
// ============================================

const basePicture: PictureNested = {
  id: 'pic-1',
  image_prompt: 'A sunny beach',
  status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  scene_en: 'Beach scene',
  scene_el: null,
  scene_ru: null,
  style_en: null,
  image_url: null,
};

interface RenderOptions {
  imageUrl?: string | null;
  onCompleted?: ReturnType<typeof vi.fn>;
}

const renderPanel = (opts: RenderOptions = {}) => {
  const { imageUrl = null, onCompleted = vi.fn() } = opts;
  const picture: PictureNested = { ...basePicture, image_url: imageUrl };
  return {
    onCompleted,
    ...render(
      <PictureGenerationPanel situationId="sit-1" picture={picture} onCompleted={onCompleted} />
    ),
  };
};

// ============================================
// Tests
// ============================================

describe('PictureGenerationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 1: Generate button when no image
  // ──────────────────────────────────────────────────────────────────
  it('shows Generate button when image_url is null, enables SSE on click, no AlertDialog', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: null });

    const btn = screen.getByRole('button', { name: 'Generate' });
    expect(btn).toBeInTheDocument();

    await user.click(btn);

    // SSE should now be enabled (capturedOnEvent captured)
    expect(capturedOnEvent).toBeDefined();

    // No confirm dialog opened
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 2: Regenerate flow with existing image + confirm dialog
  // ──────────────────────────────────────────────────────────────────
  it('shows image and Regenerate button; Cancel keeps SSE disabled; Confirm enables SSE', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: 'https://example.com/foo.png' });

    // Image rendered with correct src and aspect-video class
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/foo.png');
    expect(img.className).toContain('aspect-video');

    // Button shows Regenerate
    const btn = screen.getByRole('button', { name: 'Regenerate' });
    expect(btn).toBeInTheDocument();

    // Click → AlertDialog opens
    await user.click(btn);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click Cancel → dialog closes, SSE still not enabled
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(capturedOnEvent).toBeUndefined();

    // Click Regenerate button again → AlertDialog opens
    await user.click(btn);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click Confirm → SSE enabled
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(capturedOnEvent).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 3: Stage progression labels
  // ──────────────────────────────────────────────────────────────────
  it('updates button label and disables it at each pipeline stage', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: null });

    await user.click(screen.getByRole('button', { name: 'Generate' }));

    // Button is disabled once SSE is enabled (picSseEnabled=true)
    expect(
      screen.getByRole('button', { name: /Starting…|Generating…|Uploading…|Saving…|Generate/i })
    ).toBeDisabled();

    act(() => {
      capturedOnEvent?.({ type: 'picture:start', data: { situation_id: 'sit-1' } });
    });
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    act(() => {
      capturedOnEvent?.({ type: 'picture:generate', data: { situation_id: 'sit-1' } });
    });
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();

    act(() => {
      capturedOnEvent?.({ type: 'picture:upload', data: { situation_id: 'sit-1' } });
    });
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled();

    act(() => {
      capturedOnEvent?.({ type: 'picture:persist', data: { situation_id: 'sit-1' } });
    });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 4: picture:complete re-enables button and calls onCompleted
  // ──────────────────────────────────────────────────────────────────
  it('re-enables button, clears stage, and calls onCompleted on picture:complete', async () => {
    const user = userEvent.setup();
    const { onCompleted } = renderPanel({ imageUrl: null });

    await user.click(screen.getByRole('button', { name: 'Generate' }));

    act(() => {
      capturedOnEvent?.({ type: 'picture:start', data: { situation_id: 'sit-1' } });
    });
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    act(() => {
      capturedOnEvent?.({
        type: 'picture:complete',
        data: {
          situation_id: 'sit-1',
          image_url: 'https://example.com/new.png',
          s3_key: 'some/key',
        },
      });
    });

    // Button re-enabled and label reset to Generate
    const btn = screen.getByRole('button', { name: 'Generate' });
    expect(btn).not.toBeDisabled();

    // onCompleted called once
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 5: picture:error shows destructive toast and re-enables button
  // ──────────────────────────────────────────────────────────────────
  it('shows destructive toast with server error message on picture:error', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: null });

    await user.click(screen.getByRole('button', { name: 'Generate' }));

    act(() => {
      capturedOnEvent?.({
        type: 'picture:error',
        data: { situation_id: 'sit-1', stage: 'generate', error: 'Model returned no image' },
      });
    });

    // Toast called with the server error message
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Model returned no image',
      variant: 'destructive',
    });

    // Button re-enabled
    expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
  });
});

// ── Upload button tests (SAR2-26-12a) ─────────────────────────────────────

describe('PictureGenerationPanel — Upload button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
  });

  it('renders an Upload button', () => {
    renderPanel({ imageUrl: null });
    expect(screen.getByTestId('picture-upload-button')).toBeInTheDocument();
  });

  it('clicking Upload button triggers the hidden file input click', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: null });

    const uploadInput = screen.getByTestId('picture-upload-input');
    const clickSpy = vi.spyOn(uploadInput, 'click');

    await user.click(screen.getByTestId('picture-upload-button'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('Upload button is disabled while SSE is in progress', async () => {
    const user = userEvent.setup();
    renderPanel({ imageUrl: null });

    // Start generation SSE
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    // Upload button should now be disabled
    expect(screen.getByTestId('picture-upload-button')).toBeDisabled();
  });
});
