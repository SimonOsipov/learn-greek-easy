// src/components/admin/changelog/__tests__/ChangelogEditorDrawer.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChangelogEditorDrawer } from '../ChangelogEditorDrawer';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ChangelogEditorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────────

  it('renders the drawer when open=true', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-drawer')).toBeInTheDocument();
  });

  it('shows "New entry" title when no entry prop is provided', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByText('New entry')).toBeInTheDocument();
  });

  it('shows "Edit entry" title when an entry prop is provided', () => {
    const entry = {
      id: 'entry-1',
      title_en: 'Hello',
      title_ru: 'Привет',
      content_en: 'Content EN',
      content_ru: 'Content RU',
      tag: 'new_feature' as const,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entry} />);

    expect(screen.getByText('Edit entry')).toBeInTheDocument();
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────

  it('renders Form tab button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-form')).toBeInTheDocument();
  });

  it('renders JSON tab button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-json')).toBeInTheDocument();
  });

  it('renders EN language tab button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-en')).toBeInTheDocument();
  });

  it('renders RU language tab button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-ru')).toBeInTheDocument();
  });

  // ── Placeholder containers ────────────────────────────────────────────────

  it('renders empty body placeholder container', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-drawer-body')).toBeInTheDocument();
  });

  it('renders empty footer placeholder container', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-drawer-footer')).toBeInTheDocument();
  });

  // ── Close paths ───────────────────────────────────────────────────────────

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChangelogEditorDrawer open={true} onClose={onClose} />);

    await user.click(screen.getByTestId('changelog-editor-close-button'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChangelogEditorDrawer open={true} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
