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

  // ── Translation status pills (AC #5) ──────────────────────────────────────

  it('renders EN and RU pills', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-trans-pill-en')).toBeInTheDocument();
    expect(screen.getByTestId('changelog-trans-pill-ru')).toBeInTheDocument();
  });

  it('EN pill is not done when title_en and content_en are empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-trans-pill-en')).not.toHaveClass('is-done');
  });

  it('EN pill is done when entry has title_en and content_en', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.getByTestId('changelog-trans-pill-en')).toHaveClass('is-done');
    expect(screen.getByTestId('changelog-trans-pill-ru')).toHaveClass('is-done');
  });

  it('RU pill becomes done after typing title and content in RU', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-ru'), 'Заголовок');
    await user.type(screen.getByTestId('changelog-editor-content-ru'), 'Содержание');

    expect(screen.getByTestId('changelog-trans-pill-ru')).toHaveClass('is-done');
  });

  it('pill is not done when only title is filled (content is empty)', async () => {
    const user = userEvent.setup();
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title only');

    expect(screen.getByTestId('changelog-trans-pill-en')).not.toHaveClass('is-done');
  });

  // ── Auto-translate button (AC #6) ─────────────────────────────────────────

  it('auto-translate button has aria-disabled="true"', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-autotranslate')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('auto-translate button does not have the native disabled attribute', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Native disabled would prevent Radix Tooltip from firing
    expect(screen.getByTestId('changelog-editor-autotranslate')).not.toBeDisabled();
  });

  it('auto-translate button label shows EN→RU when lang=en', () => {
    mockStoreState.lang = 'en';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-autotranslate')).toHaveTextContent(
      'Auto-translate EN → RU'
    );
  });

  it('auto-translate button label shows RU→EN when lang=ru', () => {
    mockStoreState.lang = 'ru';
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-autotranslate')).toHaveTextContent(
      'Auto-translate RU → EN'
    );
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

  it('shows formatted date in edit mode (MMM d, yyyy)', () => {
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

    expect(screen.getByTestId('changelog-preview-foot')).toHaveTextContent('Posted Jan 15, 2026');
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

  // ── CLTE-06: Footer badge states ──────────────────────────────────────────

  it('shows "Needs EN title + content" badge when form is empty', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-badge-needs-en')).toBeInTheDocument();
    expect(screen.queryByTestId('changelog-editor-badge-ready')).not.toBeInTheDocument();
    expect(screen.queryByTestId('changelog-editor-badge-needs-ru')).not.toBeInTheDocument();
  });

  it('shows "Ready" badge when EN title and content are non-empty', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');

    expect(screen.getByTestId('changelog-editor-badge-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('changelog-editor-badge-needs-en')).not.toBeInTheDocument();
  });

  it('shows "Missing RU translation" badge when EN is ready but RU is empty', async () => {
    const user = userEvent.setup();
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    await user.type(screen.getByTestId('changelog-editor-title-en'), 'Title');
    await user.type(screen.getByTestId('changelog-editor-content-en'), 'Content');

    expect(screen.getByTestId('changelog-editor-badge-needs-ru')).toBeInTheDocument();
  });

  it('hides "Missing RU translation" badge when both EN and RU are complete', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    // makeEntry() has title_en, content_en, title_ru, content_ru all set
    expect(screen.getByTestId('changelog-editor-badge-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('changelog-editor-badge-needs-ru')).not.toBeInTheDocument();
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

    // Form state should be unchanged
    expect(screen.getByTestId('changelog-editor-title-en')).toHaveValue('Original title');
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

  it('Submit (update): button shows "Save changes" in edit mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={makeEntry()} />);

    expect(screen.getByTestId('changelog-editor-footer-submit')).toHaveTextContent('Save changes');
  });

  it('Submit (create): button shows "Publish entry" in compose mode', () => {
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('changelog-editor-footer-submit')).toHaveTextContent('Publish entry');
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
});
