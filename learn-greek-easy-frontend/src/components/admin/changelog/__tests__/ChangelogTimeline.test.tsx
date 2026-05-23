/**
 * ChangelogTimeline Component Tests
 *
 * Covers:
 * 1. Month grouping — correct month headers, correct row counts
 * 2. Version pill — hidden for null/empty, shown for truthy version
 * 3. Missing RU badge — shown when title_ru or content_ru is empty
 * 4. Sort order — entries rendered desc by created_at regardless of input order
 * 5. Click handlers — row click fires onEdit; Edit icon fires onEdit; Delete icon fires onDelete
 * 6. English locale — month headers stay English even when i18n language is 'ru'
 * 7. Locale-aware title/body rendering (CLTT-05)
 * 8. Body truncation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { ChangelogEntryAdmin } from '@/types/changelog';
import { ChangelogTimeline } from '../ChangelogTimeline';

// ── i18n mock ─────────────────────────────────────────────────────────────────

const mockI18nLanguage = { value: 'en' };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'changelog:tag.newFeature': 'New Feature',
        'changelog:tag.bugFix': 'Bug Fix',
        'changelog:tag.announcement': 'Announcement',
        'admin:changelog.timeline.missingRuBadge': 'admin:changelog.timeline.missingRuBadge',
      };
      return map[key] ?? key;
    },
    i18n: {
      get language() {
        return mockI18nLanguage.value;
      },
      changeLanguage: (lang: string) => {
        mockI18nLanguage.value = lang;
        return Promise.resolve();
      },
    },
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ChangelogEntryAdmin> & { id: string }): ChangelogEntryAdmin {
  return {
    id: overrides.id,
    title_en: overrides.title_en ?? 'Default Title EN',
    title_ru: overrides.title_ru ?? 'Default Title RU',
    content_en: overrides.content_en ?? 'Default content EN',
    content_ru: overrides.content_ru ?? 'Default content RU',
    tag: overrides.tag ?? 'new_feature',
    version: overrides.version !== undefined ? overrides.version : '1.0.0',
    created_at: overrides.created_at ?? '2026-04-15T10:00:00Z',
    updated_at: overrides.updated_at ?? '2026-04-15T10:00:00Z',
  };
}

// Two entries in April, one in March — supplied in non-sorted order
const APRIL_ENTRY_1 = makeEntry({
  id: 'april-1',
  title_en: 'April Feature One',
  title_ru: 'Апрельская функция первая',
  content_en: 'April feature one body',
  content_ru: 'Апрельская функция первая тело',
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-20T10:00:00Z',
});

const APRIL_ENTRY_2 = makeEntry({
  id: 'april-2',
  title_en: 'April Feature Two',
  title_ru: 'Апрельская функция вторая',
  content_en: 'April feature two body',
  content_ru: 'Апрельская функция вторая тело',
  created_at: '2026-04-10T10:00:00Z',
  updated_at: '2026-04-10T10:00:00Z',
});

const MARCH_ENTRY = makeEntry({
  id: 'march-1',
  title_en: 'March Announcement',
  title_ru: 'Мартовское объявление',
  content_en: 'March announcement body',
  content_ru: 'Мартовское объявление тело',
  tag: 'announcement',
  created_at: '2026-03-05T10:00:00Z',
  updated_at: '2026-03-05T10:00:00Z',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTimeline(entries: ChangelogEntryAdmin[], onEdit = vi.fn(), onDelete = vi.fn()) {
  return render(<ChangelogTimeline entries={entries} onEdit={onEdit} onDelete={onDelete} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ChangelogTimeline — month grouping', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('renders two month sections for April and March entries', () => {
    renderTimeline([MARCH_ENTRY, APRIL_ENTRY_2, APRIL_ENTRY_1]);

    const monthLabels = screen.getAllByText(/April 2026|March 2026/);
    expect(monthLabels).toHaveLength(2);
    expect(monthLabels[0].textContent).toBe('April 2026');
    expect(monthLabels[1].textContent).toBe('March 2026');
  });

  it('renders April group with 2 entries and March group with 1', () => {
    const { container } = renderTimeline([MARCH_ENTRY, APRIL_ENTRY_2, APRIL_ENTRY_1]);

    const months = container.querySelectorAll('.cl-month');
    expect(months).toHaveLength(2);

    // April section (first) has 2 cl-entry elements
    const aprilEntries = months[0].querySelectorAll('.cl-entry');
    expect(aprilEntries).toHaveLength(2);

    // March section (second) has 1 cl-entry element
    const marchEntries = months[1].querySelectorAll('.cl-entry');
    expect(marchEntries).toHaveLength(1);
  });

  it('does not render empty months', () => {
    const { container } = renderTimeline([APRIL_ENTRY_1]);

    const months = container.querySelectorAll('.cl-month');
    expect(months).toHaveLength(1);
  });
});

describe('ChangelogTimeline — version pill', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('hides version pill when version is null', () => {
    renderTimeline([makeEntry({ id: 'v-null', version: null })]);

    expect(screen.queryByTestId('version-pill')).not.toBeInTheDocument();
  });

  it('hides version pill when version is empty string', () => {
    renderTimeline([makeEntry({ id: 'v-empty', version: '' })]);

    expect(screen.queryByTestId('version-pill')).not.toBeInTheDocument();
  });

  it('shows version pill when version is a non-empty string', () => {
    renderTimeline([makeEntry({ id: 'v-show', version: '2.3.0' })]);

    const pill = screen.getByTestId('version-pill');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toContain('2.3.0');
  });

  it('renders version as-is without adding a v prefix (no double-prefix for v1.2.0)', () => {
    renderTimeline([makeEntry({ id: 'v-prefix', version: 'v1.2.0' })]);

    const pill = screen.getByTestId('version-pill');
    expect(pill.textContent).toBe('v1.2.0');
    expect(pill.textContent).not.toBe('vv1.2.0');
  });

  // ── CLLP-10: version pill uses cl-preview-v class (renamed from cl-version-pill) ──
  it('version pill element has class cl-preview-v', () => {
    renderTimeline([makeEntry({ id: 'v-class', version: '3.1.0' })]);

    expect(screen.getByTestId('version-pill').classList.contains('cl-preview-v')).toBe(true);
  });
});

describe('ChangelogTimeline — Missing RU badge', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('shows Missing RU badge when title_ru is empty', () => {
    renderTimeline([makeEntry({ id: 'mru-1', title_ru: '', content_ru: 'RU content' })]);

    expect(screen.getByTestId('missing-ru-badge')).toBeInTheDocument();
  });

  it('shows Missing RU badge when content_ru is empty', () => {
    renderTimeline([makeEntry({ id: 'mru-2', title_ru: 'RU title', content_ru: '' })]);

    expect(screen.getByTestId('missing-ru-badge')).toBeInTheDocument();
  });

  it('shows Missing RU badge when both title_ru and content_ru are empty', () => {
    renderTimeline([makeEntry({ id: 'mru-3', title_ru: '', content_ru: '' })]);

    expect(screen.getByTestId('missing-ru-badge')).toBeInTheDocument();
  });

  it('does NOT show Missing RU badge when both title_ru and content_ru are populated', () => {
    renderTimeline([makeEntry({ id: 'mru-4', title_ru: 'RU title', content_ru: 'RU content' })]);

    expect(screen.queryByTestId('missing-ru-badge')).not.toBeInTheDocument();
  });

  it('shows Missing RU badge when title_ru is whitespace-only', () => {
    renderTimeline([makeEntry({ id: 'mru-5', title_ru: '   ', content_ru: 'RU content' })]);

    expect(screen.getByTestId('missing-ru-badge')).toBeInTheDocument();
  });

  it('shows Missing RU badge when content_ru is whitespace-only', () => {
    renderTimeline([makeEntry({ id: 'mru-6', title_ru: 'RU title', content_ru: '   ' })]);

    expect(screen.getByTestId('missing-ru-badge')).toBeInTheDocument();
  });

  it('badge text uses the i18n key admin:changelog.timeline.missingRuBadge', () => {
    renderTimeline([makeEntry({ id: 'mru-key', title_ru: '', content_ru: 'ok' })]);
    const badge = screen.getByTestId('missing-ru-badge');
    // The mock returns the key itself as the value
    expect(badge.textContent).toBe('admin:changelog.timeline.missingRuBadge');
  });
});

describe('ChangelogTimeline — sort order', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('renders entries desc by created_at regardless of input order', () => {
    // Supply in reverse order: March first, then April entries
    const { container } = renderTimeline([MARCH_ENTRY, APRIL_ENTRY_2, APRIL_ENTRY_1]);

    const allEntries = container.querySelectorAll('.cl-entry');
    // Expected order: april-1 (Apr 20), april-2 (Apr 10), march-1 (Mar 5)
    expect(allEntries[0].querySelector('h3')?.textContent).toBe('April Feature One');
    expect(allEntries[1].querySelector('h3')?.textContent).toBe('April Feature Two');
    expect(allEntries[2].querySelector('h3')?.textContent).toBe('March Announcement');
  });

  it('first rendered entry has the most recent created_at', () => {
    const { container } = renderTimeline([MARCH_ENTRY, APRIL_ENTRY_2, APRIL_ENTRY_1]);
    const firstTitle = container.querySelector('.cl-entry h3')?.textContent;
    expect(firstTitle).toBe('April Feature One');
  });
});

describe('ChangelogTimeline — click handlers', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('row body click fires onEdit with the entry id', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { container } = renderTimeline([APRIL_ENTRY_1], onEdit, onDelete);

    // Click the article element directly (the TimelineEntry root with role="button")
    const article = container.querySelector('article.cl-entry');
    expect(article).not.toBeNull();
    fireEvent.click(article!);

    expect(onEdit).toHaveBeenCalledWith('april-1');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('Edit icon button fires onEdit with the entry id', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderTimeline([APRIL_ENTRY_1], onEdit, onDelete);

    fireEvent.click(screen.getByTestId('timeline-edit-april-1'));

    // The atom's actions wrapper stops propagation, so onEdit fires exactly once
    expect(onEdit).toHaveBeenCalledWith('april-1');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('Delete icon button fires onDelete with the entry id', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderTimeline([APRIL_ENTRY_1], onEdit, onDelete);

    fireEvent.click(screen.getByTestId('timeline-delete-april-1'));

    expect(onDelete).toHaveBeenCalledWith('april-1');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe('ChangelogTimeline — English locale', () => {
  beforeEach(() => {
    mockI18nLanguage.value = 'ru';
  });

  afterEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('renders month headers in English even when i18n language is ru', () => {
    const { container } = renderTimeline([APRIL_ENTRY_1, MARCH_ENTRY]);

    // date-fns format with 'MMMM yyyy' uses system locale NOT i18n.language
    // Result should be English month names regardless of i18n.language
    expect(screen.getByText('April 2026')).toBeInTheDocument();
    expect(screen.getByText('March 2026')).toBeInTheDocument();

    // Month label elements (.cl-month-label) should NOT contain Russian month names
    const monthLabels = container.querySelectorAll('.cl-month-label');
    const monthLabelTexts = Array.from(monthLabels).map((el) => el.textContent ?? '');
    // None of the month labels should contain Russian month names
    expect(monthLabelTexts.some((t) => /апрель|Апрель/i.test(t))).toBe(false);
    expect(monthLabelTexts.some((t) => /март|Март/i.test(t))).toBe(false);
  });
});

describe('ChangelogTimeline — locale-aware title/body (CLTT-05)', () => {
  afterEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('renders title_en in h3 when i18n.language is en', () => {
    mockI18nLanguage.value = 'en';
    const { container } = renderTimeline([APRIL_ENTRY_1]);
    const h3 = container.querySelector('.cl-entry h3');
    expect(h3?.textContent).toBe('April Feature One');
  });

  it('renders title_ru in h3 when i18n.language is ru', () => {
    mockI18nLanguage.value = 'ru';
    const { container } = renderTimeline([APRIL_ENTRY_1]);
    const h3 = container.querySelector('.cl-entry h3');
    expect(h3?.textContent).toBe('Апрельская функция первая');
  });

  it('renders [EN] fallback in h3 when active lang is ru but title_ru is empty', () => {
    mockI18nLanguage.value = 'ru';
    const entry = makeEntry({ id: 'fallback-1', title_ru: '', content_ru: 'some ru body' });
    const { container } = renderTimeline([entry]);
    const h3 = container.querySelector('.cl-entry h3');
    expect(h3?.textContent).toBe('[EN] Default Title EN');
  });

  it('renders content_en in body when i18n.language is en', () => {
    mockI18nLanguage.value = 'en';
    renderTimeline([APRIL_ENTRY_1]);
    const contentEl = document.querySelector('.cl-entry-content');
    expect(contentEl?.textContent).toContain('April feature one body');
  });

  it('renders content_ru in body when i18n.language is ru', () => {
    mockI18nLanguage.value = 'ru';
    renderTimeline([APRIL_ENTRY_1]);
    const contentEl = document.querySelector('.cl-entry-content');
    expect(contentEl?.textContent).toContain('Апрельская функция первая тело');
  });

  it('subtitle prop passed to TimelineEntry is undefined regardless of lang', () => {
    // ChangelogTimeline explicitly passes subtitle={undefined}
    // TimelineEntry renders subtitle in .cl-entry-title-ru when present.
    // Since subtitle is undefined, this element should be absent.
    mockI18nLanguage.value = 'en';
    const { container } = renderTimeline([APRIL_ENTRY_1]);
    expect(container.querySelector('.cl-entry-title-ru')).toBeNull();

    // Also test with RU lang
    mockI18nLanguage.value = 'ru';
    const { container: containerRu } = renderTimeline([APRIL_ENTRY_1]);
    expect(containerRu.querySelector('.cl-entry-title-ru')).toBeNull();
  });
});

describe('ChangelogTimeline — body truncation', () => {
  beforeEach(() => {
    // Reset to EN so content_en is used for truncation
    mockI18nLanguage.value = 'en';
  });

  afterEach(() => {
    mockI18nLanguage.value = 'en';
  });

  it('truncates body longer than 240 chars with ellipsis', () => {
    const longContent = 'A'.repeat(300);
    const { container } = renderTimeline([
      makeEntry({ id: 'trunc-1', content_en: longContent, content_ru: longContent }),
    ]);

    const contentEl = container.querySelector('.cl-entry-content');
    expect(contentEl?.textContent).toHaveLength(241); // 240 chars + '…'
    expect(contentEl?.textContent?.endsWith('…')).toBe(true);
  });

  it('does not truncate body at or under 240 chars', () => {
    const shortContent = 'B'.repeat(240);
    const { container } = renderTimeline([
      makeEntry({ id: 'trunc-2', content_en: shortContent, content_ru: shortContent }),
    ]);

    const contentEl = container.querySelector('.cl-entry-content');
    expect(contentEl?.textContent).toHaveLength(240);
    expect(contentEl?.textContent?.endsWith('…')).toBe(false);
  });
});
