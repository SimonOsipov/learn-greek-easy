// src/components/admin/changelog/__tests__/ChangelogEditorDrawer.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChangelogEditorDrawer } from '../ChangelogEditorDrawer';

// ── Store mock ─────────────────────────────────────────────────────────────────
// Mirrors the selector-based pattern from ChangelogTab.test.tsx.
// We hold mutable state so individual tests can override lang/panelMode.

const mockSetLang = vi.fn((l: 'en' | 'ru') => {
  mockStoreState.lang = l;
});
const mockSetPanelMode = vi.fn((m: 'form' | 'json') => {
  mockStoreState.panelMode = m;
});

const mockStoreState = {
  lang: 'en' as 'en' | 'ru',
  panelMode: 'form' as 'form' | 'json',
  setLang: mockSetLang,
  setPanelMode: mockSetPanelMode,
};

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (state: typeof mockStoreState) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState,
  selectAdminChangelogLang: (state: typeof mockStoreState) => state.lang,
  selectAdminChangelogPanelMode: (state: typeof mockStoreState) => state.panelMode,
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ChangelogEditorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state to defaults before each test
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';
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
      version: null,
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
    const entry = {
      id: 'e1',
      title_en: 'Hello',
      title_ru: '',
      content_en: 'World',
      content_ru: '',
      tag: 'new_feature' as const,
      version: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entry} />);

    expect(screen.getByTestId('changelog-trans-pill-en')).toHaveClass('is-done');
    expect(screen.getByTestId('changelog-trans-pill-ru')).not.toHaveClass('is-done');
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
    const entry = {
      id: 'e1',
      title_en: 'Hello',
      title_ru: 'Привет',
      content_en: 'Content',
      content_ru: 'Содержание',
      tag: 'new_feature' as const,
      version: null,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
    };
    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} entry={entry} />);

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
});
