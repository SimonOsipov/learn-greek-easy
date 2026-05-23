// src/components/admin/__tests__/AdminFeedbackCard.test.tsx
//
// Vitest + RTL unit tests for AdminFeedbackCard (HN-style re-skin, FBDR-10).
// Covers: vote rail, type/status badges, inline admin-response quote,
// click propagation, keyboard activation, author foot, no device field.
//
// NOTE: Delete-button tests (trash icon, onDelete prop) live in
// AdminFeedbackDelete.test.tsx — do NOT duplicate them here.

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AdminFeedbackCard } from '../AdminFeedbackCard';

import type { AdminFeedbackItem } from '@/types/feedback';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'feedback.anonymousUser': 'Anonymous User',
        'feedback.v2.card.openReply': opts?.title ? `Open reply for ${opts.title}` : 'Open reply',
        'feedback.v2.card.adminResponseLabel': '✓ Admin response',
        'feedback.deleteAction': 'Delete',
        'feedback.category.bug': 'Bug',
        'feedback.category.featureRequest': 'Feature request',
        'feedback.status.new': 'New',
        'feedback.status.investigating': 'Investigating',
        'feedback.status.planned': 'Planned',
        'feedback.status.inProgress': 'In progress',
        'feedback.status.responded': 'Responded',
        'feedback.status.shipped': 'Shipped',
        'feedback.status.wontFix': "Won't fix",
        'feedback.status.duplicate': 'Duplicate',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// ── Fixture factory ────────────────────────────────────────────────────────────

