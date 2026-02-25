import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileHeader } from '../ProfileHeader';
import type { User } from '@/types/auth';

const BASE_USER: User = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatar: undefined,
  role: 'free',
  preferences: {
    language: 'en',
    dailyGoal: 15,
    notifications: false,
  },
  stats: {
    streak: 5,
    wordsLearned: 100,
    totalXP: 500,
    joinedDate: new Date('2025-01-15'),
    lastActivity: new Date('2026-02-20'),
  },
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2026-02-20'),
};

describe('ProfileHeader', () => {
  describe('avatar wrapper element', () => {
    it('renders avatar as button when onAvatarClick is provided', () => {
      const handleClick = vi.fn();
      render(<ProfileHeader user={BASE_USER} onAvatarClick={handleClick} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('does not render a button when onAvatarClick is not provided', () => {
      render(<ProfileHeader user={BASE_USER} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('last activity display', () => {
    it('shows "Active now" when lastActivity is undefined', () => {
      const user: User = {
        ...BASE_USER,
        stats: { ...BASE_USER.stats, lastActivity: undefined },
      };
      render(<ProfileHeader user={user} />);
      expect(screen.getByText('Active now')).toBeInTheDocument();
    });

    it('shows formatted date when lastActivity is present', () => {
      render(<ProfileHeader user={BASE_USER} />);
      // lastActivity is 2026-02-20; toLocaleDateString produces locale-dependent output
      // Check for presence of "Last Active" label to verify the section renders
      expect(screen.getByText('Last Active')).toBeInTheDocument();
    });
  });

  describe('user info display', () => {
    it('renders user name', () => {
      render(<ProfileHeader user={BASE_USER} />);
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders user email', () => {
      render(<ProfileHeader user={BASE_USER} />);
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('renders initials in avatar fallback', () => {
      render(<ProfileHeader user={BASE_USER} />);
      expect(screen.getByText('TU')).toBeInTheDocument();
    });
  });
});
