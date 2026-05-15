// src/components/admin/FeedbackDrawer.tsx
//
// Shell component for the ADMIN2-05 Feedback Drawer.
// Inner tab content is implemented in subsequent subtasks:
//   FBDR-04 → Reply tab (this file)
//   FBDR-05 → Thread tab
//   FBDR-06 → Meta tab
// URL deep-link wiring (useSearchParams) is implemented in FBDR-09.

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import { backendToHandoff, handoffToBackend, HANDOFF_STATUSES } from './feedbackStatusMap';

import type { HandoffStatus } from './feedbackStatusMap';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeedbackDrawerInnerTab = 'reply' | 'thread' | 'meta';

export interface FeedbackDrawerProps {
  feedbackId: string;
  innerTab: FeedbackDrawerInnerTab;
  onClose: () => void;
  onInnerTabChange: (tab: FeedbackDrawerInnerTab) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { value: FeedbackDrawerInnerTab; label: string }[] = [
  { value: 'reply', label: 'Reply' },
  { value: 'thread', label: 'Thread' },
  { value: 'meta', label: 'Meta' },
];

// Tones for the .fb-status-dot CSS (data-tone attribute values defined in index.css)
type DotTone = 'primary' | 'amber' | 'violet' | 'cyan' | 'success' | 'gray';

const STATUS_PICKER: ReadonlyArray<{ key: HandoffStatus; label: string; dotTone: DotTone }> = [
  { key: 'new', label: 'New', dotTone: 'primary' },
  { key: 'investigating', label: 'Investigating', dotTone: 'amber' },
  { key: 'planned', label: 'Planned', dotTone: 'violet' },
  { key: 'in_progress', label: 'In progress', dotTone: 'cyan' },
  { key: 'responded', label: 'Responded', dotTone: 'success' },
  { key: 'shipped', label: 'Shipped', dotTone: 'success' },
  { key: 'wont_fix', label: "Won't fix", dotTone: 'gray' },
  { key: 'duplicate', label: 'Duplicate', dotTone: 'gray' },
] as const;

const QUICK_REPLIES: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: 'Thanks — noted',
    text: "Thanks for the report! We've logged this — will update you when it's looked at.",
  },
  {
    label: 'Planned for next release',
    text: "This is on the roadmap for the next minor release. We'll ping you when it ships.",
  },
  {
    label: 'Need more info',
    text: 'Could you share the device + OS version, and which screen this happened on? That helps us reproduce.',
  },
  {
    label: 'Already shipped',
    text: 'Good news — this was actually shipped in the latest version. Try pulling the latest update and let us know if it works for you.',
  },
  {
    label: "Won't fix — explain",
    text: "Thank you for the suggestion. We won't be making this change because [reason]. Sorry for any inconvenience.",
  },
];

// ── Zod schema ─────────────────────────────────────────────────────────────────

const HANDOFF_STATUS_VALUES = HANDOFF_STATUSES as unknown as readonly [
  HandoffStatus,
  ...HandoffStatus[],
];

const replyFormSchema = z.object({
  status: z.enum(HANDOFF_STATUS_VALUES),
  admin_response: z.string().max(500, 'Response cannot exceed 500 characters'),
});

type ReplyFormValues = z.infer<typeof replyFormSchema>;

// ── Reply tab form ─────────────────────────────────────────────────────────────

interface ReplyTabProps {
  feedbackId: string;
  onClose: () => void;
}

