import React, { useCallback, useEffect, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/ui/side-panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationUpdatePayload } from '@/types/situation';

import { SITUATION_STATUS_BADGE_CLASSES } from './situationBadges';
import { SituationDrawerDescription } from './SituationDrawer.description';
import { SituationDrawerDialog } from './SituationDrawer.dialog';
import { SituationDrawerExercises } from './SituationDrawer.exercises';
import { SituationDrawerLinkedNews } from './SituationDrawer.linkedNews';
import { SituationDrawerPicture } from './SituationDrawer.picture';

// ── Types ───────────────────────────────────────────────────────────────────────

export type SituationDrawerTab = 'dialog' | 'description' | 'picture' | 'exercises' | 'linkedNews';

export interface SituationDrawerFormData {
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function toDefaults(
  detail: { scenario_el: string; scenario_en: string; scenario_ru: string } | null
): SituationDrawerFormData {
  return {
    scenario_el: detail?.scenario_el ?? '',
    scenario_en: detail?.scenario_en ?? '',
    scenario_ru: detail?.scenario_ru ?? '',
  };
}

// ── Component ───────────────────────────────────────────────────────────────────

export const SituationDrawer: React.FC = () => {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();

  const drawerItemId = useAdminSituationStore((s) => s.drawerItemId);
  const selectedSituation = useAdminSituationStore((s) => s.selectedSituation);
  const isLoadingDetail = useAdminSituationStore((s) => s.isLoadingDetail);
  const situations = useAdminSituationStore((s) => s.situations);
  const closeDrawer = useAdminSituationStore((s) => s.closeDrawer);
  const fetchSituationDetail = useAdminSituationStore((s) => s.fetchSituationDetail);
  const fetchSituations = useAdminSituationStore((s) => s.fetchSituations);

  // Look up exercises count from list item (preferred; no cache roundtrip needed).
  const listItem = drawerItemId ? (situations.find((s) => s.id === drawerItemId) ?? null) : null;
  const exercisesTotal = listItem
    ? listItem.dialog_exercises_count +
      listItem.description_exercises_count +
      listItem.picture_exercises_count
    : 0;

  const [activeTab, setActiveTab] = useState<SituationDrawerTab>('dialog');
  const [dirtyDialogOpen, setDirtyDialogOpen] = useState<null | 'close' | 'cancel'>(null);

  const form = useForm<SituationDrawerFormData>({
    mode: 'onBlur',
    defaultValues: toDefaults(selectedSituation),
  });

  // Fetch detail on every open (store clears slot in fetchSituationDetail).
  useEffect(() => {
    if (drawerItemId) {
      void fetchSituationDetail(drawerItemId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerItemId]);

  // Reset form + tab whenever loaded detail changes.
  useEffect(() => {
    if (selectedSituation) {
      form.reset(toDefaults(selectedSituation));
      setActiveTab('dialog');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSituation?.id]);

  const closeAndClearUrl = useCallback(() => {
    closeDrawer();
    setSearchParams(
      (prev) => {
        prev.delete('edit');
        return prev;
      },
      { replace: true }
    );
  }, [closeDrawer, setSearchParams]);

  const requestClose = useCallback(() => {
    if (form.formState.isDirty) setDirtyDialogOpen('close');
    else closeAndClearUrl();
  }, [form.formState.isDirty, closeAndClearUrl]);

  const requestCancel = useCallback(() => {
    if (form.formState.isDirty) setDirtyDialogOpen('cancel');
    else closeAndClearUrl();
  }, [form.formState.isDirty, closeAndClearUrl]);

  const handleSave = form.handleSubmit(async (data) => {
    if (!selectedSituation) return;
    const dirty = form.formState.dirtyFields;
    const payload: SituationUpdatePayload = {};
    if (dirty.scenario_el) payload.scenario_el = data.scenario_el;
    if (dirty.scenario_en) payload.scenario_en = data.scenario_en;
    if (dirty.scenario_ru) payload.scenario_ru = data.scenario_ru;
    if (Object.keys(payload).length === 0) {
      closeAndClearUrl();
      return;
    }
    try {
      await adminAPI.updateSituation(selectedSituation.id, payload);
      toast({ title: t('situations.drawer.save.success') });
      await fetchSituations();
      closeAndClearUrl();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: t('situations.drawer.save.error'), description: msg, variant: 'destructive' });
    }
  });

  const handleDirtyConfirm = useCallback(async () => {
    await handleSave();
    setDirtyDialogOpen(null);
  }, [handleSave]);

  const handleDirtyDiscard = useCallback(() => {
    setDirtyDialogOpen(null);
    closeAndClearUrl();
  }, [closeAndClearUrl]);

  // Early return: unmount fully clears local state.
  if (!drawerItemId) return null;

  // ── Derived display values ───────────────────────────────────────────────────

  const detail = selectedSituation;
  const speakers = detail?.dialog?.speakers ?? [];
  const lineCount = detail?.dialog?.lines.length ?? 0;

  let breadcrumb: string;
  if (!detail || speakers.length === 0) {
    breadcrumb = t('situations.drawer.breadcrumb.fallback');
  } else if (speakers.length === 1) {
    breadcrumb = `${t('situations.drawer.breadcrumb.fallback')} · ${speakers[0].character_name} · ${lineCount} lines`;
  } else {
    breadcrumb = `${t('situations.drawer.breadcrumb.fallback')} · ${speakers[0].character_name} ↔ ${speakers[1].character_name} · ${lineCount} lines`;
  }

  const titleEn = detail?.scenario_en || detail?.scenario_el || '';
  const titleEl = detail?.scenario_el || '';
  const status = detail?.status ?? 'draft';
  const updatedAt = detail?.updated_at;

  const tabs: { key: SituationDrawerTab; label: string }[] = [
    { key: 'dialog', label: t('situations.drawer.tabs.dialog', { count: lineCount }) },
    { key: 'description', label: t('situations.drawer.tabs.description') },
    { key: 'picture', label: t('situations.drawer.tabs.picture') },
    { key: 'exercises', label: t('situations.drawer.tabs.exercises', { count: exercisesTotal }) },
    { key: 'linkedNews', label: t('situations.drawer.tabs.linkedNews') },
  ];

  return (
    <TooltipProvider>
      <SidePanel
        open={Boolean(drawerItemId)}
        onOpenChange={(o) => {
          if (!o) requestClose();
        }}
        size="default"
        data-testid="situation-edit-drawer"
      >
        <SidePanel.CloseButton
          onClick={requestClose}
          aria-label={t('situations.drawer.closeAria')}
        />
        <SidePanel.Header>
          <div className="drawer-breadcrumb">{breadcrumb}</div>
          <h2 className="drawer-title">{titleEn}</h2>
          {titleEl && (
            <div className="drawer-el-title font-serif" lang="el">
              {titleEl}
            </div>
          )}
          <div className="drawer-meta">
            <Badge className={SITUATION_STATUS_BADGE_CLASSES[status]}>
              {t(`situations.status.${status}`)}
            </Badge>
            <Badge tone="violet">
              {t('situations.drawer.exercisesCount', { n: exercisesTotal })}
            </Badge>
          </div>
        </SidePanel.Header>

        <SidePanel.Tabs>
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`drawer-tab ${activeTab === key ? 'is-active' : ''}`}
                  data-testid={`situation-drawer-tab-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-disabled="true"
                  className="btn-glass cursor-not-allowed opacity-60"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('situations.drawer.regenerateScenario')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>
          </div>
        </SidePanel.Tabs>

        <SidePanel.Body>
          {isLoadingDetail || !detail ? (
            <div className="drawer-body-loading">{t('situations.drawer.loading')}</div>
          ) : null}
          {detail && (
            <FormProvider {...form}>
              {activeTab === 'dialog' && <SituationDrawerDialog situation={detail} />}
              {activeTab === 'description' && <SituationDrawerDescription situation={detail} />}
              {activeTab === 'picture' && <SituationDrawerPicture situation={detail} />}
              {activeTab === 'exercises' && <SituationDrawerExercises situation={detail} />}
              {activeTab === 'linkedNews' && <SituationDrawerLinkedNews situation={detail} />}
            </FormProvider>
          )}
        </SidePanel.Body>

        <SidePanel.Footer>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Badge tone="green">{t('situations.drawer.footer.allChecksPassed')}</Badge>
              {updatedAt && (
                <span className="text-muted-foreground">
                  {t('situations.drawer.footer.updatedRelative', {
                    relative: formatDistanceToNow(new Date(updatedAt), { addSuffix: true }),
                  })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={requestCancel} data-testid="situation-drawer-cancel">
                {t('situations.drawer.footer.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={
                  form.formState.isSubmitting || Object.keys(form.formState.errors).length > 0
                }
                data-testid="situation-drawer-save"
              >
                {form.formState.isSubmitting
                  ? t('situations.drawer.footer.saving')
                  : t('situations.drawer.footer.saveAndClose')}
              </Button>
            </div>
          </div>
        </SidePanel.Footer>
      </SidePanel>

      <ConfirmDialog
        open={dirtyDialogOpen !== null}
        onOpenChange={(o) => {
          if (!o) setDirtyDialogOpen(null);
        }}
        title={t('news.drawer.dirty.title')}
        description={t('news.drawer.dirty.body')}
        confirmText={t('news.drawer.dirty.saveAndContinue')}
        cancelText={t('news.drawer.dirty.discardAndContinue')}
        onConfirm={handleDirtyConfirm}
        onCancel={handleDirtyDiscard}
      />
    </TooltipProvider>
  );
};
