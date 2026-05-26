import React, { useCallback, useEffect, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Check, Pencil } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/ui/side-panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { adminAPI } from '@/services/adminAPI';
import { APIRequestError } from '@/services/api';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type {
  DescriptionUpdatePayload,
  PictureUpdatePayload,
  SituationUpdatePayload,
} from '@/types/situation';

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
  description: {
    text_el: string;
    text_el_a2: string;
    text_en: string;
  };
  picture: {
    scene_en: string;
    scene_el: string;
    scene_ru: string;
    style_en: string;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function toDefaults(
  detail: {
    scenario_el: string;
    scenario_en: string;
    scenario_ru: string;
    description?: { text_el: string; text_el_a2: string | null; text_en: string | null } | null;
    picture?: {
      scene_en: string | null;
      scene_el: string | null;
      scene_ru: string | null;
      style_en: string | null;
    } | null;
  } | null
): SituationDrawerFormData {
  return {
    scenario_el: detail?.scenario_el ?? '',
    scenario_en: detail?.scenario_en ?? '',
    scenario_ru: detail?.scenario_ru ?? '',
    description: {
      text_el: detail?.description?.text_el ?? '',
      text_el_a2: detail?.description?.text_el_a2 ?? '',
      text_en: detail?.description?.text_en ?? '',
    },
    picture: {
      scene_en: detail?.picture?.scene_en ?? '',
      scene_el: detail?.picture?.scene_el ?? '',
      scene_ru: detail?.picture?.scene_ru ?? '',
      style_en: detail?.picture?.style_en ?? '',
    },
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
  const [pictureTrioError, setPictureTrioError] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

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

    const situationPayload: SituationUpdatePayload = {};
    if (dirty.scenario_el) situationPayload.scenario_el = data.scenario_el;
    if (dirty.scenario_en) situationPayload.scenario_en = data.scenario_en;
    if (dirty.scenario_ru) situationPayload.scenario_ru = data.scenario_ru;

    const descDirty = dirty.description ?? {};
    const descPayload: DescriptionUpdatePayload = {};
    if (descDirty.text_el) descPayload.text_el = data.description.text_el;
    if (descDirty.text_el_a2) descPayload.text_el_a2 = data.description.text_el_a2;
    if (descDirty.text_en) descPayload.text_en = data.description.text_en;

    // Picture fields: trio validation + dirty diff
    const picDirty = dirty.picture ?? {};
    const hasPictureDirty =
      picDirty.scene_en || picDirty.scene_el || picDirty.scene_ru || picDirty.style_en;
    const picPayload: PictureUpdatePayload = {};

    if (hasPictureDirty && selectedSituation.picture) {
      const trioFilled = [
        data.picture.scene_en.trim().length > 0,
        data.picture.scene_el.trim().length > 0,
        data.picture.scene_ru.trim().length > 0,
      ];
      const trioPartial = trioFilled.some(Boolean) && !trioFilled.every(Boolean);
      if (trioPartial) {
        setPictureTrioError(true);
        setActiveTab('picture');
        return;
      }
      setPictureTrioError(false);
      if (picDirty.scene_en) picPayload.scene_en = data.picture.scene_en.trim() || null;
      if (picDirty.scene_el) picPayload.scene_el = data.picture.scene_el.trim() || null;
      if (picDirty.scene_ru) picPayload.scene_ru = data.picture.scene_ru.trim() || null;
      if (picDirty.style_en) picPayload.style_en = data.picture.style_en.trim() || null;
    } else {
      setPictureTrioError(false);
    }

    const hasSituationChanges = Object.keys(situationPayload).length > 0;
    const hasDescriptionChanges = Object.keys(descPayload).length > 0;
    const hasPictureChanges = Object.keys(picPayload).length > 0;

    if (!hasSituationChanges && !hasDescriptionChanges && !hasPictureChanges) {
      closeAndClearUrl();
      return;
    }

    try {
      if (hasSituationChanges) {
        await adminAPI.updateSituation(selectedSituation.id, situationPayload);
      }
      if (hasDescriptionChanges) {
        await adminAPI.updateSituationDescription(selectedSituation.id, descPayload);
      }
      if (hasPictureChanges) {
        await adminAPI.updateSituationPicture(selectedSituation.id, picPayload);
      }
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

  const handlePublish = useCallback(async () => {
    if (!selectedSituation) return;
    setIsPublishing(true);
    try {
      // If the form is dirty, save first.
      if (form.formState.isDirty) {
        await handleSave();
        // handleSave closes the drawer on success; if it returned early (validation error) abort.
        if (form.formState.isDirty) {
          setIsPublishing(false);
          return;
        }
      }
      const fromStatus = selectedSituation.status;
      const startedAt = new Date(selectedSituation.created_at).getTime();
      await adminAPI.updateSituationStatus(selectedSituation.id, 'ready');
      track('admin_situation_published', {
        situation_id: selectedSituation.id,
        from_status: fromStatus,
        to_status: 'ready',
        time_in_draft_seconds: Math.round((Date.now() - startedAt) / 1000),
      });
      toast({ title: t('situations.drawer.footer.publishSuccess') });
      await fetchSituations();
      closeAndClearUrl();
    } catch (e) {
      if (e instanceof APIRequestError && e.status === 409) {
        const detail = e.detail as { missing?: string[] } | undefined;
        const fields = detail?.missing?.join(', ') ?? '';
        toast({
          title: t('situations.drawer.footer.publishGuardFailed', { fields }),
          variant: 'destructive',
        });
      } else {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        toast({ title: msg, variant: 'destructive' });
      }
    } finally {
      setIsPublishing(false);
    }
  }, [selectedSituation, form.formState.isDirty, handleSave, t, fetchSituations, closeAndClearUrl]);

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
        title={titleEn || 'Situation details'}
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
            {detail?.levels &&
              detail.levels.map((lvl) => (
                <Badge key={lvl} tone="violet">
                  {lvl}
                </Badge>
              ))}
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
              {activeTab === 'picture' && (
                <>
                  {pictureTrioError && (
                    <Alert variant="destructive" className="mb-4" data-testid="picture-trio-error">
                      <AlertDescription>
                        {t('situations.detail.picturePrompt.trioRuleHint')}
                      </AlertDescription>
                    </Alert>
                  )}
                  <SituationDrawerPicture situation={detail} />
                </>
              )}
              {activeTab === 'exercises' && <SituationDrawerExercises situation={detail} />}
              {activeTab === 'linkedNews' && <SituationDrawerLinkedNews situation={detail} />}
            </FormProvider>
          )}
        </SidePanel.Body>

        <SidePanel.Footer>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {status === 'ready' ? (
                <Badge tone="green" data-testid="situation-drawer-status-pill">
                  <Check className="mr-1 h-3 w-3" />
                  {t('situations.drawer.footer.statusReady')}
                </Badge>
              ) : (
                <Badge tone="amber" data-testid="situation-drawer-status-pill">
                  <Pencil className="mr-1 h-3 w-3" />
                  {t('situations.drawer.footer.statusDraft')}
                </Badge>
              )}
              {updatedAt && (
                <span className="text-muted-foreground">
                  {t('situations.drawer.footer.autoSavedRelative', {
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
              <Button
                variant="default"
                onClick={() => void handlePublish()}
                disabled={isPublishing || form.formState.isSubmitting}
                data-testid="situation-drawer-publish"
              >
                <Check className="mr-2 h-4 w-4" />
                {status === 'ready'
                  ? t('situations.drawer.footer.publishChanges')
                  : t('situations.drawer.footer.markAsReady')}
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
