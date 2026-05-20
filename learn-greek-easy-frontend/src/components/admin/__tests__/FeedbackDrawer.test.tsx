// src/components/admin/__tests__/FeedbackDrawer.test.tsx
//
// Vitest + RTL unit tests for FeedbackDrawer (FBDR-10).
// Covers: Reply tab form, status picker, char counter, canned chips,
// save success/error, decorative buttons, Thread tab, Meta tab.

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { FeedbackDrawer } from '../FeedbackDrawer';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import type { AdminFeedbackItem } from '@/types/feedback';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Handle plural-aware likes key
      if (key === 'feedback.v2.drawer.likes') {
        const count = opts?.count as number | undefined;
        return `${count ?? 0} like${(count ?? 0) === 1 ? '' : 's'}`;
      }
      const map: Record<string, string> = {
        'feedback.anonymousUser': 'Anonymous User',
        'feedback.respond': 'Respond',
        'feedback.editResponse': 'Edit Response',
        // drawer meta rows
        'feedback.v2.drawer.meta.rows.user': 'User',
        'feedback.v2.drawer.meta.rows.type': 'Type',
        'feedback.v2.drawer.meta.rows.submitted': 'Submitted',
        'feedback.v2.drawer.meta.rows.likes': 'Likes',
        'feedback.v2.drawer.meta.rows.status': 'Status',
        'feedback.v2.drawer.meta.rows.responded': 'Responded',
        // drawer thread
        'feedback.v2.drawer.thread.empty': 'No admin response yet.',
        // drawer tabs
        'feedback.v2.drawer.tabs.reply': 'Reply',
        'feedback.v2.drawer.tabs.thread': 'Thread',
        'feedback.v2.drawer.tabs.meta': 'Meta',
        // drawer status
        'feedback.v2.drawer.status.new': 'New',
        'feedback.v2.drawer.status.investigating': 'Investigating',
        'feedback.v2.drawer.status.planned': 'Planned',
        'feedback.v2.drawer.status.in_progress': 'In progress',
        'feedback.v2.drawer.status.responded': 'Responded',
        'feedback.v2.drawer.status.shipped': 'Shipped',
        'feedback.v2.drawer.status.wont_fix': "Won't fix",
        'feedback.v2.drawer.status.duplicate': 'Duplicate',
        // drawer quick replies
        'feedback.v2.drawer.quickReplies.thanksNoted': 'Thanks — noted',
        'feedback.v2.drawer.quickReplies.plannedNext': 'Planned for next release',
        'feedback.v2.drawer.quickReplies.needInfo': 'Need more info',
        'feedback.v2.drawer.quickReplies.alreadyShipped': 'Already shipped',
        'feedback.v2.drawer.quickReplies.wontFix': "Won't fix — explain",
        'feedback.v2.drawer.quickRepliesGroup': 'Quick replies',
        'feedback.v2.drawer.responseHintSuffix': ' — public, learner will see this verbatim',
        'feedback.v2.drawer.saveNotice': opts?.name
          ? `Saving will notify ${opts.name} in-app`
          : 'Saving will notify the user in-app',
        'feedback.v2.drawer.theUser': 'the user',
        'feedback.v2.drawer.footer.ready': 'Ready',
        'feedback.v2.drawer.footer.noReplyYet': 'No reply yet',
        'feedback.v2.drawer.saving': 'Saving…',
        'feedback.v2.drawer.comingSoon': 'Coming soon',
        'feedback.v2.drawer.draftWithAi': '⚡ Draft with AI',
        'feedback.v2.drawer.admin': 'Admin',
        'feedback.v2.drawer.notFound': 'Feedback not found.',
        'feedback.v2.drawer.close': 'Close',
        'feedback.v2.drawer.title': 'Feedback details',
        'feedback.v2.drawer.headerPrefix': 'Feedback · #',
        // reply keys
        'feedback.v2.reply.status_label': 'Status',
        'feedback.v2.reply.status_hint': "What's the disposition of this request?",
        'feedback.v2.reply.response_label': 'Admin response',
        'feedback.v2.reply.save': 'Save & notify',
        'feedback.v2.reply.cancel': 'Cancel',
        'feedback.v2.reply.save_draft': 'Save draft',
        'feedback.v2.reply.saved': 'Reply saved',
        'feedback.v2.reply.save_error_title': 'Failed to save reply',
        'feedback.v2.reply.save_error_desc': 'Please try again.',
        // type
        'feedback.v2.type.bug': 'Bug',
        'feedback.v2.type.feature': 'Feature request',
        'feedback.v2.type.anonymous': 'Anonymous',
        'feedback.v2.card.openReply': opts?.title ? `Open reply for ${opts.title}` : 'Open reply',
        'feedback.v2.card.adminResponseLabel': 'Admin response',
        // delete
        'feedback.delete.button': 'Delete',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/stores/adminFeedbackStore', () => ({
  useAdminFeedbackStore: vi.fn(),
}));

