// src/components/admin/changelog/__tests__/ChangelogEditorDrawer.test.tsx

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChangelogEditorDrawer } from '../ChangelogEditorDrawer';

// ── Toast mock ─────────────────────────────────────────────────────────────────
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// ── Delete Dialog mock ─────────────────────────────────────────────────────────
// We mock ChangelogDeleteDialog to isolate drawer behaviour from dialog internals.
vi.mock('../ChangelogDeleteDialog', () => ({
  ChangelogDeleteDialog: ({
    open,
    onOpenChange: _onOpenChange,
    entry,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    entry: { id: string } | null;
  }) =>
    open ? (
      <div data-testid="changelog-delete-dialog-mock">Deleting {entry?.id ?? 'null'}</div>
    ) : null,
}));

// ── Store mock ─────────────────────────────────────────────────────────────────
// Mirrors the selector-based pattern from ChangelogTab.test.tsx.
// We hold mutable state so individual tests can override lang/panelMode.

const mockSetLang = vi.fn((l: 'en' | 'ru') => {
  mockStoreState.lang = l;
});
const mockSetPanelMode = vi.fn((m: 'form' | 'json') => {
  mockStoreState.panelMode = m;
});
const mockCreateEntry = vi.fn();
const mockUpdateEntry = vi.fn();

