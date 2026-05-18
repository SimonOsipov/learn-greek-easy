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
import { useAdminTabNav } from '@/hooks/useAdminTabNav';
import { adminAPI, type NewsItemResponse, type NewsItemUpdate } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsEditDrawerAudio } from './NewsEditDrawer.audio';
import { NewsEditDrawerBody } from './NewsEditDrawer.body';
import { NewsEditDrawerImage } from './NewsEditDrawer.image';
import { NewsEditDrawerLinkedSituation } from './NewsEditDrawer.linkedSituation';
import { NewsEditDrawerTranslations } from './NewsEditDrawer.translations';

export type NewsDrawerTab = 'translations' | 'body' | 'audio' | 'image' | 'linkedSituation';

export interface NewsDrawerFormData {
  title_el: string;
  title_en: string;
  title_ru: string;
  description_el: string;
  title_el_a2: string | null;
  description_el_a2: string | null;
  source_image_url: string;
}

export const NewsEditDrawer: React.FC = () => {
  const { t, i18n } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const { drawerItemId, closeDrawer, newsItems } = useAdminNewsStore();
  const tabNav = useAdminTabNav();
  const item: NewsItemResponse | null = drawerItemId
    ? (newsItems.find((i) => i.id === drawerItemId) ?? null)
    : null;

  const [activeTab, setActiveTab] = useState<NewsDrawerTab>('translations');
  const [dirtyDialogOpen, setDirtyDialogOpen] = useState<null | 'close' | 'cancel'>(null);
  const [pendingQuickJumpSituationId, setPendingQuickJumpSituationId] = useState<string | null>(
    null
  );

  const form = useForm<NewsDrawerFormData>({ mode: 'onBlur', defaultValues: toDefaults(item) });

  // Reset form + tab whenever a new item opens.
  useEffect(() => {
    if (item) {
      form.reset(toDefaults(item));
      setActiveTab('translations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

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
    if (!item) return;
    const dirty = form.formState.dirtyFields;
    const payload: NewsItemUpdate = {};
    if (dirty.title_el) payload.scenario_el = data.title_el;
    if (dirty.title_en) payload.scenario_en = data.title_en;
    if (dirty.title_ru) payload.scenario_ru = data.title_ru;
    if (dirty.description_el) payload.text_el = data.description_el;
    if (dirty.title_el_a2 !== undefined) payload.scenario_el_a2 = data.title_el_a2 || null;
    if (dirty.description_el_a2 !== undefined) payload.text_el_a2 = data.description_el_a2 || null;
    const trimmedImageUrl = (data.source_image_url || '').trim();
    if (trimmedImageUrl !== '') {
      try {
        new URL(trimmedImageUrl);
      } catch {
        toast({ title: t('news.drawer.image.invalidUrl'), variant: 'destructive' });
        return;
      }
      payload.source_image_url = trimmedImageUrl;
    }
    if (Object.keys(payload).length === 0) {
      closeAndClearUrl();
      return;
    }
    try {
      await adminAPI.updateNewsItem(item.id, payload);
      toast({ title: t('news.edit.success') });
      await useAdminNewsStore.getState().fetchNewsItems();
      closeAndClearUrl();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: t('news.edit.error'), description: msg, variant: 'destructive' });
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

  const performQuickJump = useCallback(
    (situationId: string) => {
      closeDrawer();
      tabNav.openIn('situations', { edit: situationId });
    },
    [closeDrawer, tabNav]
  );

  const requestQuickJump = useCallback(
    (situationId: string) => {
      if (form.formState.isDirty) {
        setPendingQuickJumpSituationId(situationId);
      } else {
        performQuickJump(situationId);
      }
    },
    [form.formState.isDirty, performQuickJump]
  );

  if (!item) return null;

  const titleInLang = pickByLang(item, i18n.language);
  const countryLabel = t(`news.drawer.country.${item.country}`);
  const countryFlag = ({ cyprus: '🇨🇾', greece: '🇬🇷', world: '🌍' } as const)[item.country] ?? '🌍';

  return (
    <TooltipProvider>
      <SidePanel
        open={Boolean(item)}
        onOpenChange={(o) => {
          if (!o) requestClose();
        }}
        size="default"
        data-testid="news-edit-drawer"
        title="Edit news article"
      >
        <SidePanel.CloseButton onClick={requestClose} />
        <SidePanel.Header>
          <div className="drawer-breadcrumb">{`News · ${countryFlag} ${countryLabel} · ${t('news.drawer.publishedOn', { date: item.publication_date })}`}</div>
          <h2 className="drawer-title">{titleInLang}</h2>
          <div className="drawer-meta">
            <Badge tone="green">{t('news.drawer.published')}</Badge>
            {item.description_el ? <Badge tone="violet">B2</Badge> : null}
            {item.description_el_a2 ? <Badge tone="violet">A2</Badge> : null}
          </div>
        </SidePanel.Header>

        <SidePanel.Tabs>
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1">
              {(['translations', 'body', 'audio', 'image', 'linkedSituation'] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`drawer-tab ${activeTab === tab ? 'is-active' : ''}`}
                    data-testid={`news-drawer-tab-${tab}`}
                  >
                    {t(`news.drawer.tabs.${tab}`)}
                  </button>
                )
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-disabled="true"
                  className="btn-glass cursor-not-allowed opacity-60"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('news.drawer.regenerateTranslations')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>
          </div>
        </SidePanel.Tabs>

        <SidePanel.Body>
          <FormProvider {...form}>
            {activeTab === 'translations' && <NewsEditDrawerTranslations item={item} />}
            {activeTab === 'body' && <NewsEditDrawerBody item={item} />}
            {activeTab === 'audio' && <NewsEditDrawerAudio item={item} />}
            {activeTab === 'image' && <NewsEditDrawerImage item={item} />}
            {activeTab === 'linkedSituation' && (
              <NewsEditDrawerLinkedSituation item={item} onRequestQuickJump={requestQuickJump} />
            )}
          </FormProvider>
        </SidePanel.Body>

        <SidePanel.Footer>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Badge tone="green">{t('news.drawer.allChecksPassed')}</Badge>
              <span className="text-muted-foreground">
                {t('news.drawer.updatedRelative', {
                  relative: formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }),
                })}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={requestCancel} data-testid="news-drawer-cancel">
                {t('news.drawer.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={
                  form.formState.isSubmitting || Object.keys(form.formState.errors).length > 0
                }
                data-testid="news-drawer-save"
              >
                {form.formState.isSubmitting ? t('news.drawer.saving') : t('news.drawer.save')}
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

      <ConfirmDialog
        open={pendingQuickJumpSituationId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingQuickJumpSituationId(null);
        }}
        title={t('news.drawer.dirty.title')}
        description={t('news.drawer.dirty.body')}
        confirmText={t('news.drawer.dirty.saveAndContinue')}
        cancelText={t('news.drawer.dirty.discardAndContinue')}
        onConfirm={async () => {
          if (pendingQuickJumpSituationId) {
            await handleSave();
            performQuickJump(pendingQuickJumpSituationId);
          }
        }}
        onCancel={() => {
          if (pendingQuickJumpSituationId) {
            const id = pendingQuickJumpSituationId;
            setPendingQuickJumpSituationId(null);
            performQuickJump(id);
          }
        }}
      />
    </TooltipProvider>
  );
};

function toDefaults(item: NewsItemResponse | null): NewsDrawerFormData {
  return {
    title_el: item?.title_el ?? '',
    title_en: item?.title_en ?? '',
    title_ru: item?.title_ru ?? '',
    description_el: item?.description_el ?? '',
    title_el_a2: item?.title_el_a2 ?? null,
    description_el_a2: item?.description_el_a2 ?? null,
    source_image_url: '',
  };
}

function pickByLang(item: NewsItemResponse, lang: string): string {
  if (lang === 'el') return item.title_el;
  if (lang === 'ru') return item.title_ru;
  return item.title_en;
}
