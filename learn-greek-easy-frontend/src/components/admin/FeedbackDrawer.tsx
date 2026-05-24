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
import { Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import {
  backendToHandoff,
  handoffToBackend,
  BACKEND_TO_HANDOFF,
  CATEGORY_TONE,
  HANDOFF_STATUSES,
  STATUS_TONE,
} from './feedbackStatusMap';
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

  const footerBadgeTone: BadgeTone = responseValue.trim() ? 'green' : 'gray';
  const footerBadgeLabel = responseValue.trim()
    ? t('feedback.v2.drawer.footer.ready')
    : t('feedback.v2.drawer.footer.noReplyYet');

  return (
    <>
      <SidePanel.Body>
        {/* User submission summary */}
        <div className="fb-user-card">
          <p className="fb-user-card-title">{feedback.title}</p>
          {feedback.description && <p className="fb-user-card-desc">{feedback.description}</p>}
          <p className="fb-user-card-meta">
            {feedback.author?.full_name ?? t('feedback.v2.type.anonymous')} ·{' '}
            {format(new Date(feedback.created_at), 'PP', {
              locale: getDateLocale(i18n.language),
            })}
          </p>
        </div>

        <form id="reply-form" onSubmit={form.handleSubmit(handleSave)} noValidate>
          <Field
            label={t('feedback.v2.reply.status_label')}
            hint={t('feedback.v2.reply.status_hint')}
          >
            <StatusGrid
              options={STATUS_PICKER.map((s) => ({ ...s, label: t(s.label) }))}
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
        </form>
      </SidePanel.Body>

      <SidePanel.Footer>
        <div className="flex flex-1 items-center gap-2">
          <Badge tone={footerBadgeTone}>{footerBadgeLabel}</Badge>
          <span className="text-sm text-muted-foreground">
            {t('feedback.v2.drawer.saveNotice', {
              name: feedback.author?.full_name ?? t('feedback.v2.drawer.theUser'),
            })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onRequestDelete(feedback.id)}
            className="text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t('feedback.delete.button')}
          </Button>

          <Button type="button" variant="ghost" onClick={onClose}>
            {t('feedback.v2.reply.cancel')}
          </Button>

          <Button type="submit" form="reply-form" disabled={isSubmitting || !responseValue.trim()}>
            {isSubmitting ? t('feedback.v2.drawer.saving') : t('feedback.v2.reply.save')}
          </Button>
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
          {format(new Date(item.created_at), 'PP', { locale: getDateLocale(i18n.language) })} (
          {formatDistanceToNow(new Date(item.created_at), {
            addSuffix: true,
            locale: getDateLocale(i18n.language),
          })}
          )
        </span>
      </div>

      {/* Row 4: Likes */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.likes')}</span>
        <span className="fb-meta-v">{item.vote_count}</span>
      </div>

      {/* TODO(feedback-device): show once Feedback.device is on the model */}

      {/* Row 5: Status — Badge via tone API */}
      <div className="fb-meta-row" role="listitem">
        <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.status')}</span>
        <span className="fb-meta-v">
          <Badge tone={STATUS_TONE[handoff]}>{t(HANDOFF_LABEL[handoff])}</Badge>
        </span>
      </div>

      {/* Row 6 (conditional): Responded — only when admin_response is present */}
      {item.admin_response ? (
        <div className="fb-meta-row" role="listitem">
          <span className="fb-meta-l">{t('feedback.v2.drawer.meta.rows.responded')}</span>
          <span className="fb-meta-v">
            {formatDistanceToNow(new Date(item.admin_response_at ?? item.created_at), {
              addSuffix: true,
              locale: getDateLocale(i18n.language),
            })}{' '}
            · {t('feedback.v2.drawer.admin')}
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
  onRequestDelete,
}: FeedbackDrawerProps) {
  const { t, i18n } = useTranslation('admin');

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
              {feedback.id} ·{' '}
              {format(new Date(feedback.created_at), 'PP', {
                locale: getDateLocale(i18n.language),
              })}
            </div>
            <h2 className="drawer-h">{feedback.title}</h2>
            <div className="drawer-meta">
              <Badge tone={CATEGORY_TONE[feedback.category]}>
                {feedback.category === 'bug_incorrect_data'
                  ? t('feedback.v2.type.bug')
                  : t('feedback.v2.type.feature')}
              </Badge>
              <Badge tone={STATUS_TONE[selectedStatus]}>{t(HANDOFF_LABEL[selectedStatus])}</Badge>
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
              {t(label)}
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
            <button type="button" onClick={onClose}>
              {t('feedback.v2.reply.cancel')}
            </button>
          </SidePanel.Footer>
        </>
      )}
    </SidePanel>
  );
}
