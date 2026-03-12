/**
 * Tests for CardDeleteDialog component — itemType-driven title and data loss list
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CardDeleteDialog } from '../CardDeleteDialog';
import i18n from '@/i18n';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  itemPreview: 'test item',
  onConfirm: vi.fn(),
  isDeleting: false,
};

describe('CardDeleteDialog', () => {
  describe('itemType="card"', () => {
    it('renders title "Permanently Delete Card"', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="card" />, { wrapper });
      expect(screen.getByText('Permanently Delete Card')).toBeInTheDocument();
    });

    it('renders 3 data loss items', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="card" />, { wrapper });
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('itemType="question"', () => {
    it('renders title "Permanently Delete Question"', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="question" />, { wrapper });
      expect(screen.getByText('Permanently Delete Question')).toBeInTheDocument();
    });

    it('renders 3 data loss items', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="question" />, { wrapper });
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('itemType="wordEntry"', () => {
    it('renders title "Permanently Delete Word Entry"', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="wordEntry" />, { wrapper });
      expect(screen.getByText('Permanently Delete Word Entry')).toBeInTheDocument();
    });

    it('renders 4 data loss items', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="wordEntry" />, { wrapper });
      expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });

    it('shows word entry specific data loss text', () => {
      render(<CardDeleteDialog {...defaultProps} itemType="wordEntry" />, { wrapper });
      expect(screen.getByText('Word entry data and translations')).toBeInTheDocument();
      expect(screen.getByText('Card records and learning progress')).toBeInTheDocument();
      expect(screen.getByText('Deck associations')).toBeInTheDocument();
      expect(screen.getByText('Audio files')).toBeInTheDocument();
    });
  });

  describe('buttons', () => {
    it('confirm button calls onConfirm', async () => {
      const onConfirm = vi.fn();
      render(<CardDeleteDialog {...defaultProps} itemType="card" onConfirm={onConfirm} />, {
        wrapper,
      });
      await userEvent.click(screen.getByTestId('card-delete-confirm'));
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('cancel button calls onOpenChange(false)', async () => {
      const onOpenChange = vi.fn();
      render(<CardDeleteDialog {...defaultProps} itemType="card" onOpenChange={onOpenChange} />, {
        wrapper,
      });
      await userEvent.click(screen.getByTestId('card-delete-cancel'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