function ReplyTab({ feedbackId, onClose }: ReplyTabProps) {
  const { toast } = useToast();

  // Grab state from store
  const feedbackList = useAdminFeedbackStore((s) => s.feedbackList);
  const updateFeedback = useAdminFeedbackStore((s) => s.updateFeedback);

  const feedback = feedbackList.find((f) => f.id === feedbackId) ?? null;

  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: {
      status: feedback ? backendToHandoff(feedback.status) : 'new',
      admin_response: feedback?.admin_response ?? '',
    },
    mode: 'onChange',
  });

  const responseValue = form.watch('admin_response');
  const charCount = responseValue.length;
  const selectedStatus = form.watch('status');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!feedback) {
    return <div className="p-4 text-sm text-muted-foreground">Feedback not found.</div>;
  }

  async function handleSave(values: ReplyFormValues) {
    if (!feedback) return;

    const backendStatus = handoffToBackend(values.status);
    const trimmed = values.admin_response.trim();

    const statusChanged = backendStatus !== feedback.status;
    const responseChanged = trimmed !== (feedback.admin_response ?? '');

    if (!statusChanged && !responseChanged) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      await updateFeedback(feedback.id, {
        ...(statusChanged ? { status: backendStatus } : {}),
        ...(responseChanged ? { admin_response: trimmed || undefined } : {}),
      });
      onClose();
      toast({ title: 'Reply saved' });
    } catch (err) {
      toast({
        title: 'Failed to save reply',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      // Drawer stays open — do NOT call onClose
    } finally {
      setIsSubmitting(false);
    }
  }

  const footerBadgeTone: BadgeTone = responseValue.trim() ? 'green' : 'gray';
  const footerBadgeLabel = responseValue.trim() ? 'Ready' : 'No reply yet';

  return (
    <>
      <SidePanel.Body>
        {/* User submission summary */}
        <div className="fb-user-card">
          <p className="fb-user-card-title">{feedback.title}</p>
          {feedback.description && <p className="fb-user-card-desc">{feedback.description}</p>}
          <p className="fb-user-card-meta">
            {feedback.author?.full_name ?? 'Anonymous'} ·{' '}
            {new Date(feedback.created_at).toLocaleDateString()}
          </p>
        </div>

        <form id="reply-form" onSubmit={form.handleSubmit(handleSave)} noValidate>
          <Field label="Status" hint="What's the disposition of this request?">
            <div className="fb-status-grid">
              {STATUS_PICKER.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={cn('fb-status-btn', { 'is-active': selectedStatus === s.key })}
                  aria-pressed={selectedStatus === s.key}
                  onClick={() => form.setValue('status', s.key, { shouldDirty: true })}
                >
                  <span className="fb-status-dot" data-tone={s.dotTone} />
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Admin response"
            hint={`${charCount}/500 — public, learner will see this verbatim`}
          >
            <Textarea rows={6} maxLength={500} {...form.register('admin_response')} />
          </Field>

          <div className="fb-canned-list" role="group" aria-label="Quick replies">
            {QUICK_REPLIES.map((r) => (
              <button
                key={r.label}
                type="button"
                className="fb-canned-btn"
                onClick={() =>
                  form.setValue('admin_response', r.text, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </form>
      </SidePanel.Body>

      <SidePanel.Footer>
        <div className="flex flex-1 items-center gap-2">
          <Badge tone={footerBadgeTone}>{footerBadgeLabel}</Badge>
          <span className="text-sm text-muted-foreground">
            Saving will notify {feedback.author?.full_name ?? 'the user'} in-app
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          {/* Decorative — Coming soon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-60 hover:bg-accent hover:text-accent-foreground"
                onClick={(e) => e.preventDefault()}
                title="Coming soon"
              >
                Save draft
              </button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>

          <Button type="submit" form="reply-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save & notify'}
          </Button>
        </div>
      </SidePanel.Footer>
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FeedbackDrawer({
  feedbackId,
  innerTab,
  onClose,
  onInnerTabChange,
}: FeedbackDrawerProps) {
  return (
    <SidePanel
      size="default"
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      data-testid="feedback-drawer"
    >
      <SidePanel.CloseButton onClick={onClose} />

      <SidePanel.Header>
        <div className="text-sm text-muted-foreground">Feedback · #{feedbackId.slice(0, 8)}</div>
      </SidePanel.Header>

      <SidePanel.Tabs>
        <div className="drawer-tab-group" role="tablist">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={innerTab === value}
              className={innerTab === value ? 'drawer-tab is-active' : 'drawer-tab'}
              onClick={() => onInnerTabChange(value)}
              data-testid={`feedback-drawer-tab-${value}`}
            >
              {label}
            </button>
          ))}

          {/* Decorative — Draft with AI (Coming soon) */}
          <div className="drawer-tabs-spacer" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                className="drawer-tab cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
                title="Coming soon"
              >
                ⚡ Draft with AI
              </button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </div>
      </SidePanel.Tabs>

      {innerTab === 'reply' && <ReplyTab feedbackId={feedbackId} onClose={onClose} />}

      {innerTab === 'thread' && (
        <>
          <SidePanel.Body>
            <div data-testid="drawer-tab-thread">Thread tab — implemented in FBDR-05</div>
          </SidePanel.Body>
          <SidePanel.Footer>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </SidePanel.Footer>
        </>
      )}

      {innerTab === 'meta' && (
        <>
          <SidePanel.Body>
            <div data-testid="drawer-tab-meta">Meta tab — implemented in FBDR-06</div>
          </SidePanel.Body>
          <SidePanel.Footer>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </SidePanel.Footer>
        </>
      )}
    </SidePanel>
  );
}