const mockStoreState = {
  lang: 'en' as 'en' | 'ru',
  panelMode: 'form' as 'form' | 'json',
  isSaving: false,
  setLang: mockSetLang,
  setPanelMode: mockSetPanelMode,
  createEntry: mockCreateEntry,
  updateEntry: mockUpdateEntry,
};

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (state: typeof mockStoreState) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState,
  selectAdminChangelogLang: (state: typeof mockStoreState) => state.lang,
  selectAdminChangelogPanelMode: (state: typeof mockStoreState) => state.panelMode,
  selectAdminChangelogIsSaving: (state: typeof mockStoreState) => state.isSaving,
}));

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeEntry(
  overrides: Partial<{
    id: string;
    title_en: string;
    title_ru: string;
    content_en: string;
    content_ru: string;
    tag: 'new_feature' | 'bug_fix' | 'announcement';
    version: string | null;
    created_at: string;
    updated_at: string;
  }> = {}
) {
  return {
    id: 'entry-1',
    title_en: 'Hello',
    title_ru: 'Привет',
    content_en: 'Content EN',
    content_ru: 'Content RU',
    tag: 'new_feature' as const,
    version: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ChangelogEditorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state to defaults before each test
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';
    mockStoreState.isSaving = false;
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
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

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

  it('Form tab is aria-selected when panelMode=form', () => {
    mockStoreState.panelMode = 'form';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-form')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('changelog-editor-tab-json')).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('EN tab is aria-selected when lang=en', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tab-en')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('changelog-editor-tab-ru')).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking RU tab calls setLang("ru")', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('changelog-editor-tab-ru'));

    expect(mockSetLang).toHaveBeenCalledWith('ru');
  });

  it('clicking EN tab calls setLang("en")', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('changelog-editor-tab-en'));

    expect(mockSetLang).toHaveBeenCalledWith('en');
  });

  it('clicking JSON tab calls setPanelMode("json")', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('changelog-editor-tab-json'));

    expect(mockSetPanelMode).toHaveBeenCalledWith('json');
  });

  // ── Placeholder containers ────────────────────────────────────────────────

  it('renders body container', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-drawer-body')).toBeInTheDocument();
  });

  it('renders footer placeholder container', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-drawer-footer')).toBeInTheDocument();
  });

  // ── Tag picker (AC #1) ────────────────────────────────────────────────────

  it('renders exactly 3 tag buttons', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tag-new_feature')).toBeInTheDocument();
    expect(screen.getByTestId('changelog-editor-tag-bug_fix')).toBeInTheDocument();
    expect(screen.getByTestId('changelog-editor-tag-announcement')).toBeInTheDocument();
  });

  it('tag buttons have correct data-tone attributes', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tag-new_feature')).toHaveAttribute(
      'data-tone',
      'green'
    );
    expect(screen.getByTestId('changelog-editor-tag-bug_fix')).toHaveAttribute(
      'data-tone',
      'amber'
    );
    expect(screen.getByTestId('changelog-editor-tag-announcement')).toHaveAttribute(
      'data-tone',
      'blue'
    );
  });

  it('new_feature tag is active by default', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-tag-new_feature')).toHaveClass('is-active');
    expect(screen.getByTestId('changelog-editor-tag-bug_fix')).not.toHaveClass('is-active');
    expect(screen.getByTestId('changelog-editor-tag-announcement')).not.toHaveClass('is-active');
  });

  it('clicking a tag applies is-active to it and removes from others', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('changelog-editor-tag-bug_fix'));

    expect(screen.getByTestId('changelog-editor-tag-bug_fix')).toHaveClass('is-active');
    expect(screen.getByTestId('changelog-editor-tag-new_feature')).not.toHaveClass('is-active');
    expect(screen.getByTestId('changelog-editor-tag-announcement')).not.toHaveClass('is-active');
  });

  // ── Version input (AC #2) ─────────────────────────────────────────────────

  it('renders version input with placeholder', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const input = screen.getByTestId('changelog-editor-version');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'v. 0.12.0');
  });

  it('version input is bound to local state', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const input = screen.getByTestId('changelog-editor-version');
    await user.type(input, 'v0.5.0');

    expect(input).toHaveValue('v0.5.0');
  });

  // ── Title/content bind to active language (AC #3) ─────────────────────────

  it('renders title input bound to EN when lang=en', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-title-en')).toBeInTheDocument();
  });

  it('renders content textarea bound to EN when lang=en', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-content-en')).toBeInTheDocument();
  });

  it('renders title input bound to RU when lang=ru', () => {
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-title-ru')).toBeInTheDocument();
  });

  it('renders content textarea bound to RU when lang=ru', () => {
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-content-ru')).toBeInTheDocument();
  });

  // ── EN↔RU swap preserves other language text (AC #4) ─────────────────────

  it('switching lang preserves the other language text in state', async () => {
    const user = userEvent.setup();

    // Start in EN mode
    mockStoreState.lang = 'en';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Type EN title
    const enTitle = screen.getByTestId('changelog-editor-title-en');
    await user.type(enTitle, 'English Title');

    // Simulate switching to RU (store setLang was called — update mockState + rerender)
    mockStoreState.lang = 'ru';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // RU title should be empty (not overwritten by EN text)
    expect(screen.getByTestId('changelog-editor-title-ru')).toHaveValue('');

    // Switch back to EN
    mockStoreState.lang = 'en';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // EN title must still have original value
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('English Title');
  });

  // ── No Auto-translate button (CLTT-06 removed it) ─────────────────────────

  it('does NOT render the Auto-translate button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-editor-autotranslate')).not.toBeInTheDocument();
  });

  // ── No translation status pills (CLTT-06 removed them) ────────────────────

  it('does NOT render translation status pills (changelog-trans-pill-en)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-trans-pill-en')).not.toBeInTheDocument();
  });

  it('does NOT render translation status pills (changelog-trans-pill-ru)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-trans-pill-ru')).not.toBeInTheDocument();
  });

  // ── No footer badge stack (CLTT-06 removed: ready/needs-en/needs-ru) ──────

  it('does NOT render footer badge changelog-editor-badge-ready', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    expect(screen.queryByTestId('changelog-editor-badge-ready')).not.toBeInTheDocument();
  });

  it('does NOT render footer badge changelog-editor-badge-needs-en', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-editor-badge-needs-en')).not.toBeInTheDocument();
  });

  it('does NOT render footer badge changelog-editor-badge-needs-ru', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-editor-badge-needs-ru')).not.toBeInTheDocument();
  });

  // ── SidePanel size=half (CLTT-03) ─────────────────────────────────────────

  it('mounts with SidePanel size="half" — drawer element has class drawer-size-half', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    // SidePanel renders via Radix portal — query from document
    const drawerWrap = document.querySelector('.drawer-size-half');
    expect(drawerWrap).not.toBeNull();
  });

  // ── SidePanel.CloseButton position=right (CLTT-03) ────────────────────────

  it('CloseButton has class drawer-close-right', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const closeBtn = screen.getByTestId('changelog-editor-close-button');
    expect(closeBtn.classList.contains('drawer-close-right')).toBe(true);
  });

  // ── Needs-EN helper text (CLTT-06 replacement for badge) ──────────────────

  it('renders needs-en helper when EN title and content are empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('changelog-editor-needs-en')).toBeInTheDocument();
  });

  it('does NOT render needs-en helper when EN title and content are non-empty', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');

    expect(screen.queryByTestId('changelog-editor-needs-en')).not.toBeInTheDocument();
  });

  // ── Footer DOM order: Delete < Cancel < Save ──────────────────────────────

  it('footer Delete button appears before Cancel which appears before Save in DOM order', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    const deleteBtn = screen.getByTestId('changelog-editor-footer-delete');
    const cancelBtn = screen.getByTestId('changelog-editor-footer-cancel');
    const saveBtn = screen.getByTestId('changelog-editor-footer-submit');

    // Node.DOCUMENT_POSITION_FOLLOWING means the argument comes AFTER the caller
    expect(deleteBtn.compareDocumentPosition(cancelBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(cancelBtn.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  // ── Footer button classes (ADMIN2-44-05: .btn composition) ──────────────

  it('Cancel button has .btn .btn-ghost .btn-sm classes', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const cancelBtn = screen.getByTestId('changelog-editor-footer-cancel');
    expect(cancelBtn).toHaveClass('btn', 'btn-ghost', 'btn-sm');
  });

  it('Save/Publish button has .btn .btn-primary .btn-sm classes', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const submitBtn = screen.getByTestId('changelog-editor-footer-submit');
    expect(submitBtn).toHaveClass('btn', 'btn-primary', 'btn-sm');
  });

  it('Delete button (edit mode) has .btn .btn-glass .btn-sm .danger-text classes', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    const deleteBtn = screen.getByTestId('changelog-editor-footer-delete');
    expect(deleteBtn).toHaveClass('btn', 'btn-glass', 'btn-sm', 'danger-text');
  });

  it('Save/Publish button contains a Check icon (svg)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const submitBtn = screen.getByTestId('changelog-editor-footer-submit');
    expect(submitBtn.querySelector('svg')).toBeInTheDocument();
  });

  it('Delete button contains a Trash2 icon (svg)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    const deleteBtn = screen.getByTestId('changelog-editor-footer-delete');
    expect(deleteBtn.querySelector('svg')).toBeInTheDocument();
  });

  // ── Field labels — htmlFor matches input id ────────────────────────────────

  it('Version label htmlFor matches version input id', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const versionInput = screen.getByTestId('changelog-editor-version');
    const versionId = versionInput.id;
    expect(versionId).toBeTruthy();
    const versionLabel = document.querySelector(`label[for="${versionId}"]`);
    expect(versionLabel).not.toBeNull();
  });

  it('Title label htmlFor matches title input id', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const titleInput = screen.getByTestId('changelog-editor-title-en');
    const titleId = titleInput.id;
    expect(titleId).toBeTruthy();
    const titleLabel = document.querySelector(`label[for="${titleId}"]`);
    expect(titleLabel).not.toBeNull();
  });

  it('Content label htmlFor matches content textarea id', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const contentTextarea = screen.getByTestId('changelog-editor-content-en');
    const contentId = contentTextarea.id;
    expect(contentId).toBeTruthy();
    const contentLabel = document.querySelector(`label[for="${contentId}"]`);
    expect(contentLabel).not.toBeNull();
  });

  // ── Header bcrumb (ADMIN2-44-04) ─────────────────────────────────────────

  it('renders bcrumb with "Changelog · New entry" text in compose mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const bcrumb = document.querySelector('.drawer-bcrumb');
    expect(bcrumb).not.toBeNull();
    expect(bcrumb?.textContent).toContain('Changelog · New entry');
  });

  it('renders bcrumb with "Changelog · Edit entry" text in edit mode', () => {
    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ created_at: '2026-01-15T00:00:00Z' })}
      />
    );
    const bcrumb = document.querySelector('.drawer-bcrumb');
    expect(bcrumb?.textContent).toContain('Changelog · Edit entry');
  });

  it('bcrumb in edit mode contains the posted date (year)', () => {
    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ created_at: '2026-01-15T00:00:00Z' })}
      />
    );
    const bcrumb = document.querySelector('.drawer-bcrumb');
    expect(bcrumb?.textContent).toMatch(/2026/);
  });

  // ── Header meta row (ADMIN2-44-04) ───────────────────────────────────────

  it('renders drawer-meta with tag badge in BOTH compose and edit mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('changelog-drawer-meta')).toBeInTheDocument();
  });

  it('drawer-meta shows the tag label badge', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const meta = screen.getByTestId('changelog-drawer-meta');
    // Default tag is new_feature → label "New Feature"
    expect(meta.textContent).toContain('New Feature');
  });

  it('drawer-meta hides version badge when version is empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('changelog-drawer-meta-version')).not.toBeInTheDocument();
  });

  it('drawer-meta shows version badge when version is set', () => {
    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ version: '1.4.2' })}
      />
    );
    expect(screen.getByTestId('changelog-drawer-meta-version')).toHaveTextContent('1.4.2');
  });

  // ── Copy-id / copy-link buttons removed (ADMIN2-44-04) ───────────────────

  it('does NOT render copy-id button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    expect(screen.queryByTestId('changelog-editor-copy-id')).not.toBeInTheDocument();
  });

  it('does NOT render copy-link button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    expect(screen.queryByTestId('changelog-editor-copy-link')).not.toBeInTheDocument();
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

  // ── Preview pane (CLTE-05) ────────────────────────────────────────────────

  it('renders the preview pane when panelMode=form', () => {
    mockStoreState.panelMode = 'form';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-drawer-preview')).toBeInTheDocument();
  });

  it('hides the preview pane when panelMode=json', () => {
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.queryByTestId('changelog-drawer-preview')).not.toBeInTheDocument();
  });

  it('preview headline updates live as user types in title input', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const titleInput = screen.getByTestId('changelog-editor-title-en');
    await user.type(titleInput, 'My New Feature');

    expect(screen.getByTestId('changelog-preview-title')).toHaveTextContent('My New Feature');
  });

  it('switching EN→RU swaps the preview headline and body to the RU fields', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Type EN title + content
    await user.type(screen.getByTestId('changelog-editor-title-en'), 'English Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'English body');

    // Simulate switching to RU
    mockStoreState.lang = 'ru';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Type RU title + content
    await user.type(screen.getByTestId('changelog-editor-title-ru'), 'Русский заголовок');
    await user.type(screen.getByTestId('changelog-editor-content-ru'), 'Русское тело');

    // Preview should show RU content
    expect(screen.getByTestId('changelog-preview-title')).toHaveTextContent('Русский заголовок');
    expect(screen.getByTestId('changelog-preview-body')).toHaveTextContent('Русское тело');
  });

  it('switching back RU→EN shows the EN preview content', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'English Title');

    // Switch to RU
    mockStoreState.lang = 'ru';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Switch back to EN
    mockStoreState.lang = 'en';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-title')).toHaveTextContent('English Title');
  });

  it('hides version pill when form.version is empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.queryByTestId('changelog-preview-version')).not.toBeInTheDocument();
  });

  it('shows version pill when form.version is set', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-version'), '1.0');

    expect(screen.getByTestId('changelog-preview-version')).toHaveTextContent('1.0');
  });

  it('renders <b> for **bold** and <i> for *italic* in preview body', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(
      screen.getByTestId('changelog-editor-content-en'),
      'Hello **bold** and *italic*'
    );

    const body = screen.getByTestId('changelog-preview-body');
    expect(body.querySelector('b')).toBeInTheDocument();
    expect(body.querySelector('i')).toBeInTheDocument();
    expect(body.querySelector('b')).toHaveTextContent('bold');
    expect(body.querySelector('i')).toHaveTextContent('italic');
  });

  it('shows formatted date in edit mode — contains a year-shaped substring', () => {
    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
        })}
      />
    );

    // The formatDate call uses i18n.language locale — result contains the year
    const foot = screen.getByTestId('changelog-preview-foot');
    expect(foot.textContent).toMatch(/2026/);
    // The "Posted" key text is locale-dependent; just verify year is present
    expect(foot.textContent).toMatch(/\d{4}/);
  });

  it('shows "Today" in the footer in compose mode (no entry)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-foot')).toHaveTextContent('Today');
  });

  it('shows EN empty placeholder headline when title_en is blank', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-title')).toHaveTextContent('Your headline');
  });

  it('shows RU empty placeholder headline when title_ru is blank', () => {
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-title')).toHaveTextContent('Ваш заголовок');
  });

  it('shows EN body placeholder when content_en is blank', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-body')).toHaveTextContent(
      'Body text will appear here as you type.'
    );
  });

  it('shows RU body placeholder when content_ru is blank', () => {
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-preview-body')).toHaveTextContent(
      'Текст появится здесь по мере набора.'
    );
  });

  // ── CLTE-06: Publish button disabled state ────────────────────────────────

  it('Publish button is disabled when form is empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-footer-submit')).toBeDisabled();
  });

  it('Publish button is enabled when EN title and content are non-empty', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');

    expect(screen.getByTestId('changelog-editor-footer-submit')).not.toBeDisabled();
  });

  it('Publish button is disabled when only title is filled', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title only');

    expect(screen.getByTestId('changelog-editor-footer-submit')).toBeDisabled();
  });

  // ── CLTE-06: No Save draft button ─────────────────────────────────────────

  it('never renders a Save draft button', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('never renders a Save draft button in edit mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  // ── CLTE-06: Cancel button ────────────────────────────────────────────────

  it('Cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChangelogEditorDrawer open={true} onClose={onClose} />);

    await user.click(screen.getByTestId('changelog-editor-footer-cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  // ── CLTE-06: Delete button (edit mode only) ───────────────────────────────

  it('does not render Delete button in compose mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.queryByTestId('changelog-editor-footer-delete')).not.toBeInTheDocument();
  });

  it('renders Delete button in edit mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.getByTestId('changelog-editor-footer-delete')).toBeInTheDocument();
  });

  it('clicking Delete button opens ChangelogDeleteDialog', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.queryByTestId('changelog-delete-dialog-mock')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('changelog-editor-footer-delete'));

    expect(screen.getByTestId('changelog-delete-dialog-mock')).toBeInTheDocument();
  });

  // ── CLTE-06: JSON mode textarea ───────────────────────────────────────────

  it('renders JSON textarea when panelMode=json', () => {
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-json-textarea')).toBeInTheDocument();
  });

  it('does not render JSON textarea when panelMode=form', () => {
    mockStoreState.panelMode = 'form';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.queryByTestId('changelog-editor-json-textarea')).not.toBeInTheDocument();
  });

  it('JSON textarea has font-mono class', () => {
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-json-textarea')).toHaveClass('font-mono');
  });

  it('JSON textarea shows validation error when JSON is invalid', async () => {
    const user = userEvent.setup();
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const textarea = screen.getByTestId('changelog-editor-json-textarea');
    await user.clear(textarea);
    await user.type(textarea, 'not valid json');

    expect(screen.getByTestId('changelog-editor-json-error')).toBeInTheDocument();
  });

  it('JSON validation error region is absent when JSON is valid', () => {
    // Initially the textarea contains valid serialized form state
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    // Valid entry form → valid JSON serialized on mount
    expect(screen.queryByTestId('changelog-editor-json-error')).not.toBeInTheDocument();
  });

  // ── CLTE-06: Form→JSON sync (AC #1) ──────────────────────────────────────

  it('Form→JSON: switching to JSON mode re-serializes current form state into textarea', async () => {
    const user = userEvent.setup();
    mockStoreState.panelMode = 'form';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Type something into the EN title field
    await user.type(screen.getByTestId('changelog-editor-title-en'), 'My Title');

    // Switch to JSON mode (simulate store change)
    mockStoreState.panelMode = 'json';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const textarea = screen.getByTestId('changelog-editor-json-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value);
    expect(parsed.title_en).toBe('My Title');
  });

  // ── CLTE-06: JSON→Form sync with valid JSON (AC #2) ──────────────────────

  it('JSON→Form: valid JSON merges parsed values into form state', () => {
    mockStoreState.panelMode = 'json';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Use fireEvent.change to set raw JSON without userEvent interpreting { } as key descriptors
    const textarea = screen.getByTestId('changelog-editor-json-textarea');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify(
          {
            tag: 'bug_fix',
            title_en: 'Bug fixed title',
            title_ru: 'Русский заголовок',
            content_en: 'Fixed content',
            content_ru: 'Содержание',
            version: null,
          },
          null,
          2
        ),
      },
    });

    // Switch back to form mode
    mockStoreState.panelMode = 'form';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // The form title input should now have the parsed value
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('Bug fixed title');
  });

  // ── CLTE-06: JSON→Form with invalid JSON fires discard toast (AC #3) ──────

  it('JSON→Form: invalid JSON fires discard toast and leaves form unchanged', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';
    const { rerender } = render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Type something into form
    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Original title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Original content');

    // Switch to JSON mode
    mockStoreState.panelMode = 'json';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Corrupt the JSON textarea using fireEvent.change to avoid userEvent key parsing
    const textarea = screen.getByTestId('changelog-editor-json-textarea');
    fireEvent.change(textarea, { target: { value: 'this is not valid json at all' } });

    // Switch back to form mode
    mockStoreState.panelMode = 'form';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Toast should have been called with the discard message
    expect(mockToast).toHaveBeenCalledWith({ title: 'Your JSON changes were discarded' });

    // Form state should be unchanged (both title and content)
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('Original title');
    expect(screen.getByTestId('changelog-editor-content-en')).toHaveValue('Original content');

    // Switch back to JSON mode — textarea must re-serialize from form state (not from the corrupted buffer)
    mockStoreState.panelMode = 'json';
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const jsonTextarea = screen.getByTestId(
      'changelog-editor-json-textarea'
    ) as HTMLTextAreaElement;
    const parsed = JSON.parse(jsonTextarea.value);
    expect(parsed.title_en).toBe('Original title');
    expect(parsed.content_en).toBe('Original content');
  });

  // ── CLTE-06: Submit (create) ──────────────────────────────────────────────

  it('Submit (create): calls createEntry with normalized payload and closes drawer on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateEntry.mockResolvedValueOnce({ id: 'new-1' });

    render(<ChangelogEditorDrawer open={true} onClose={onClose} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'New Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'New content');
    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(mockCreateEntry).toHaveBeenCalledWith(
        expect.objectContaining({ title_en: 'New Title', content_en: 'New content' })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('Submit (create): version is normalized to null when empty', async () => {
    const user = userEvent.setup();
    mockCreateEntry.mockResolvedValueOnce({ id: 'new-1' });

    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');
    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(mockCreateEntry).toHaveBeenCalledWith(expect.objectContaining({ version: null }));
    });
  });

  it('Submit (create): shows inline error and keeps drawer open on failure', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateEntry.mockRejectedValueOnce(new Error('Server error'));

    render(<ChangelogEditorDrawer open={true} onClose={onClose} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');
    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('changelog-editor-submit-error')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-editor-submit-error')).toHaveTextContent('Server error');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── CLTE-06: Submit (update) ──────────────────────────────────────────────

  it('Submit (update): calls updateEntry with entry id and closes drawer on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const entry = makeEntry();
    mockUpdateEntry.mockResolvedValueOnce({ ...entry, title_en: 'Updated' });

    render(<ChangelogEditorDrawer open={true} onClose={onClose} entry={entry} />);

    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(mockUpdateEntry).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({ title_en: entry.title_en })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('Submit (update): shows inline error and keeps drawer open on failure', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const entry = makeEntry();
    mockUpdateEntry.mockRejectedValueOnce(new Error('Update failed'));

    render(<ChangelogEditorDrawer open={true} onClose={onClose} entry={entry} />);

    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('changelog-editor-submit-error')).toHaveTextContent(
        'Update failed'
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('Submit (update): button shows "Save" text in edit mode (matches admin:changelog.edit.save key)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);
    // The real EN translation for admin:changelog.edit.save is "Save"
    expect(screen.getByTestId('changelog-editor-footer-submit')).toHaveTextContent('Save');
  });

  it('Submit (create): button shows "Publish entry" in compose mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-footer-submit')).toHaveTextContent('Publish entry');
  });

  // ── Fix #1: Form resets when entry changes (drawer stays mounted) ─────────

  it('resets form to new entry values when entry prop changes (same mounted instance)', () => {
    const entryA = makeEntry({
      id: 'entry-a',
      title_en: 'Entry A title',
      title_ru: 'Заголовок A',
      content_en: 'Entry A content',
      content_ru: 'Содержание A',
    });
    const entryB = makeEntry({
      id: 'entry-b',
      title_en: 'Entry B title',
      title_ru: 'Заголовок B',
      content_en: 'Entry B content',
      content_ru: 'Содержание B',
    });

    const { rerender } = render(
      <ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entryA} />
    );

    // Form is prefilled with A's values
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('Entry A title');

    // Rerender with entry B (same mounted instance, different entry id)
    rerender(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entryB} />);

    // Form now shows B's values
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('Entry B title');
  });

  // ── Header meta row (ADMIN2-44-04 CD-alignment) ─────────────────────────
  // The CD-aligned header now includes a .drawer-meta row showing the tag
  // badge and optional version badge. Previously this was absent; now it is
  // intentionally present in both compose and edit mode.

  it('header meta row (changelog-drawer-meta) is rendered in edit mode', () => {
    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({
          version: '1.4.2',
          created_at: '2026-03-10T00:00:00Z',
          updated_at: '2026-03-10T00:00:00Z',
        })}
      />
    );

    expect(screen.getByTestId('changelog-drawer-meta')).toBeInTheDocument();
  });

  // ── CLLP-10 / ADMIN2-44-05: Drawer-tabs row structure ────────────────────
  // Left side: .drawer-tab-group with Form/JSON .drawer-tab buttons.
  // Right side: .cl-langtabs with EN/RU .dk-langtab pill buttons.

  it('drawer-tabs row: exactly 1 .drawer-tab-group (Form/JSON), 1 .cl-langtabs (EN/RU), and 1 .drawer-tabs-spacer between them', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    const tabGroups = document.querySelectorAll('.drawer-tab-group');
    expect(tabGroups).toHaveLength(1);

    const langTabs = document.querySelectorAll('.cl-langtabs');
    expect(langTabs).toHaveLength(1);

    const spacers = document.querySelectorAll('.drawer-tabs-spacer');
    expect(spacers).toHaveLength(1);

    // Spacer sits between the form/json group and the lang pill group
    expect(tabGroups[0].nextElementSibling?.classList.contains('drawer-tabs-spacer')).toBe(true);
    expect(langTabs[0].previousElementSibling).toBe(spacers[0]);
  });

  it('EN/RU tabs use .dk-langtab class (CD pill style, not .drawer-tab)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const enTab = screen.getByTestId('changelog-editor-tab-en');
    const ruTab = screen.getByTestId('changelog-editor-tab-ru');
    expect(enTab).toHaveClass('dk-langtab');
    expect(ruTab).toHaveClass('dk-langtab');
    expect(enTab).not.toHaveClass('drawer-tab');
    expect(ruTab).not.toHaveClass('drawer-tab');
  });

  it('Form/JSON tabs still use .drawer-tab class (unchanged)', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);
    const formTab = screen.getByTestId('changelog-editor-tab-form');
    const jsonTab = screen.getByTestId('changelog-editor-tab-json');
    expect(formTab).toHaveClass('drawer-tab');
    expect(jsonTab).toHaveClass('drawer-tab');
  });

  // ── CLLP-10: A11y dialog accessible name ─────────────────────────────────

  it('dialog accessible name is "Compose changelog entry" in compose mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Compose changelog entry/i);
  });

  it('dialog accessible name is "Edit changelog entry" in edit mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Edit changelog entry/i);
  });

  // ── CLTE-06: Submit in JSON mode ──────────────────────────────────────────

  it('Submit in JSON mode: surfaces inline error without calling createEntry when JSON is invalid', async () => {
    const user = userEvent.setup();
    // Use an entry so form.title_en/content_en are pre-filled → enReady=true → button enabled
    const entry = makeEntry();
    mockStoreState.panelMode = 'json';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entry} />);

    // Corrupt the JSON textarea using fireEvent.change (avoids { } key parsing issues)
    const textarea = screen.getByTestId('changelog-editor-json-textarea');
    fireEvent.change(textarea, { target: { value: 'bad json not parseable' } });

    await user.click(screen.getByTestId('changelog-editor-footer-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('changelog-editor-submit-error')).toBeInTheDocument();
      expect(mockCreateEntry).not.toHaveBeenCalled();
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });
  });

  // ── ADMIN2-33-04: Preview badge localizes to the active content language ──

  it('preview_badge_localizes_to_ru_content_tab: preview badge shows "Новая функция" when lang=ru (tag=new_feature, admin UI=EN)', () => {
    // Admin UI locale stays EN (test-setup default: lng='en').
    // Content tab is RU.
    mockStoreState.lang = 'ru';
    mockStoreState.panelMode = 'form';

    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'new_feature' })}
      />
    );

    // The preview badge must resolve to the RU label driven by the content lang tab.
    // Badge follows the content-language tab (RU here), independent of the admin UI locale.
    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent('Новая функция');
  });

  it('preview_badge_localizes_to_en_content_tab: preview badge shows "New Feature" when lang=en (tag=new_feature, admin UI=EN)', () => {
    // Both admin UI locale and content tab are EN — badge must show EN label.
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';

    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'new_feature' })}
      />
    );

    // This passes today (EN is current behaviour) but must stay green after the fix.
    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent('New Feature');
  });

  it('preview_badge_decoupled_from_admin_ui_locale: with admin UI=EN and content lang=ru, pill shows EN label while badge shows RU label', async () => {
    // Admin UI stays EN (test-setup default).
    // Content tab = RU → badge must show RU label.
    mockStoreState.lang = 'ru';
    mockStoreState.panelMode = 'form';

    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'new_feature' })}
      />
    );

    // Part (a): top type-selector pill follows admin UI locale (EN) — admin chrome.
    // EN admin UI → pill must show "New Feature" (current correct behaviour; stays green).
    const pill = screen.getByTestId('changelog-editor-tag-new_feature');
    expect(pill).toHaveTextContent('New Feature');

    // Part (b): preview badge follows content lang (RU), NOT admin UI locale.
    // Badge follows content language (RU), while the selector pills follow the admin UI locale.
    const badge = screen.getByTestId('changelog-preview-tag-badge');
    expect(badge).toHaveTextContent('Новая функция');
  });

  // ── ADMIN2-33-04 (adversarial): fix is not hardcoded to new_feature ──────

  it('preview_badge_localizes_bug_fix_to_ru: preview badge shows "Исправление ошибки" when tag=bug_fix and lang=ru', () => {
    // Proves the { lng: lang } fix is data-driven, not hardcoded to new_feature.
    mockStoreState.lang = 'ru';
    mockStoreState.panelMode = 'form';

    render(
      <ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry({ tag: 'bug_fix' })} />
    );

    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent(
      'Исправление ошибки'
    );
  });

  it('preview_badge_localizes_announcement_to_ru: preview badge shows "Объявление" when tag=announcement and lang=ru', () => {
    // Proves the { lng: lang } fix is data-driven, not hardcoded to new_feature.
    mockStoreState.lang = 'ru';
    mockStoreState.panelMode = 'form';

    render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'announcement' })}
      />
    );

    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent('Объявление');
  });

  it('preview_badge_flips_live_on_lang_switch_en_to_ru: switching content lang en→ru flips badge from EN to RU label', () => {
    // Verifies the badge is reactive: re-render with lang=ru shows RU, not a stale EN render.
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';

    const { rerender } = render(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'new_feature' })}
      />
    );

    // EN tab → badge shows EN label
    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent('New Feature');

    // Switch content tab to RU
    mockStoreState.lang = 'ru';
    rerender(
      <ChangelogEditorDrawer
        open={true}
        onClose={vi.fn()}
        entry={makeEntry({ tag: 'new_feature' })}
      />
    );

    // Badge must now show RU label — proves reactivity to content lang change
    expect(screen.getByTestId('changelog-preview-tag-badge')).toHaveTextContent('Новая функция');
  });
});