function makeFeedback(overrides: Partial<AdminFeedbackItem> = {}): AdminFeedbackItem {
  return {
    id: 'card-test-001',
    title: 'Add night mode',
    description: 'Please add a night mode option for late-night learning.',
    category: 'feature_request',
    status: 'new',
    vote_count: 12,
    admin_response: null,
    admin_response_at: null,
    author: { id: 'user-1', full_name: 'Jane Doe' },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminFeedbackCard (HN-style re-skin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Vote rail ──────────────────────────────────────────────────────────────

  describe('Vote rail', () => {
    it('renders .fb-vote-count element with the vote_count value', () => {
      render(<AdminFeedbackCard feedback={makeFeedback({ vote_count: 12 })} onRespond={vi.fn()} />);

      const voteCount = document.querySelector('.fb-vote-count');
      expect(voteCount).toBeInTheDocument();
      expect(voteCount?.textContent).toBe('12');
    });

    it('renders the left rail wrapper (.fb-card-left)', () => {
      render(<AdminFeedbackCard feedback={makeFeedback()} onRespond={vi.fn()} />);

      expect(document.querySelector('.fb-card-left')).toBeInTheDocument();
    });
  });

  // ── Type + status badges ───────────────────────────────────────────────────

  describe('Type and status badges', () => {
    it('renders "Feature request" badge for feature_request category', () => {
      render(
        <AdminFeedbackCard
          feedback={makeFeedback({ category: 'feature_request' })}
          onRespond={vi.fn()}
        />
      );

      expect(screen.getByText('Feature request')).toBeInTheDocument();
    });

    it('renders "Bug" badge for bug_incorrect_data category', () => {
      render(
        <AdminFeedbackCard
          feedback={makeFeedback({ category: 'bug_incorrect_data' })}
          onRespond={vi.fn()}
        />
      );

      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    it('renders status badge for the handoff status', () => {
      render(
        <AdminFeedbackCard feedback={makeFeedback({ status: 'planned' })} onRespond={vi.fn()} />
      );

      // planned → handoff 'planned' → label 'Planned'
      expect(screen.getByText('Planned')).toBeInTheDocument();
    });

    it('renders "New" status badge for status=new', () => {
      render(<AdminFeedbackCard feedback={makeFeedback({ status: 'new' })} onRespond={vi.fn()} />);

      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  // ── Inline admin-response quote ────────────────────────────────────────────

  describe('Inline admin-response quote', () => {
    it('renders the response blockquote when admin_response is present', () => {
      const feedback = makeFeedback({
        admin_response: 'We fixed this in v2.3!',
        admin_response_at: '2026-02-01T12:00:00Z',
      });

      render(<AdminFeedbackCard feedback={feedback} onRespond={vi.fn()} />);

      const quote = screen.getByTestId('admin-feedback-response');
      expect(quote).toBeInTheDocument();
      expect(quote.textContent).toContain('We fixed this in v2.3!');
    });

    it('hides the response blockquote when admin_response is null', () => {
      render(
        <AdminFeedbackCard feedback={makeFeedback({ admin_response: null })} onRespond={vi.fn()} />
      );

      expect(screen.queryByTestId('admin-feedback-response')).not.toBeInTheDocument();
    });
  });

  // ── Click propagation ──────────────────────────────────────────────────────

  describe('Click propagation', () => {
    it('fires onRespond(item.id) when card body clickable area is clicked', async () => {
      const user = userEvent.setup();
      const onRespond = vi.fn();
      const feedback = makeFeedback({ id: 'click-test-id' });

      render(<AdminFeedbackCard feedback={feedback} onRespond={onRespond} />);

      const clickable = document.querySelector('.fb-card-clickable') as HTMLElement;
      await user.click(clickable);

      expect(onRespond).toHaveBeenCalledOnce();
      expect(onRespond).toHaveBeenCalledWith('click-test-id');
    });

    it('passes id (string), not the whole feedback object, to onRespond', async () => {
      const user = userEvent.setup();
      const onRespond = vi.fn();
      const feedback = makeFeedback({ id: 'id-check-001' });

      render(<AdminFeedbackCard feedback={feedback} onRespond={onRespond} />);

      const clickable = document.querySelector('.fb-card-clickable') as HTMLElement;
      await user.click(clickable);

      // onRespond receives a string id, not an object
      expect(typeof onRespond.mock.calls[0][0]).toBe('string');
      expect(onRespond.mock.calls[0][0]).toBe('id-check-001');
    });
  });

  // ── Author foot ────────────────────────────────────────────────────────────

  describe('Author foot', () => {
    it('renders Avatar and author name in the footer', () => {
      render(
        <AdminFeedbackCard
          feedback={makeFeedback({ author: { id: 'u1', full_name: 'Jane Doe' } })}
          onRespond={vi.fn()}
        />
      );

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('renders "Anonymous User" when author.full_name is null', () => {
      render(
        <AdminFeedbackCard
          feedback={makeFeedback({ author: { id: 'u1', full_name: null } })}
          onRespond={vi.fn()}
        />
      );

      expect(screen.getByText('Anonymous User')).toBeInTheDocument();
    });

    it('renders a relative time element in the footer', () => {
      render(<AdminFeedbackCard feedback={makeFeedback()} onRespond={vi.fn()} />);

      // date-fns formatDistanceToNow produces text like "X months ago"
      const footer = document.querySelector('.fb-card-foot');
      expect(footer).toBeInTheDocument();
      expect(footer?.textContent).toMatch(/ago/);
    });

    it('does NOT render a Device field anywhere in the card', () => {
      render(<AdminFeedbackCard feedback={makeFeedback()} onRespond={vi.fn()} />);

      expect(screen.queryByText(/device/i)).not.toBeInTheDocument();
    });
  });

  // ── Keyboard activation (a11y) ─────────────────────────────────────────────

  describe('Keyboard activation (a11y)', () => {
    it('Enter key on the clickable area fires onRespond', async () => {
      const user = userEvent.setup();
      const onRespond = vi.fn();
      const feedback = makeFeedback({ id: 'keyboard-test-id' });

      render(<AdminFeedbackCard feedback={feedback} onRespond={onRespond} />);

      const clickable = document.querySelector('.fb-card-clickable') as HTMLElement;
      clickable.focus();
      await user.keyboard('{Enter}');

      expect(onRespond).toHaveBeenCalledWith('keyboard-test-id');
    });

    it('Space key on the clickable area fires onRespond', async () => {
      const user = userEvent.setup();
      const onRespond = vi.fn();
      const feedback = makeFeedback({ id: 'space-test-id' });

      render(<AdminFeedbackCard feedback={feedback} onRespond={onRespond} />);

      const clickable = document.querySelector('.fb-card-clickable') as HTMLElement;
      clickable.focus();
      await user.keyboard(' ');

      expect(onRespond).toHaveBeenCalledWith('space-test-id');
    });

    it('clickable area has tabIndex=0 and role=button for a11y', () => {
      render(<AdminFeedbackCard feedback={makeFeedback()} onRespond={vi.fn()} />);

      const clickable = document.querySelector('.fb-card-clickable');
      expect(clickable).toHaveAttribute('role', 'button');
      expect(clickable).toHaveAttribute('tabindex', '0');
    });
  });

  // ── Card structure ─────────────────────────────────────────────────────────

  describe('Card structure', () => {
    it('renders the .fb-card article element with data-testid="admin-feedback-card"', () => {
      render(<AdminFeedbackCard feedback={makeFeedback()} onRespond={vi.fn()} />);

      expect(screen.getByTestId('admin-feedback-card')).toBeInTheDocument();
    });

    it('renders the card title in data-testid="admin-feedback-title"', () => {
      render(
        <AdminFeedbackCard feedback={makeFeedback({ title: 'My title' })} onRespond={vi.fn()} />
      );

      expect(screen.getByTestId('admin-feedback-title')).toHaveTextContent('My title');
    });

    it('renders the description in data-testid="admin-feedback-description"', () => {
      render(
        <AdminFeedbackCard
          feedback={makeFeedback({ description: 'My description text' })}
          onRespond={vi.fn()}
        />
      );

      expect(screen.getByTestId('admin-feedback-description')).toHaveTextContent(
        'My description text'
      );
    });
  });
});