// ── Toast spy ──────────────────────────────────────────────────────────────────

const mockToast = vi.fn();

// ── Fixture factory ────────────────────────────────────────────────────────────

function makeFeedback(overrides: Partial<AdminFeedbackItem> = {}): AdminFeedbackItem {
  return {
    id: 'fbdr-test-001',
    title: 'Dark mode please',
    description: 'It would be great to have a dark mode option.',
    category: 'feature_request',
    status: 'new',
    vote_count: 7,
    admin_response: null,
    admin_response_at: null,
    author: { id: 'user-1', full_name: 'Jane Doe' },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// ── Store mock helpers ─────────────────────────────────────────────────────────

const mockUpdateFeedback = vi.fn();
const mockCloseDrawer = vi.fn();

function mockStoreWith(feedback: AdminFeedbackItem) {
  const mockState = {
    feedbackList: [feedback],
    openFeedbackId: feedback.id,
    openInnerTab: 'reply' as const,
    updateFeedback: mockUpdateFeedback,
    closeDrawer: mockCloseDrawer,
  };

  (useAdminFeedbackStore as unknown as Mock).mockImplementation(
    (sel?: (s: typeof mockState) => unknown) =>
      typeof sel === 'function' ? sel(mockState) : mockState
  );
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderDrawer(
  feedbackId: string,
  innerTab: 'reply' | 'thread' | 'meta' = 'reply',
  onClose = vi.fn(),
  onInnerTabChange = vi.fn(),
  onRequestDelete = vi.fn()
) {
  return render(
    <TooltipProvider>
      <FeedbackDrawer
        feedbackId={feedbackId}
        innerTab={innerTab}
        onClose={onClose}
        onInnerTabChange={onInnerTabChange}
        onRequestDelete={onRequestDelete}
      />
    </TooltipProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('FeedbackDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Reply tab — form structure ─────────────────────────────────────────────

  describe('Reply tab — form structure', () => {
    it('renders user message card, status picker, response textarea, and canned chips', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      // User card shows title (also appears in enriched header h2, so use getAllByText)
      expect(screen.getAllByText('Dark mode please').length).toBeGreaterThanOrEqual(1);
      // All 8 status labels (some appear in both head badge and status picker — use getAllByText)
      expect(screen.getAllByText('New').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Investigating').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Responded').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Shipped').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Won't fix").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Duplicate').length).toBeGreaterThanOrEqual(1);
      // Textarea
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      // 5 canned chips
      expect(screen.getByText('Thanks — noted')).toBeInTheDocument();
      expect(screen.getByText('Planned for next release')).toBeInTheDocument();
      expect(screen.getByText('Need more info')).toBeInTheDocument();
      expect(screen.getByText('Already shipped')).toBeInTheDocument();
      expect(screen.getByText("Won't fix — explain")).toBeInTheDocument();
    });

    it('Save & notify button is present in the form footer', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      expect(screen.getByRole('button', { name: 'Save & notify' })).toBeInTheDocument();
    });
  });

  // ── Status picker grid ─────────────────────────────────────────────────────

  describe('Status picker grid (8 buttons)', () => {
    it('renders all 8 status buttons', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const statusBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('fb-status-btn'));
      expect(statusBtns).toHaveLength(8);
    });

    it('applies .is-active to the initially matched status button', () => {
      // status=new → handoff 'new' → first button should be active
      const feedback = makeFeedback({ status: 'new' });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const statusBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('fb-status-btn'));
      const newBtn = statusBtns.find((btn) => btn.textContent?.includes('New'));
      expect(newBtn).toHaveClass('is-active');
    });

    it('moves .is-active when a different status button is clicked', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new' });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const statusBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('fb-status-btn'));
      const plannedBtn = statusBtns.find((btn) => btn.textContent?.includes('Planned'));
      const newBtn = statusBtns.find((btn) => btn.textContent?.includes('New'));

      await user.click(plannedBtn!);

      expect(plannedBtn).toHaveClass('is-active');
      expect(newBtn).not.toHaveClass('is-active');
    });
  });

  // ── Char counter ───────────────────────────────────────────────────────────

  describe('Char counter', () => {
    it('shows 0/500 hint on mount when textarea is empty', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      // The hint text includes "0/500"
      expect(screen.getByText(/0\/500/)).toBeInTheDocument();
    });

    it('updates live as user types', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello there');

      // "Hello there" = 11 chars
      expect(screen.getByText(/11\/500/)).toBeInTheDocument();
    });

    it('initialises counter from existing admin_response', () => {
      const existing = 'Pre-existing response text'; // 26 chars
      const feedback = makeFeedback({ admin_response: existing });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      expect(screen.getByText(/26\/500/)).toBeInTheDocument();
    });

    it('enforces maxLength=500 on the textarea DOM attribute', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('maxlength', '500');
    });
  });

  // ── Canned-reply chips ─────────────────────────────────────────────────────

  describe('Canned-reply chips', () => {
    it('clicking a chip fills textarea with the canned text verbatim', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      await user.click(screen.getByText('Thanks — noted'));

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain("We've logged this");
    });

    it('clicking a chip overwrites an existing draft (replace, not append)', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: 'Old draft text' });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      await user.click(screen.getByText('Need more info'));

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).not.toContain('Old draft text');
      expect(textarea.value).toContain('device + OS version');
    });

    it('clicking different chips swaps the textarea content each time', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      await user.click(screen.getByText('Thanks — noted'));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const first = textarea.value;

      await user.click(screen.getByText('Already shipped'));
      expect(textarea.value).not.toBe(first);
      expect(textarea.value).toContain('latest version');
    });
  });

  // ── Save — success path ────────────────────────────────────────────────────

  describe('Save — success path', () => {
    it('calls store updateFeedback with mapped backend status + trimmed admin_response', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new', admin_response: null });
      const updated = makeFeedback({
        status: 'under_review',
        admin_response: 'Great suggestion!',
      });
      mockUpdateFeedback.mockResolvedValueOnce(updated);
      mockStoreWith(feedback);

      const onClose = vi.fn();
      renderDrawer(feedback.id, 'reply', onClose);

      // Type a response so something actually changes
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Great suggestion!');

      // Also change status to 'responded' (maps to 'under_review')
      const statusBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('fb-status-btn'));
      const respondedBtn = statusBtns.find((btn) => btn.textContent?.includes('Responded'))!;
      await user.click(respondedBtn);

      await user.click(screen.getByRole('button', { name: 'Save & notify' }));

      await waitFor(() => {
        expect(mockUpdateFeedback).toHaveBeenCalledWith(
          feedback.id,
          expect.objectContaining({
            status: 'under_review',
            admin_response: 'Great suggestion!',
          })
        );
      });
    });

    it('closes the drawer on resolve', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new', admin_response: null });
      const updated = makeFeedback({ admin_response: 'Done!' });
      mockUpdateFeedback.mockResolvedValueOnce(updated);
      mockStoreWith(feedback);

      const onClose = vi.fn();
      renderDrawer(feedback.id, 'reply', onClose);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Done!');
      await user.click(screen.getByRole('button', { name: 'Save & notify' }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it('shows success toast after save', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new', admin_response: null });
      mockUpdateFeedback.mockResolvedValueOnce(makeFeedback({ admin_response: 'Done!' }));
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply', vi.fn());

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Done!');
      await user.click(screen.getByRole('button', { name: 'Save & notify' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reply saved' }));
      });
    });
  });

  // ── Save — error path ──────────────────────────────────────────────────────

  describe('Save — error path', () => {
    it('shows a destructive toast when updateFeedback rejects', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new', admin_response: null });
      mockUpdateFeedback.mockRejectedValueOnce(new Error('Network error'));
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply', vi.fn());

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some response');
      await user.click(screen.getByRole('button', { name: 'Save & notify' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to save reply',
            variant: 'destructive',
          })
        );
      });
    });

    it('keeps the drawer open (does NOT call onClose) when updateFeedback rejects', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ status: 'new', admin_response: null });
      mockUpdateFeedback.mockRejectedValueOnce(new Error('Server error'));
      mockStoreWith(feedback);

      const onClose = vi.fn();
      renderDrawer(feedback.id, 'reply', onClose);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some response');
      await user.click(screen.getByRole('button', { name: 'Save & notify' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Decorative buttons ─────────────────────────────────────────────────────

  describe('Decorative buttons (Save draft, Draft with AI)', () => {
    it('Save draft button has aria-disabled="true"', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const saveDraftBtn = screen.getByRole('button', { name: 'Save draft' });
      expect(saveDraftBtn).toHaveAttribute('aria-disabled', 'true');
    });

    it('Draft with AI button has aria-disabled="true"', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const draftAiBtn = screen.getByRole('button', { name: /Draft with AI/i });
      expect(draftAiBtn).toHaveAttribute('aria-disabled', 'true');
    });

    it('clicking Save draft does not fire updateFeedback', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      await user.click(screen.getByRole('button', { name: 'Save draft' }));

      expect(mockUpdateFeedback).not.toHaveBeenCalled();
    });

    it('clicking Draft with AI does not fire updateFeedback', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      await user.click(screen.getByRole('button', { name: /Draft with AI/i }));

      expect(mockUpdateFeedback).not.toHaveBeenCalled();
    });
  });

  // ── Thread tab ─────────────────────────────────────────────────────────────

  describe('Thread tab', () => {
    function mockStoreForThread(feedback: AdminFeedbackItem) {
      const mockState = {
        feedbackList: [feedback],
        openFeedbackId: feedback.id,
        openInnerTab: 'thread' as const,
        updateFeedback: mockUpdateFeedback,
        closeDrawer: mockCloseDrawer,
      };
      (useAdminFeedbackStore as unknown as Mock).mockImplementation(
        (sel?: (s: typeof mockState) => unknown) =>
          typeof sel === 'function' ? sel(mockState) : mockState
      );
    }

    it('renders user bubble always', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreForThread(feedback);

      renderDrawer(feedback.id, 'thread');

      // User bubble contains the description
      expect(screen.getByText('It would be great to have a dark mode option.')).toBeInTheDocument();
    });

    it('does not render admin bubble when admin_response is null', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreForThread(feedback);

      renderDrawer(feedback.id, 'thread');

      // Admin bubble has class fb-thread-bubble--admin — should not exist
      const adminBubbles = document.querySelectorAll('.fb-thread-bubble--admin');
      expect(adminBubbles).toHaveLength(0);
    });

    it('renders admin bubble when admin_response is present', () => {
      const feedback = makeFeedback({
        admin_response: 'We fixed this!',
        admin_response_at: '2026-02-01T12:00:00Z',
      });
      mockStoreForThread(feedback);

      renderDrawer(feedback.id, 'thread');

      const adminBubbles = document.querySelectorAll('.fb-thread-bubble--admin');
      expect(adminBubbles).toHaveLength(1);
      expect(adminBubbles[0].textContent).toContain('We fixed this!');
    });

    it('renders empty-state copy when admin_response is null', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreForThread(feedback);

      renderDrawer(feedback.id, 'thread');

      expect(screen.getByText('No admin response yet.')).toBeInTheDocument();
    });
  });

  // ── Meta tab ──────────────────────────────────────────────────────────────

  describe('Meta tab', () => {
    function mockStoreForMeta(feedback: AdminFeedbackItem) {
      const mockState = {
        feedbackList: [feedback],
        openFeedbackId: feedback.id,
        openInnerTab: 'meta' as const,
        updateFeedback: mockUpdateFeedback,
        closeDrawer: mockCloseDrawer,
      };
      (useAdminFeedbackStore as unknown as Mock).mockImplementation(
        (sel?: (s: typeof mockState) => unknown) =>
          typeof sel === 'function' ? sel(mockState) : mockState
      );
    }

    it('renders 5 rows when admin_response is null', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreForMeta(feedback);

      renderDrawer(feedback.id, 'meta');

      const rows = document.querySelectorAll('.fb-meta-row');
      expect(rows).toHaveLength(5);
    });

    it('renders 6 rows when admin_response is present', () => {
      const feedback = makeFeedback({
        admin_response: 'Fixed!',
        admin_response_at: '2026-02-01T12:00:00Z',
      });
      mockStoreForMeta(feedback);

      renderDrawer(feedback.id, 'meta');

      const rows = document.querySelectorAll('.fb-meta-row');
      expect(rows).toHaveLength(6);
    });

    it('renders Status row with a Badge', () => {
      const feedback = makeFeedback({ status: 'planned' });
      mockStoreForMeta(feedback);

      renderDrawer(feedback.id, 'meta');

      expect(screen.getByText('Status')).toBeInTheDocument();
      // The 'Planned' Badge should be visible (may also appear in the enriched head)
      expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(1);
    });

    it('has no Device row', () => {
      const feedback = makeFeedback();
      mockStoreForMeta(feedback);

      renderDrawer(feedback.id, 'meta');

      expect(screen.queryByText('Device')).not.toBeInTheDocument();
    });
  });

  // ── Save & notify guard ────────────────────────────────────────────────────

  describe('Save & notify guard', () => {
    it('Save & notify is disabled when textarea is empty', () => {
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const saveBtn = screen.getByRole('button', { name: 'Save & notify' });
      expect(saveBtn).toBeDisabled();
    });

    it('Save & notify becomes enabled after typing in the textarea', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const saveBtn = screen.getByRole('button', { name: 'Save & notify' });
      expect(saveBtn).toBeDisabled();

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some text');

      expect(saveBtn).not.toBeDisabled();
    });

    it('Save & notify remains disabled when textarea contains only whitespace', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback({ admin_response: null });
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');

      const saveBtn = screen.getByRole('button', { name: 'Save & notify' });
      expect(saveBtn).toBeDisabled();
    });
  });

  // ── Delete button ──────────────────────────────────────────────────────────

  describe('Delete button in reply footer', () => {
    it('renders a Delete button in the reply tab footer', () => {
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      renderDrawer(feedback.id, 'reply');

      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });

    it('clicking Delete calls onRequestDelete with the feedback id', async () => {
      const user = userEvent.setup();
      const feedback = makeFeedback();
      mockStoreWith(feedback);

      const onRequestDelete = vi.fn();
      renderDrawer(feedback.id, 'reply', vi.fn(), vi.fn(), onRequestDelete);

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      expect(onRequestDelete).toHaveBeenCalledWith(feedback.id);
    });
  });
});
