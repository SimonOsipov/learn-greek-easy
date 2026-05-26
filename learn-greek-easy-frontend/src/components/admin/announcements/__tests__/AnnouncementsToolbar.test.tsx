// src/components/admin/announcements/__tests__/AnnouncementsToolbar.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementsToolbar } from '../AnnouncementsToolbar';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'announcements.toolbar.searchPlaceholder': 'Search announcements',
        'announcements.toolbar.searchClearAriaLabel': 'Clear search',
        'announcements.toolbar.sortLabel': 'Sort',
        'announcements.toolbar.sort.newest': 'Newest first',
        'announcements.toolbar.sort.oldest': 'Oldest first',
        'announcements.toolbar.sort.rateDesc': 'Highest read rate',
        'announcements.toolbar.sort.rateAsc': 'Lowest read rate',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AnnouncementsToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smoke render — resolves testids; clear button absent when query is empty', () => {
    const onQueryChange = vi.fn();
    const onSortChange = vi.fn();

    render(
      <AnnouncementsToolbar
        query=""
        onQueryChange={onQueryChange}
        sort="newest"
        onSortChange={onSortChange}
      />
    );

    expect(screen.getByTestId('announcement-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcements-toolbar-sort')).toBeInTheDocument();
    expect(screen.queryByTestId('announcement-search-clear')).toBeNull();
  });

  it("clear button aria-label is i18n'd", () => {
    render(
      <AnnouncementsToolbar
        query="hello"
        onQueryChange={vi.fn()}
        sort="newest"
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('announcement-search-clear')).toHaveAttribute(
      'aria-label',
      'Clear search'
    );
  });

  it('outer container has flex-wrap', () => {
    const { container } = render(
      <AnnouncementsToolbar query="" onQueryChange={vi.fn()} sort="newest" onSortChange={vi.fn()} />
    );

    expect(container.firstChild).toHaveClass('sm:flex-wrap');
  });

  it('clear-X click calls onQueryChange with empty string', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <AnnouncementsToolbar
        query="hello"
        onQueryChange={onQueryChange}
        sort="newest"
        onSortChange={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('announcement-search-clear'));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('ESC keydown on the input calls onQueryChange with empty string', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <AnnouncementsToolbar
        query="hello"
        onQueryChange={onQueryChange}
        sort="newest"
        onSortChange={vi.fn()}
      />
    );

    const input = screen.getByTestId('announcement-search-input');
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('toolbar does not render visible SegControl group labels', () => {
    const { container } = render(
      <AnnouncementsToolbar query="" onQueryChange={vi.fn()} sort="newest" onSortChange={vi.fn()} />
    );
    expect(container.querySelectorAll('.news-seg-l')).toHaveLength(0);
  });
});
