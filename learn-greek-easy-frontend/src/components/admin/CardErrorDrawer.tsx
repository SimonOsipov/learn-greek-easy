// src/components/admin/CardErrorDrawer.tsx
//
// Drawer for viewing and updating individual card error reports.
// Replaces AdminCardErrorDetailModal (CER-20) — Dialog → SidePanel size="full".
// Header chrome:  breadcrumb (CER-21), H2 constant literal (CER-22), meta row (CER-23)
// Tab system:     Review / The card / Meta (CER-25), null stub panels
// Tabs-row actions: Copy card ID + Open in deck placeholder (CER-26)
//
// Review tab batch 7 (CER-27..CER-33):
//   CER-27  Thread chrome around report description
//   CER-28  CardPreview compact snapshot
//   CER-29  StatusGrid replaces native Select
//   CER-30  Notes hint with reporter visibility warning
//   CER-31  Notes placeholder updated
//   CER-32  Canned reply pills
//   CER-33  Resolved banner (green-tinted, shield icon, resolver attribution)
//
// TODO(CER-20-followup): bespoke 40px slide via dwSlide keyframe per design spec

import React, { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Globe, Loader2, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { AdminCardErrorResponse, AdminCardErrorUpdateRequest } from '@/types/cardError';

import CannedReplyPills from './CannedReplyPills';
import { CardErrorStatusBadge } from './CardErrorStatusBadge';
import { CardPreview } from './CardPreview';
import { StatusGrid } from './StatusGrid';
import { Thread } from './Thread';

import type { StatusOption } from './StatusGrid';

// ============================================
// Types
// ============================================

export interface CardErrorDrawerProps {
  /** Controls drawer visibility */
  open: boolean;
  /** Callback when drawer open state changes */
  onOpenChange: (open: boolean) => void;
  /** The error report to display (null when closed) */
  report: AdminCardErrorResponse | null;
  /** Callback after successful update */
  onUpdate: (updatedReport: AdminCardErrorResponse) => void;
}

// ── Tab system (CER-25) ───────────────────────────────────────────────────────

type DrawerTab = 'review' | 'theCard' | 'meta';
const DEFAULT_TAB: DrawerTab = 'review';

// ── Status options for StatusGrid (CER-29) ───────────────────────────────────

type CEStatus = 'PENDING' | 'REVIEWED' | 'FIXED' | 'DISMISSED';

const CE_STATUS_OPTIONS: StatusOption<CEStatus>[] = [
  { key: 'PENDING', label: '', dotTone: 'amber' },
  { key: 'REVIEWED', label: '', dotTone: 'primary' },
  { key: 'FIXED', label: '', dotTone: 'success' },
  { key: 'DISMISSED', label: '', dotTone: 'gray' },
];

// ── Canned reply keys (CER-32) ────────────────────────────────────────────────

const QUICK_REPLY_KEYS = [
  'confirmedFixed',
  'needMoreInfo',
  'reRecordAudio',
  'notAnError',
  'duplicate',
] as const;

// ============================================
// Form Schema
// ============================================

const updateFormSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'FIXED', 'DISMISSED']),
  admin_notes: z
    .string()
    .max(1000, 'Admin notes must be 1000 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
});

type UpdateFormData = z.infer<typeof updateFormSchema>;

// ============================================
// Helpers
// ============================================

/**
 * Derive short ID: prefer report.slug when present, fall back to first 8 chars of UUID.
 */
function deriveShortId(report: AdminCardErrorResponse): string {
  const slug = (report as AdminCardErrorResponse & { slug?: string }).slug;
  if (slug && slug.trim()) return slug.trim();
  return report.id.slice(0, 8);
}

/**
 * Format date portions for the breadcrumb (CER-21).
 * Returns { date: "Month D, YYYY", time: "H:MM AM/PM" } in the active locale.
 */
function formatBreadcrumbParts(dateString: string, locale: string): { date: string; time: string } {
  const d = new Date(dateString);
  const date = d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { date, time };
}

