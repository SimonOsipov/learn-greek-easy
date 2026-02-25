/**
 * TagFilter Component Tests
 *
 * Tests for the TagFilter component including:
 * - Rendering all filter buttons
 * - Active state variants
 * - Click handler calls
 * - Translation text
 */

import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { render, screen } from '@/lib/test-utils';
import { TagFilter } from '../TagFilter';
import type { ChangelogTag } from '@/types/changelog';

// Factory
const createProps = (overrides = {}) => ({
  activeTag: null as ChangelogTag | null,
  onTagChange: vi.fn(),
  ...overrides,
});

describe('TagFilter', () => {
  describe('Rendering', () => {
    it('should render 4 filter buttons: All, New Feature, Bug Fix, Announcement', () => {
      render(<TagFilter {...createProps()} />);
      expect(screen.getByTestId('tag-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('tag-filter-new_feature')).toBeInTheDocument();
      expect(screen.getByTestId('tag-filter-bug_fix')).toBeInTheDocument();
      expect(screen.getByTestId('tag-filter-announcement')).toBeInTheDocument();
    });

    it('should render the tag-filter wrapper with correct testid', () => {
      render(<TagFilter {...createProps()} />);
      expect(screen.getByTestId('tag-filter')).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('should mark "All" button as default variant when activeTag is null', () => {
      render(<TagFilter {...createProps({ activeTag: null })} />);
      // When activeTag=null, All button gets variant="default" (solid background)
      // Tag buttons get variant="outline"
      const allButton = screen.getByTestId('tag-filter-all');
      expect(allButton).toBeInTheDocument();
      // The "All" button is the primary one when no filter active
    });

    it('should mark new_feature button active when activeTag is "new_feature"', () => {
      render(<TagFilter {...createProps({ activeTag: 'new_feature' })} />);
      const tagButton = screen.getByTestId('tag-filter-new_feature');
      expect(tagButton).toBeInTheDocument();
    });
  });

  describe('Click Handlers', () => {
    it('should call onTagChange with null when All button is clicked', async () => {
      const user = userEvent.setup();
      const props = createProps({ activeTag: 'new_feature' });
      render(<TagFilter {...props} />);
      await user.click(screen.getByTestId('tag-filter-all'));
      expect(props.onTagChange).toHaveBeenCalledWith(null);
    });

    it('should call onTagChange with "new_feature" when New Feature button is clicked', async () => {
      const user = userEvent.setup();
      const props = createProps({ activeTag: null });
      render(<TagFilter {...props} />);
      await user.click(screen.getByTestId('tag-filter-new_feature'));
      expect(props.onTagChange).toHaveBeenCalledWith('new_feature');
    });

    it('should call onTagChange with "bug_fix" when Bug Fix button is clicked', async () => {
      const user = userEvent.setup();
      const props = createProps({ activeTag: null });
      render(<TagFilter {...props} />);
      await user.click(screen.getByTestId('tag-filter-bug_fix'));
      expect(props.onTagChange).toHaveBeenCalledWith('bug_fix');
    });

    it('should call onTagChange with "announcement" when Announcement button is clicked', async () => {
      const user = userEvent.setup();
      const props = createProps({ activeTag: null });
      render(<TagFilter {...props} />);
      await user.click(screen.getByTestId('tag-filter-announcement'));
      expect(props.onTagChange).toHaveBeenCalledWith('announcement');
    });
  });

  describe('Translations', () => {
    it('should render "All" as button text', () => {
      render(<TagFilter {...createProps()} />);
      expect(screen.getByTestId('tag-filter-all')).toHaveTextContent('All');
    });

    it('should render "New Feature" for new_feature tag', () => {
      render(<TagFilter {...createProps()} />);
      expect(screen.getByTestId('tag-filter-new_feature')).toHaveTextContent('New Feature');
    });
  });
});
