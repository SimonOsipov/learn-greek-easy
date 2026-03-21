import { useEffect } from 'react';

import { FileText, Image, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/hooks/useLanguage';
import {
  useAdminSituationStore,
  selectSelectedSituation,
  selectIsLoadingDetail,
  selectDetailError,
} from '@/stores/adminSituationStore';
import type { SituationDetailResponse } from '@/types/situation';

import {
  CEFR_BADGE_CLASSES,
  CEFR_BADGE_FALLBACK,
  SITUATION_STATUS_BADGE_CLASSES,
} from './situationBadges';

// Defined locally — same values as DialogDetailModal but NOT imported from it
const SPEAKER_BUBBLE_STYLES = [
  {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    name: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    bg: 'bg-green-50 dark:bg-green-950/30',
    name: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    name: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    name: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
];

interface SituationDetailModalProps {
  situationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (situation: SituationDetailResponse) => void;
}

function AudioPlaceholder() {
  const { t } = useTranslation('admin');
  return (
    <div
      className="flex items-center justify-center rounded-md border-2 border-dashed border-gray-200 p-4 text-sm text-gray-400 dark:border-gray-700"
      data-testid="situation-audio-placeholder"
    >
      {t('situations.detail.audioNotGenerated')}
    </div>
  );
}

function RegenerateButton() {
  const { t } = useTranslation('admin');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('situations.detail.regenerate')}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('situations.detail.backendNotConnected')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SituationDetailModal({
  situationId,
  open,
  onOpenChange,
  onDelete,
}: SituationDetailModalProps) {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const selectedSituation = useAdminSituationStore(selectSelectedSituation);
  const isLoadingDetail = useAdminSituationStore(selectIsLoadingDetail);
  const detailError = useAdminSituationStore(selectDetailError);
  const { fetchSituationDetail, clearSelectedSituation } = useAdminSituationStore();

  useEffect(() => {
    if (open && situationId) {
      void fetchSituationDetail(situationId);
    }
  }, [open, situationId, fetchSituationDetail]);

  useEffect(() => {
    if (!open) {
      clearSelectedSituation();
    }
  }, [open, clearSelectedSituation]);

  const localizedScenario = selectedSituation
    ? currentLanguage === 'ru'
      ? selectedSituation.scenario_ru
      : selectedSituation.scenario_en
    : '';

  const getSpeakerStyle = (speakerIndex: number) =>
    SPEAKER_BUBBLE_STYLES[speakerIndex % SPEAKER_BUBBLE_STYLES.length] ?? SPEAKER_BUBBLE_STYLES[0];

  const getSpeakerName = (speakerId: string) => {
    if (!selectedSituation?.dialog) return speakerId;
    return (
      selectedSituation.dialog.speakers.find((s) => s.id === speakerId)?.character_name ?? speakerId
    );
  };

  const getSpeakerIndex = (speakerId: string) => {
    if (!selectedSituation?.dialog) return 0;
    return selectedSituation.dialog.speakers.findIndex((s) => s.id === speakerId) ?? 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="situation-detail-modal">
        <DialogHeader>
          {isLoadingDetail && (
            <>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </>
          )}
          {!isLoadingDetail && selectedSituation && (
            <>
              <DialogTitle>{localizedScenario}</DialogTitle>
              <DialogDescription>{selectedSituation.scenario_el}</DialogDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge
                  variant="outline"
                  className={
                    CEFR_BADGE_CLASSES[selectedSituation.cefr_level] ?? CEFR_BADGE_FALLBACK
                  }
                >
                  {selectedSituation.cefr_level}
                </Badge>
                <Badge
                  variant="outline"
                  className={SITUATION_STATUS_BADGE_CLASSES[selectedSituation.status]}
                >
                  {t(`situations.status.${selectedSituation.status}`)}
                </Badge>
              </div>
            </>
          )}
          {!isLoadingDetail && detailError && (
            <DialogTitle className="text-destructive">{detailError}</DialogTitle>
          )}
        </DialogHeader>

        {!isLoadingDetail && selectedSituation && (
          <Tabs defaultValue="dialog" data-testid="situation-detail-tabs">
            <TabsList className="w-full">
              <TabsTrigger value="dialog" className="flex-1" data-testid="situation-tab-dialog">
                {t('situations.detail.tabs.dialog')}
              </TabsTrigger>
              <TabsTrigger
                value="description"
                className="flex-1"
                data-testid="situation-tab-description"
              >
                {t('situations.detail.tabs.description')}
              </TabsTrigger>
              <TabsTrigger value="picture" className="flex-1" data-testid="situation-tab-picture">
                {t('situations.detail.tabs.picture')}
              </TabsTrigger>
            </TabsList>

            {/* Dialog Tab */}
            <TabsContent value="dialog" className="space-y-4">
              {selectedSituation.dialog ? (
                <div className="space-y-2">
                  {selectedSituation.dialog.lines.map((line) => {
                    const speakerIdx = getSpeakerIndex(line.speaker_id);
                    const style = getSpeakerStyle(speakerIdx);
                    const isLeft = speakerIdx % 2 === 0;
                    return (
                      <div
                        key={line.id}
                        className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg border p-3 ${style.bg} ${style.border}`}
                        >
                          <p className={`mb-1 text-xs font-semibold ${style.name}`}>
                            {getSpeakerName(line.speaker_id)}
                          </p>
                          <p className="text-sm">{line.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
                  data-testid="situation-dialog-empty"
                >
                  <MessageSquare className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('situations.detail.dialogEmpty')}</p>
                </div>
              )}
              <AudioPlaceholder />
              <RegenerateButton />
            </TabsContent>

            {/* Description Tab */}
            <TabsContent value="description" className="space-y-4">
              {selectedSituation.description ? (
                <p className="text-sm leading-relaxed">{selectedSituation.description.text_el}</p>
              ) : (
                <div
                  className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
                  data-testid="situation-description-empty"
                >
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('situations.detail.descriptionEmpty')}</p>
                </div>
              )}
              <AudioPlaceholder />
              <RegenerateButton />
            </TabsContent>

            {/* Picture Tab */}
            <TabsContent value="picture" className="space-y-4">
              <div
                className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
                data-testid="situation-picture-empty"
              >
                <Image className="h-8 w-8 opacity-40" />
                <p className="text-sm">{t('situations.detail.pictureEmpty')}</p>
              </div>
              <AudioPlaceholder />
              <RegenerateButton />
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          {selectedSituation && (
            <Button
              variant="destructive"
              onClick={() => onDelete(selectedSituation)}
              data-testid="situation-detail-delete-btn"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('situations.delete.title')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