/**
 * Format a resolved_at timestamp to a short absolute date.
 */
function formatResolvedDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// Main Component
// ============================================

/**
 * CardErrorDrawer
 *
 * Full-screen right-slide SidePanel drawer for card error reports.
 * Replaces the old AdminCardErrorDetailModal (centered Dialog).
 *
 * Structure:
 *   - Header: breadcrumb · H2 · meta row (type badge, status badge, deck chip)
 *   - Tabs row: Review | The card | Meta + right-side actions (Copy card ID, Open in deck)
 *   - Body: tab panel stubs (filled by Batches 7-8)
 *   - Footer: Save / Cancel
 */
export const CardErrorDrawer: React.FC<CardErrorDrawerProps> = ({
  open,
  onOpenChange,
  report,
  onUpdate,
}) => {
  const { t, i18n } = useTranslation('admin');
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Tab state (CER-25) ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<DrawerTab>(DEFAULT_TAB);

  // Reset tab to default when a new report opens
  useEffect(() => {
    if (open) setTab(DEFAULT_TAB);
  }, [open, report?.id]);

  // ── Copy card ID state (CER-26) ─────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Reset copied state when the card changes
  useEffect(() => {
    setCopied(false);
  }, [report?.card_id]);

  // ── Form ────────────────────────────────────────────────────────────────────
  const form = useForm<UpdateFormData>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: {
      status: report?.status ?? 'PENDING',
      admin_notes: report?.admin_notes ?? '',
    },
  });

  // Reset form when report changes or drawer opens
  useEffect(() => {
    if (open && report) {
      form.reset({
        status: report.status,
        admin_notes: report.admin_notes ?? '',
      });
    }
  }, [open, report, form]);

  // Watch live status and notes for badges + counters
  const liveStatus = form.watch('status');
  const liveNotes = form.watch('admin_notes') ?? '';

  // ── Submit ──────────────────────────────────────────────────────────────────
  const onSubmit = async (data: UpdateFormData) => {
    if (!report) return;

    setIsUpdating(true);
    try {
      const updateData: AdminCardErrorUpdateRequest = {};

      if (data.status !== report.status) {
        updateData.status = data.status;
      }

      const newNotes = data.admin_notes?.trim() || undefined;
      const oldNotes = report.admin_notes || undefined;
      if (newNotes !== oldNotes) {
        updateData.admin_notes = newNotes;
      }

      if (Object.keys(updateData).length === 0) {
        onOpenChange(false);
        return;
      }

      const updatedReport = await adminAPI.updateCardError(report.id, updateData);

      toast({
        title: t('cardErrors.detail.updateSuccess'),
        description: t('cardErrors.detail.updateSuccessMessage'),
      });

      onUpdate(updatedReport);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('cardErrors.detail.updateError'),
        description:
          error instanceof Error ? error.message : t('cardErrors.detail.updateErrorMessage'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Copy card ID handler (CER-26) ────────────────────────────────────────────
  const handleCopyCardId = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.card_id);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // swallow — older browsers / denied permissions; button just won't flip
    }
  };

  // TODO(CER-future): wire to deck-editor route once it exists (e.g. /admin/decks/:deckId?card=:cardId)
  const handleOpenInDeck = () => {
    // Placeholder — re-uses the existing drawer open state until the deck-editor route ships.
    // TODO(CER-OOS): navigate to deck editor
  };

  if (!report) return null;

  // ── Breadcrumb parts (CER-21) ────────────────────────────────────────────────
  const shortId = deriveShortId(report);
  const { date: breadcrumbDate, time: breadcrumbTime } = formatBreadcrumbParts(
    report.created_at,
    i18n.language
  );

  // ── Status options with localized labels (CER-29) ────────────────────────────
  const statusOptions: StatusOption<CEStatus>[] = CE_STATUS_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`cardErrors.reply.status.${opt.key.toLowerCase()}`),
  }));

  // ── Canned reply pills (CER-32) ───────────────────────────────────────────────
  const cannedPills = QUICK_REPLY_KEYS.map((key) => ({
    key,
    label: t(`cardErrors.reply.quick.${key}.label`),
    body: t(`cardErrors.reply.quick.${key}.body`),
  }));

  // ── Resolved banner (CER-33) ──────────────────────────────────────────────────
  const resolverName =
    report.resolver?.full_name?.trim() || t('cardErrors.reply.resolvedBanner.fallbackName');

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title={t('cardErrors.drawer.title')}
      data-testid="card-error-drawer"
    >
      <SidePanel.CloseButton position="right" />

      {/* ── Header (CER-21, CER-22, CER-23) ── */}
      <SidePanel.Header>
        <div className="drawer-head-content">
          {/* Breadcrumb (CER-21) */}
          <div className="drawer-bcrumb">
            {t('cardErrors.drawer.breadcrumb', {
              id: shortId,
              date: breadcrumbDate,
              time: breadcrumbTime,
            })}
          </div>

          {/* H2 constant literal (CER-22) */}
          <h2 className="drawer-h">{t('cardErrors.drawer.title')}</h2>

          {/* Meta row (CER-23): type badge + live status badge + deck chip */}
          <div className="drawer-meta">
            {/* Type badge */}
            <span className="badge b-gray gap-1" data-testid="card-error-type-badge">
              {report.card_type === 'WORD' ? (
                <BookOpen className="size-3" aria-hidden="true" />
              ) : (
                <Globe className="size-3" aria-hidden="true" />
              )}
              {t(`cardErrors.cardTypes.${report.card_type.toLowerCase()}`)}
            </span>

            {/* Live status badge — mirrors form's current status (CER-23) */}
            <CardErrorStatusBadge status={liveStatus} />

            {/* Deck chip — only when deck is present on payload (CER-23) */}
            {report.deck && (
              <span className="text-sm text-muted-foreground">
                in <b className="text-foreground">{report.deck.name}</b>
              </span>
            )}
          </div>
        </div>
      </SidePanel.Header>

      {/* ── Tabs row (CER-25) + right-side actions (CER-26) ── */}
      <SidePanel.Tabs>
        <div className="drawer-tabs">
          {/* Left-aligned tab buttons */}
          <button
            type="button"
            className={tab === 'review' ? 'drawer-tab is-active' : 'drawer-tab'}
            onClick={() => setTab('review')}
            data-testid="card-error-drawer-tab-review"
          >
            {t('cardErrors.drawer.tabs.review')}
          </button>
          <button
            type="button"
            className={tab === 'theCard' ? 'drawer-tab is-active' : 'drawer-tab'}
            onClick={() => setTab('theCard')}
            data-testid="card-error-drawer-tab-theCard"
          >
            {t('cardErrors.drawer.tabs.theCard')}
          </button>
          <button
            type="button"
            className={tab === 'meta' ? 'drawer-tab is-active' : 'drawer-tab'}
            onClick={() => setTab('meta')}
            data-testid="card-error-drawer-tab-meta"
          >
            {t('cardErrors.drawer.tabs.meta')}
          </button>

          {/* Spacer pushes right-side actions to the far right */}
          <div className="drawer-tabs-spacer" />

          {/* Right-side actions slot (CER-26) */}
          <div className="flex items-center gap-2" data-slot="drawer-tabs-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCardId}
              disabled={!report.card_id}
              data-testid="copy-card-id-button"
            >
              {copied
                ? t('cardErrors.drawer.actions.copied')
                : t('cardErrors.drawer.actions.copyCardId')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenInDeck}
              data-testid="open-in-deck-button"
            >
              {t('cardErrors.drawer.actions.openInDeck')}
            </Button>
          </div>
        </div>
      </SidePanel.Tabs>

      {/* ── Tab body panels (CER-25) ── */}
      <SidePanel.Body>
        {tab === 'review' && (
          <div data-testid="drawer-tab-review">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* ── CER-33: Resolved banner (top of review tab when resolved) ── */}
                {report.resolved_at && (
                  <div
                    className="ce-resolved"
                    role="status"
                    aria-live="polite"
                    data-testid="resolved-banner"
                  >
                    <ShieldCheck className="ce-resolved__icon" size={18} aria-hidden="true" />
                    <div className="ce-resolved__text">
                      <span className="ce-resolved__title">
                        {t('cardErrors.reply.resolvedBanner.title', {
                          date: formatResolvedDate(report.resolved_at, i18n.language),
                        })}
                      </span>
                      <span className="ce-resolved__by">
                        {t('cardErrors.reply.resolvedBanner.by', { name: resolverName })}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── CER-27: Thread chrome around report description ── */}
                <Thread compact>
                  <Thread.Message
                    author={{
                      name:
                        report.reporter?.full_name?.trim() || t('cardErrors.detail.anonymousUser'),
                    }}
                    timestamp={report.created_at}
                  >
                    <span className="whitespace-pre-wrap" data-testid="error-description">
                      {report.description}
                    </span>
                  </Thread.Message>
                </Thread>

                {/* ── CER-28: Card preview snapshot ── */}
                <CardPreview card={report.card} cardType={report.card_type} compact />

                {/* Admin Actions separator */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t('cardErrors.detail.adminActions')}
                    </span>
                  </div>
                </div>

                {/* ── CER-29: Status grid replaces native Select ── */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <div>
                      <p className="mb-2 text-sm font-medium">
                        {t('cardErrors.reply.status.label')}
                      </p>
                      <StatusGrid<CEStatus>
                        options={statusOptions}
                        value={field.value as CEStatus}
                        onChange={field.onChange}
                      />
                    </div>
                  )}
                />

                {/* ── CER-32: Canned reply pills ── */}
                <CannedReplyPills
                  label={t('cardErrors.reply.quick.heading')}
                  pills={cannedPills}
                  onSelect={(body) => form.setValue('admin_notes', body)}
                />

                {/* ── CER-30 + CER-31: Admin notes with hint and updated placeholder ── */}
                <FormField
                  control={form.control}
                  name="admin_notes"
                  render={({ field }) => (
                    <FormItem>
                      {/* CER-30: label */}
                      <label
                        htmlFor="admin-notes-textarea"
                        className="mb-1 block text-sm font-medium"
                      >
                        {t('cardErrors.reply.notes.label')}
                      </label>
                      <FormControl>
                        <Textarea
                          id="admin-notes-textarea"
                          placeholder={t('cardErrors.reply.notes.placeholder')}
                          className="min-h-[100px] resize-none"
                          maxLength={1000}
                          data-testid="admin-notes-textarea"
                          {...field}
                        />
                      </FormControl>
                      {/* CER-30: hint with live count + reporter visibility warning */}
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <FormMessage />
                        <span>{t('cardErrors.reply.notes.hint', { count: liveNotes.length })}</span>
                      </div>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        )}

        {tab === 'theCard' && (
          <div data-testid="drawer-tab-theCard">
            {/* The card tab body — Batch 8 */}
            {null}
          </div>
        )}

        {tab === 'meta' && (
          <div data-testid="drawer-tab-meta">
            {/* Meta tab body — Batch 8 */}
            {null}
          </div>
        )}
      </SidePanel.Body>

      {/* ── Footer ── */}
      <SidePanel.Footer>
        <div className="flex w-full justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            data-testid="cancel-button"
          >
            {t('feedback.response.cancel')}
          </Button>
          <Button
            type="submit"
            form="card-error-review-form"
            disabled={isUpdating}
            data-testid="save-button"
            onClick={form.handleSubmit(onSubmit)}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('feedback.response.saving')}
              </>
            ) : (
              t('cardErrors.drawer.foot.save')
            )}
          </Button>
        </div>
      </SidePanel.Footer>
    </SidePanel>
  );
};
