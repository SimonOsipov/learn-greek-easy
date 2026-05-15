/**
 * TopBar Component Tests (ASHELL-03)
 *
 * Covers:
 * 1. Theme toggle wiring — toggleTheme('header') is called on click
 * 2. Moon/Sun icon swap based on currentTheme
 * 3. Language toggle wiring — i18n.changeLanguage called with opposite locale
 * 4. Bell dot visible when hasNotifications === true
 * 5. Bell dot hidden when hasNotifications === false
 * 6. onSearchClick invoked on search button click
 * 7. Search button is no-op (no crash) when onSearchClick is omitted
 * 8. AdminAvatar is rendered with tone="blue"
 * 9. avatarInitials prop is forwarded to AdminAvatar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TopBar } from '../top-bar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Hoisted mocks — vi.mock factories are hoisted to the top of the file, so any
// variables they reference must be declared with vi.hoisted() or be inline vi.fn() calls.
const { mockToggleTheme, mockCurrentTheme, mockChangeLanguage } = vi.hoisted(() => ({
  mockToggleTheme: vi.fn(),
  mockCurrentTheme: { value: 'light' as 'light' | 'dark' },
  mockChangeLanguage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    currentTheme: mockCurrentTheme.value,
    toggleTheme: mockToggleTheme,
    setTheme: vi.fn(),
    isChanging: false,
  }),
}));

vi.mock('@/i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: mockChangeLanguage,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'shell.topBar.search': 'Search admin',
        'shell.topBar.theme': 'Toggle theme',
        'shell.topBar.language': 'Switch language',
        'shell.topBar.notifications': 'Notifications',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en', changeLanguage: mockChangeLanguage },
  }),
}));

// Mock analytics and error reporting that ThemeContext pulls in transitively
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return { ...actual, track: vi.fn(), registerTheme: vi.fn() };
});

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTopBar(props: React.ComponentProps<typeof TopBar> = {}) {
  return render(<TopBar {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentTheme.value = 'light';
  });

  // 1. Theme toggle wiring
  it('calls toggleTheme("header") when theme button is clicked', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(mockToggleTheme).toHaveBeenCalledOnce();
    expect(mockToggleTheme).toHaveBeenCalledWith('header');
  });

  // 2a. Moon icon shown when currentTheme is light
  it('shows Moon icon when currentTheme is light', () => {
    mockCurrentTheme.value = 'light';
    renderTopBar();

    expect(screen.getByTestId('theme-icon-moon')).toBeTruthy();
    expect(screen.queryByTestId('theme-icon-sun')).toBeFalsy();
  });

  // 2b. Sun icon shown when currentTheme is dark
  it('shows Sun icon when currentTheme is dark', () => {
    mockCurrentTheme.value = 'dark';
    renderTopBar();

    expect(screen.getByTestId('theme-icon-sun')).toBeTruthy();
    expect(screen.queryByTestId('theme-icon-moon')).toBeFalsy();
  });

  // 3. Language toggle wiring
  it('calls i18n.changeLanguage with "ru" when current language is "en"', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(mockChangeLanguage).toHaveBeenCalledOnce();
    expect(mockChangeLanguage).toHaveBeenCalledWith('ru');
  });

  // 4. Bell dot visible when hasNotifications is true
  it('renders the notification dot when hasNotifications is true', () => {
    renderTopBar({ hasNotifications: true });

    // The dot is an <i> with class "dot dot-red"
    const bellBtn = screen.getByRole('button', { name: 'Notifications' });
    const dot = bellBtn.querySelector('.dot.dot-red');
    expect(dot).toBeTruthy();
  });

  // 5. Bell dot hidden when hasNotifications is false (default)
  it('does not render the notification dot when hasNotifications is false', () => {
    renderTopBar({ hasNotifications: false });

    const bellBtn = screen.getByRole('button', { name: 'Notifications' });
    const dot = bellBtn.querySelector('.dot.dot-red');
    expect(dot).toBeFalsy();
  });

  it('does not render the notification dot by default', () => {
    renderTopBar();

    const bellBtn = screen.getByRole('button', { name: 'Notifications' });
    expect(bellBtn.querySelector('.dot.dot-red')).toBeFalsy();
  });

  // 6. onSearchClick invoked on click
  it('calls onSearchClick when search button is clicked', async () => {
    const user = userEvent.setup();
    const onSearchClick = vi.fn();
    renderTopBar({ onSearchClick });

    await user.click(screen.getByRole('button', { name: 'Search admin' }));

    expect(onSearchClick).toHaveBeenCalledOnce();
  });

  // 7. No-op when onSearchClick is omitted
  it('does not throw when search button is clicked without onSearchClick prop', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await expect(
      user.click(screen.getByRole('button', { name: 'Search admin' }))
    ).resolves.not.toThrow();
  });

  // 8. AdminAvatar rendered with tone="blue"
  it('renders AdminAvatar with class avatar-blue', () => {
    renderTopBar();

    // AdminAvatar renders a <span> with class "avatar avatar-blue"
    const avatar = document.querySelector('.avatar.avatar-blue');
    expect(avatar).toBeTruthy();
  });

  // 9. avatarInitials forwarded to AdminAvatar
  it('forwards avatarInitials to AdminAvatar', () => {
    renderTopBar({ avatarInitials: 'AB' });

    const avatar = document.querySelector('.avatar.avatar-blue');
    expect(avatar?.textContent).toBe('AB');
  });
});
