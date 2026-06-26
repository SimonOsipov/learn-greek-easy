// src/components/admin/FeedbackDrawer.tsx
//
// Shell component for the ADMIN2-05 Feedback Drawer.
// Inner tab content is implemented in subsequent subtasks:
//   FBDR-04 → Reply tab (this file)
//   FBDR-06 → Meta tab
// URL deep-link wiring (useSearchParams) is implemented in FBDR-09.

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format, formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { Check, Copy, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { tDynamic } from '@/i18n/tDynamic';
import { initialsOf } from '@/lib/userUtils';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import {
  backendToHandoff,
  handoffToBackend,
  BACKEND_TO_HANDOFF,
  CATEGORY_TONE,
  HANDOFF_STATUSES,
  STATUS_TONE,
} from './feedbackStatusMap';
import { MetaTable } from './MetaTable';
import { StatusGrid } from './StatusGrid';

import type { HandoffStatus } from './feedbackStatusMap';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeedbackDrawerInnerTab = 'reply' | 'meta';

export interface FeedbackDrawerProps {
  feedbackId: string;
  innerTab: FeedbackDrawerInnerTab;
  onClose: () => void;
  onInnerTabChange: (tab: FeedbackDrawerInnerTab) => void;
  onRequestDelete: (id: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

// Labels are i18n keys — translated at render via t(label)
const TABS: { value: FeedbackDrawerInnerTab; label: string }[] = [
  { value: 'reply', label: 'feedback.v2.drawer.tabs.reply' },
  { value: 'meta', label: 'feedback.v2.drawer.tabs.meta' },
];

// Tones for the .admin-status-dot CSS (data-tone attribute values defined in index.css)
type DotTone = 'primary' | 'amber' | 'violet' | 'cyan' | 'success' | 'gray';

// Labels are i18n keys — translated at render via t(s.label)
const STATUS_PICKER: ReadonlyArray<{ key: HandoffStatus; label: string; dotTone: DotTone }> = [
  { key: 'new', label: 'feedback.v2.drawer.status.new', dotTone: 'primary' },
  { key: 'investigating', label: 'feedback.v2.drawer.status.investigating', dotTone: 'amber' },
  { key: 'planned', label: 'feedback.v2.drawer.status.planned', dotTone: 'violet' },
  { key: 'in_progress', label: 'feedback.v2.drawer.status.in_progress', dotTone: 'cyan' },
  { key: 'responded', label: 'feedback.v2.drawer.status.responded', dotTone: 'success' },
  { key: 'shipped', label: 'feedback.v2.drawer.status.shipped', dotTone: 'success' },
  { key: 'wont_fix', label: 'feedback.v2.drawer.status.wont_fix', dotTone: 'gray' },
  { key: 'duplicate', label: 'feedback.v2.drawer.status.duplicate', dotTone: 'gray' },
] as const;

// STATUS_TONE is imported from ./feedbackStatusMap (single source of truth)

// Derived from STATUS_PICKER — keys for status display labels (translated at render via t(...))
const HANDOFF_LABEL = Object.fromEntries(STATUS_PICKER.map((s) => [s.key, s.label])) as Record<
  HandoffStatus,
  string
>;

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

// ── Date locale helper ─────────────────────────────────────────────────────────

function getDateLocale(lang: string) {
  if (lang === 'el') return el;
  if (lang === 'ru') return ru;
  return undefined;
}

// ── Reply tab form ─────────────────────────────────────────────────────────────

interface ReplyTabProps {
  feedbackId: string;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
  form: ReturnType<typeof useForm<ReplyFormValues>>;
}

function ReplyTab({ feedbackId, onClose, onRequestDelete, form }: ReplyTabProps) {
  const { t, i18n } = useTranslation('admin');
  const { toast } = useToast();

  // Grab state from store
  const feedbackList = useAdminFeedbackStore((s) => s.feedbackList);
  const updateFeedback = useAdminFeedbackStore((s) => s.updateFeedback);

  const feedback = feedbackList.find((f) => f.id === feedbackId) ?? null;

  const responseValue = form.watch('admin_response');
  const charCount = responseValue.length;
  const selectedStatus = form.watch('status');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!feedback) {
    return (
      <div className="p-4 text-sm text-muted-foreground">{t('feedback.v2.drawer.notFound')}</div>
    );
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
      toast({ title: t('feedback.v2.reply.saved') });
    } catch (err) {
      toast({
        title: t('feedback.v2.reply.save_error_title'),
        description: err instanceof Error ? err.message : t('feedback.v2.reply.save_error_desc'),
        variant: 'destructive',
      });
      // Drawer stays open — do NOT call onClose
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <SidePanel.Body>
        {/* Original submission — CD chat bubble (.fb-thread / .fb-msg) */}
        <div className="fb-thread fb-thread-compact">
          <div className="fb-msg fb-msg-user">
            <AdminAvatar initials={initialsOf(feedback.author?.full_name)} size="sm" />
            <div className="fb-msg-body">
              <div className="fb-msg-meta">
                <span className="fb-msg-who">
                  {feedback.author?.full_name ?? t('feedback.v2.type.anonymous')}
                </span>
                <span className="fb-msg-when">
                  {format(new Date(feedback.created_at), 'PP', {
                    locale: getDateLocale(i18n.language),
                  })}
                </span>
              </div>
              <p className="fb-msg-text">{feedback.description || feedback.title}</p>
            </div>
          </div>
        </div>

        <form id="reply-form" onSubmit={form.handleSubmit(handleSave)} noValidate>
          <div className="dr-fields">
            <Field
              label={t('feedback.v2.reply.status_label')}
              hint={t('feedback.v2.reply.status_hint')}
            >
              <StatusGrid
                options={STATUS_PICKER.map((s) => ({ ...s, label: tDynamic(t, s.label) }))}
                value={selectedStatus}
                onChange={(next) => form.setValue('status', next, { shouldDirty: true })}
              />
            </Field>

            <Field
              label={t('feedback.v2.reply.response_label')}
              hint={
                <>
                  <span data-testid="feedback-drawer-char-counter">{charCount}/500</span>
                  {t('feedback.v2.drawer.responseHintSuffix')}
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
          </div>
        </form>
      </SidePanel.Body>

      <SidePanel.Footer>
        {/* Left: Delete (destructive) */}
        <div className="drawer-foot-left">
          <button
            type="button"
            className="btn btn-glass btn-sm danger-text"
            onClick={() => onRequestDelete(feedback.id)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t('feedback.delete.button')}
          </button>
        </div>

        {/* Right: safe actions */}
        <div className="drawer-foot-right">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('feedback.v2.reply.cancel')}
          </button>

          <button
            type="submit"
            form="reply-form"
            className="btn btn-primary btn-sm"
            disabled={isSubmitting || !responseValue.trim()}
          >
            <Check className="size-4" aria-hidden="true" />
            {isSubmitting ? t('feedback.v2.drawer.saving') : t('feedback.v2.reply.save')}
          </button>
        </div>
      </SidePanel.Footer>
    </>
  );
}

// ── Meta tab component ─────────────────────────────────────────────────────────

interface MetaTabProps {
  feedbackId: string;
}

function MetaTab({ feedbackId }: MetaTabProps) {
  const { t, i18n } = useTranslation('admin');
  const feedbackList = useAdminFeedbackStore((s) => s.feedbackList);
  const item = feedbackList.find((f) => f.id === feedbackId) ?? null;

  if (!item) {
    return (
      <div className="p-4 text-sm text-muted-foreground">{t('feedback.v2.drawer.notFound')}</div>
    );
  }

  const handoff = BACKEND_TO_HANDOFF[item.status];

  const metaRows = [
    {
      label: t('feedback.v2.drawer.meta.rows.user'),
      value: item.author?.full_name || t('feedback.v2.type.anonymous'),
    },
    {
      label: t('feedback.v2.drawer.meta.rows.type'),
      value:
        item.category === 'bug_incorrect_data'
          ? t('feedback.v2.type.bug')
          : t('feedback.v2.type.feature'),
    },
    {
      label: t('feedback.v2.drawer.meta.rows.submitted'),
      value: (
        <>
          {format(new Date(item.created_at), 'PP', { locale: getDateLocale(i18n.language) })} (
          {formatDistanceToNow(new Date(item.created_at), {
            addSuffix: true,
            locale: getDateLocale(i18n.language),
          })}
          )
        </>
      ),
    },
    // TODO(feedback-device): add device row once Feedback.device is on the model
    { label: t('feedback.v2.drawer.meta.rows.likes'), value: item.vote_count },
    {
      label: t('feedback.v2.drawer.meta.rows.status'),
      value: <Badge tone={STATUS_TONE[handoff]}>{tDynamic(t, HANDOFF_LABEL[handoff])}</Badge>,
    },
    ...(item.admin_response
      ? [
          {
            label: t('feedback.v2.drawer.meta.rows.responded'),
            value: (
              <>
                {formatDistanceToNow(new Date(item.admin_response_at ?? item.created_at), {
                  addSuffix: true,
                  locale: getDateLocale(i18n.language),
                })}{' '}
                · {t('feedback.v2.drawer.admin')}
              </>
            ),
          },
        ]
      : []),
  ];

  return <MetaTable rows={metaRows} ariaLabel="Feedback metadata" />;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FeedbackDrawer({
  feedbackId,
  innerTab,
  onClose,
  onInnerTabChange,
  onRequestDelete,
}: FeedbackDrawerProps) {
  const { t, i18n } = useTranslation('admin');
  const { toast } = useToast();

  const feedback = useAdminFeedbackStore((s) => s.feedbackList.find((f) => f.id === feedbackId));

  // Hoist useForm here so the header badge reads live form state (not stale feedback.status)
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: {
      status: feedback ? backendToHandoff(feedback.status) : 'new',
      admin_response: feedback?.admin_response ?? '',
    },
    mode: 'onChange',
  });

  const selectedStatus = form.watch('status');

  return (
    <SidePanel
      size="half"
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      data-testid="feedback-drawer"
      title={t('feedback.v2.drawer.title')}
    >
      <SidePanel.CloseButton position="right" onClick={onClose} />

      <SidePanel.Header>
        {feedback ? (
          <div className="drawer-head-content">
            <div className="drawer-bcrumb">
              {t('feedback.v2.drawer.headerPrefix')}
              <code>{feedback.id.slice(0, 8)}…</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(feedback.id);
                  toast({ title: t('feedback.v2.drawer.idCopied') });
                }}
                data-testid="feedback-drawer-copy-id"
                aria-label={t('feedback.v2.drawer.idCopyAria')}
              >
                <Copy className="size-3.5" aria-hidden="true" />
              </button>{' '}
              ·{' '}
              {format(new Date(feedback.created_at), 'PP', {
                locale: getDateLocale(i18n.language),
              })}
            </div>
            <div className="drawer-head-row">
              <h2 className="drawer-h">{feedback.title}</h2>
              <Badge tone={CATEGORY_TONE[feedback.category]}>
                {feedback.category === 'bug_incorrect_data'
                  ? t('feedback.v2.type.bug')
                  : t('feedback.v2.type.feature')}
              </Badge>
              <Badge tone={STATUS_TONE[selectedStatus]}>
                {tDynamic(t, HANDOFF_LABEL[selectedStatus])}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('feedback.v2.drawer.likes', { count: feedback.vote_count })}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {`${t('feedback.v2.drawer.headerPrefix')}${feedbackId}`}
          </div>
        )}
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
              {tDynamic(t, label)}
            </button>
          ))}
        </div>
      </SidePanel.Tabs>

      {innerTab === 'reply' && (
        <ReplyTab
          feedbackId={feedbackId}
          onClose={onClose}
          onRequestDelete={onRequestDelete}
          form={form}
        />
      )}

      {innerTab === 'meta' && (
        <>
          <SidePanel.Body data-testid="drawer-tab-meta">
            <MetaTab feedbackId={feedbackId} />
          </SidePanel.Body>
          <SidePanel.Footer>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              {t('feedback.v2.reply.cancel')}
            </button>
          </SidePanel.Footer>
        </>
      )}
    </SidePanel>
  );
}
