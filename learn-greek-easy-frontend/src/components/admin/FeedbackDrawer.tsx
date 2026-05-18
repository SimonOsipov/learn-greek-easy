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
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { initialsOf } from '@/lib/userUtils';
import { cn } from '@/lib/utils';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import {
  backendToHandoff,
  handoffToBackend,
  BACKEND_TO_HANDOFF,
  HANDOFF_STATUSES,
  STATUS_TONE,
} from './feedbackStatusMap';

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

// STATUS_TONE is imported from ./feedbackStatusMap (single source of truth)

// Derived from STATUS_PICKER — single source of truth for status display labels.
const HANDOFF_LABEL = Object.fromEntries(STATUS_PICKER.map((s) => [s.key, s.label])) as Record<
  HandoffStatus,
  string
>;

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
        ...(responseChanged ? { admin_response: trimmed } : {}),
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
            hint={
              <>
                <span data-testid="feedback-drawer-char-counter">{charCount}/500</span>
                {' — public, learner will see this verbatim'}
              </>
            }
          >
            <Textarea
              rows={6}
              maxLength={500}
              data-testid="feedback-drawer-textarea"
              {...form.register('admin_response')}
            />
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

// ── Thread tab helpers ─────────────────────────────────────────────────────────

function getDateLocale() {
  // Read language from document to avoid coupling to a hook at module scope.
  // Full locale wiring (i18n.language) lands in FBDR-08.
  const lang = document.documentElement.lang ?? '';
  if (lang === 'el') return el;
  if (lang === 'ru') return ru;
  return undefined;
}

// ── Thread tab component ───────────────────────────────────────────────────────

interface ThreadTabProps {
  feedbackId: string;
}

function ThreadTab({ feedbackId }: ThreadTabProps) {
  const { t } = useTranslation('admin');

  const feedbackList = useAdminFeedbackStore((s) => s.feedbackList);
  const item = feedbackList.find((f) => f.id === feedbackId) ?? null;

  if (!item) {
    return <div className="p-4 text-sm text-muted-foreground">Feedback not found.</div>;
  }

  const hasAdminResponse = Boolean(item.admin_response && item.admin_response.trim());

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* User bubble — always rendered */}
      <article className="fb-thread-bubble fb-thread-bubble--user">
        <header className="mb-2 flex items-center gap-2">
          <AdminAvatar initials={initialsOf(item.author?.full_name)} size="sm" />
          <span className="text-sm font-medium">
            {item.author?.full_name || t('feedback.anonymousUser')}
          </span>
          <time className="ml-auto text-xs text-muted-foreground" dateTime={item.created_at}>
            {formatDistanceToNow(new Date(item.created_at), {
              addSuffix: true,
              locale: getDateLocale(),
            })}
          </time>
        </header>
        <p className="text-sm">{item.description}</p>
      </article>

      {/* Admin bubble — only when admin_response is present */}
      {hasAdminResponse ? (
        <article className="fb-thread-bubble fb-thread-bubble--admin">
          <header className="mb-2 flex items-center gap-2">
            {/* Hardcoded per ADMIN2-05 Design Decision: backend does not track admin_response_by_user_id. */}
            <AdminAvatar initials="A" tone="primary" size="sm" />
            <span className="text-sm font-medium">Admin</span>
            <Badge tone="blue">Admin</Badge>
            {item.admin_response_at ? (
              <time
                className="ml-auto text-xs text-muted-foreground"
                dateTime={item.admin_response_at}
              >
                {formatDistanceToNow(new Date(item.admin_response_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </time>
            ) : null}
          </header>
          <p className="text-sm">{item.admin_response}</p>
        </article>
      ) : (
        <div className="fb-thread-empty">{t('feedback.v2.drawer.thread.empty')}</div>
      )}
    </div>
  );
}

// ── Meta tab component ─────────────────────────────────────────────────────────

interface MetaTabProps {
  feedbackId: string;
}

function MetaTab({ feedbackId }: MetaTabProps) {
  const { t } = useTranslation('admin');
  const feedbackList = useAdminFeedbackStore((s) => s.feedbackList);
  const item = feedbackList.find((f) => f.id === feedbackId) ?? null;

  if (!item) {
    return <div className="p-4 text-sm text-muted-foreground">Feedback not found.</div>;
  }

  const handoff = BACKEND_TO_HANDOFF[item.status];

  return (
    <div className="fb-meta-table" role="list" aria-label="Feedback metadata">
      {/* Row 1: User */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.user')}</span>
        <span className="fb-meta-v">
          {item.author?.full_name || t('feedback.v2.type.anonymous')}
        </span>
      </div>

      {/* Row 2: Type */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.type')}</span>
        <span className="fb-meta-v">
          {item.category === 'bug_incorrect_data'
            ? t('feedback.v2.type.bug')
            : t('feedback.v2.type.feature')}
        </span>
      </div>

      {/* Row 3: Submitted */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.submitted')}</span>
        <span className="fb-meta-v">
          {formatDistanceToNow(new Date(item.created_at), {
            addSuffix: true,
            locale: getDateLocale(),
          })}
        </span>
      </div>

      {/* Row 4: Likes */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.likes')}</span>
        <span className="fb-meta-v">{item.vote_count}</span>
      </div>

      {/* Row 5: Status — Badge via tone API */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.status')}</span>
        <span className="fb-meta-v">
          <Badge tone={STATUS_TONE[handoff]}>{HANDOFF_LABEL[handoff]}</Badge>
        </span>
      </div>

      {/* Row 6 (conditional): Responded — only when admin_response is present */}
      {item.admin_response ? (
        <div className="fb-meta-row" role="listitem">
          <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.responded')}</span>
          <span className="fb-meta-v">
            {formatDistanceToNow(new Date(item.admin_response_at ?? item.created_at), {
              addSuffix: true,
              locale: getDateLocale(),
            })}{' '}
            · Admin
          </span>
        </div>
      ) : null}
    </div>
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
      title="Feedback details"
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
          <SidePanel.Body data-testid="drawer-tab-thread">
            <ThreadTab feedbackId={feedbackId} />
          </SidePanel.Body>
          <SidePanel.Footer>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </SidePanel.Footer>
        </>
      )}

      {innerTab === 'meta' && (
        <>
          <SidePanel.Body data-testid="drawer-tab-meta">
            <MetaTab feedbackId={feedbackId} />
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
