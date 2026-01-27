/**
 * ChangelogCard Component Tests
 *
 * Tests for the ChangelogCard component including:
 * - Rendering title, date, content
 * - Tag badge display with correct styling
 * - Markdown rendering (bold and italic)
 * - Date formatting based on locale
 */

import { describe, it, expect } from 'vitest';

import { ChangelogCard } from '../ChangelogCard';
import type { ChangelogItem } from '@/types/changelog';
import { render, screen } from '@/lib/test-utils';

// Factory function for creating mock changelog items
const createMockEntry = (overrides: Partial<ChangelogItem> = {}): ChangelogItem => ({
  id: 'changelog-123',
  title: 'Test Title',
  content: 'Test content for the changelog entry.',
  tag: 'new_feature',
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-15T10:30:00Z',
  ...overrides,
});

describe('ChangelogCard', () => {
  describe('Basic Rendering', () => {
    it('should render the title correctly', () => {
      const entry = createMockEntry({ title: 'My Changelog Title' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('My Changelog Title')).toBeInTheDocument();
    });

    it('should render the content correctly', () => {
      const entry = createMockEntry({ content: 'This is the changelog content.' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('This is the changelog content.')).toBeInTheDocument();
    });

    it('should render a time element with datetime attribute', () => {
      const entry = createMockEntry({ created_at: '2026-01-15T10:30:00Z' });
      render(<ChangelogCard entry={entry} />);

      const timeElement = screen.getByRole('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute('dateTime', '2026-01-15T10:30:00Z');
    });

    it('should render within a card structure', () => {
      const entry = createMockEntry();
      render(<ChangelogCard entry={entry} />);

      // Card should have w-full class
      const card = screen.getByText('Test Title').closest('.w-full');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Tag Badge', () => {
    it('should render the correct tag text for new_feature', () => {
      const entry = createMockEntry({ tag: 'new_feature' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('New Feature')).toBeInTheDocument();
    });

    it('should render the correct tag text for bug_fix', () => {
      const entry = createMockEntry({ tag: 'bug_fix' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('Bug Fix')).toBeInTheDocument();
    });

    it('should render the correct tag text for announcement', () => {
      const entry = createMockEntry({ tag: 'announcement' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('Announcement')).toBeInTheDocument();
    });

    it('should apply correct color class for new_feature tag', () => {
      const entry = createMockEntry({ tag: 'new_feature' });
      render(<ChangelogCard entry={entry} />);

      const badge = screen.getByText('New Feature');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('should apply correct color class for bug_fix tag', () => {
      const entry = createMockEntry({ tag: 'bug_fix' });
      render(<ChangelogCard entry={entry} />);

      const badge = screen.getByText('Bug Fix');
      expect(badge).toHaveClass('bg-amber-100');
    });

    it('should apply correct color class for announcement tag', () => {
      const entry = createMockEntry({ tag: 'announcement' });
      render(<ChangelogCard entry={entry} />);

      const badge = screen.getByText('Announcement');
      expect(badge).toHaveClass('bg-blue-100');
    });
  });

  describe('Markdown Rendering', () => {
    it('should render bold text as strong element', () => {
      const entry = createMockEntry({ content: 'This is **bold** text.' });
      render(<ChangelogCard entry={entry} />);

      const strongElement = screen.getByText('bold');
      expect(strongElement.tagName).toBe('STRONG');
    });

    it('should render italic text as em element', () => {
      const entry = createMockEntry({ content: 'This is *italic* text.' });
      render(<ChangelogCard entry={entry} />);

      const emElement = screen.getByText('italic');
      expect(emElement.tagName).toBe('EM');
    });

    it('should render mixed markdown correctly', () => {
      const entry = createMockEntry({
        content: 'Start **bold** middle *italic* end.',
      });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText(/Start/)).toBeInTheDocument();
      expect(screen.getByText(/end./)).toBeInTheDocument();
    });

    it('should render plain text without markdown as-is', () => {
      const entry = createMockEntry({ content: 'Plain text without formatting.' });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText('Plain text without formatting.')).toBeInTheDocument();
    });

    it('should handle multiple bold sections', () => {
      const entry = createMockEntry({ content: '**first** normal **second**' });
      render(<ChangelogCard entry={entry} />);

      const strongElements = screen.getAllByText(/first|second/);
      strongElements.forEach((el) => {
        if (el.textContent === 'first' || el.textContent === 'second') {
          expect(el.tagName).toBe('STRONG');
        }
      });
    });
  });

  describe('Date Formatting', () => {
    it('should format the date based on locale', () => {
      const entry = createMockEntry({ created_at: '2026-01-15T10:30:00Z' });
      render(<ChangelogCard entry={entry} />);

      const timeElement = screen.getByRole('time');
      // The exact format depends on the locale, but should contain recognizable date parts
      // In 'en' locale, it should be something like "January 15, 2026"
      expect(timeElement).toHaveTextContent(/2026/);
      expect(timeElement).toHaveTextContent(/15/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const entry = createMockEntry({ content: '' });
      render(<ChangelogCard entry={entry} />);

      // Card should still render with title
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should handle long title', () => {
      const longTitle = 'A'.repeat(200);
      const entry = createMockEntry({ title: longTitle });
      render(<ChangelogCard entry={entry} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle content with only markdown', () => {
      const entry = createMockEntry({ content: '**only bold**' });
      render(<ChangelogCard entry={entry} />);

      const boldElement = screen.getByText('only bold');
      expect(boldElement.tagName).toBe('STRONG');
    });
  });
});
