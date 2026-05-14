import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TopBar } from '../TopBar';

const mockToggleTheme = vi.fn();
let mockCurrentTheme: 'light' | 'dark' = 'light';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    currentTheme: mockCurrentTheme,
    toggleTheme: mockToggleTheme,
    setTheme: vi.fn(),
    isChanging: false,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const renderTopBar = (props: Parameters<typeof TopBar>[0] = {}) =>
  render(
    <MemoryRouter>
      <TopBar {...props} />
    </MemoryRouter>
  );

describe('TopBar', () => {
  beforeEach(() => {
    mockToggleTheme.mockClear();
    mockCurrentTheme = 'light';
  });

  it('renders brand mark + admin chip + nav links', () => {
    renderTopBar();
    expect(screen.getByText('Ελ')).toBeInTheDocument();
    expect(screen.getByText('Greeklish')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    // Six nav anchors — Admin always active
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('Admin nav link has aria-current=page (always-active decorative state)', () => {
    renderTopBar();
    const admin = screen.getByText('Admin');
    expect(admin).toHaveAttribute('aria-current', 'page');
    expect(admin).toHaveClass('active');
  });

  it('theme button fires toggleTheme("header") on click', () => {
    renderTopBar();
    fireEvent.click(screen.getByLabelText(/toggle theme/i));
    expect(mockToggleTheme).toHaveBeenCalledWith('header');
  });

  it('hides notification dot when hasNotifications is false', () => {
    const { container } = renderTopBar({ hasNotifications: false });
    expect(container.querySelector('.dot.dot-red')).toBeNull();
  });

  it('shows notification dot when hasNotifications is true', () => {
    const { container } = renderTopBar({ hasNotifications: true });
    expect(container.querySelector('.dot.dot-red')).not.toBeNull();
  });

  it('search button calls onSearchClick when provided', () => {
    const onSearchClick = vi.fn();
    renderTopBar({ onSearchClick });
    fireEvent.click(screen.getByLabelText(/search admin/i));
    expect(onSearchClick).toHaveBeenCalled();
  });

  it('avatar renders initials and is labelled for screen readers', () => {
    renderTopBar({ avatarInitials: 'JD' });
    const avatar = screen.getByLabelText(/admin user jd/i);
    expect(avatar).toHaveTextContent('JD');
  });
});
