import { useCallback, useEffect, useRef, useState } from 'react';

import { FileText, Image, Loader2, MessageSquare, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { useSSE } from '@/hooks/useSSE';
import { getDialogAudioStreamUrl } from '@/services/adminAPI';
import {
  useAdminSituationStore,
  selectSelectedSituation,
  selectIsLoadingDetail,
  selectDetailError,
} from '@/stores/adminSituationStore';
import type { SituationDetailResponse } from '@/types/situation';
import type { SSEEvent } from '@/types/sse';

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [sseEnabled, setSseEnabled] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (open && situationId) {
      void fetchSituationDetail(situationId);
    }
  }, [open, situationId, fetchSituationDetail]);

  useEffect(() => {
    if (!open) {
      clearSelectedSituation();
      setSseEnabled(false);
      setGenerationProgress(null);
      setGenerationError(null);
    }
  }, [open, clearSelectedSituation]);

  const startAudioRegeneration = useCallback(() => {
    const audioEl = containerRef.current?.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    audioEl?.pause();
    setGenerationError(null);
    setSseEnabled(true);
  }, []);

  const handleSSEEvent = useCallback(
    (event: SSEEvent<unknown>) => {
      switch (event.type) {
        case 'dialog_audio:start':
          setGenerationProgress(t('listeningDialogs.detail.generateAudio.progress.starting'));
          break;
        case 'dialog_audio:elevenlabs':
          setGenerationProgress(
            t('listeningDialogs.detail.generateAudio.progress.callingElevenLabs')
          );
          break;
        case 'dialog_audio:timing':
          setGenerationProgress(
            t('listeningDialogs.detail.generateAudio.progress.settingTimestamps')
          );
          break;
        case 'dialog_audio:upload':
          setGenerationProgress(t('listeningDialogs.detail.generateAudio.progress.uploading'));
          break;
        case 'dialog_audio:complete':
          setSseEnabled(false);
          setGenerationProgress(null);
          if (situationId) {
            void fetchSituationDetail(situationId);
          }
          break;
        case 'dialog_audio:error': {
          const errData = event.data as Record<string, unknown>;
          const errMsg = (errData?.error ?? errData?.message ?? '') as string;
          setSseEnabled(false);
          setGenerationProgress(null);
          setGenerationError(
            t('listeningDialogs.detail.generateAudio.error', {
              message: errMsg || t('listeningDialogs.detail.errors.loadFailed'),
            })
          );
          break;
        }
      }
    },
    [t, situationId, fetchSituationDetail]
  );

  const handleSSEError = useCallback(() => {
    setSseEnabled(false);
    setGenerationProgress(null);
    setGenerationError(
      t('listeningDialogs.detail.generateAudio.error', {
        message: t('listeningDialogs.detail.errors.loadFailed'),
      })
    );
  }, [t]);

  const dialogId = selectedSituation?.dialog?.id;
  const sseUrl = dialogId ? getDialogAudioStreamUrl(dialogId) : '';
  useSSE(sseUrl, {
    method: 'POST',
    body: {},
    enabled: sseEnabled && !!dialogId,
    maxRetries: 0,
    reconnect: false,
    onEvent: handleSSEEvent,
    onError: handleSSEError,
  });

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
            <DialogTitle className="text-destructive">
              {t('situations.detail.fetchError')}
            </DialogTitle>
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
              {selectedSituation.dialog && selectedSituation.dialog.lines.length > 0 ? (
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

              {/* Audio player — shown when audio exists and SSE is not active */}
              {selectedSituation.dialog &&
                (selectedSituation.dialog.status === 'audio_ready' ||
                  selectedSituation.dialog.status === 'exercises_ready') &&
                !sseEnabled &&
                !generationProgress && (
                  <div ref={containerRef} data-testid="situation-dialog-audio-player">
                    {selectedSituation.dialog.audio_url ? (
                      <WaveformPlayer
                        variant="admin"
                        audioUrl={selectedSituation.dialog.audio_url}
                        showSpeedControl={false}
                        barCount={60}
                      />
                    ) : (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {t('listeningDialogs.detail.errors.audioUrlMissing')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

              {/* Generate Audio — shown for draft dialog */}
              {selectedSituation.dialog && selectedSituation.dialog.status === 'draft' && (
                <div className="space-y-2 pt-2">
                  {!sseEnabled && !generationProgress && !generationError && (
                    <Button
                      data-testid="situation-dialog-generate-audio-btn"
                      onClick={() => {
                        setGenerationError(null);
                        setSseEnabled(true);
                      }}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      {t('listeningDialogs.detail.generateAudio.button')}
                    </Button>
                  )}
                  {generationProgress && (
                    <div
                      data-testid="situation-dialog-generation-progress"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {generationProgress}
                    </div>
                  )}
                  {generationError && (
                    <div data-testid="situation-dialog-generation-error">
                      <Alert variant="destructive">
                        <AlertDescription>{generationError}</AlertDescription>
                      </Alert>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setGenerationError(null);
                          setSseEnabled(true);
                        }}
                      >
                        {t('listeningDialogs.detail.generateAudio.tryAgain')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Regenerate Audio — shown when audio already exists */}
              {selectedSituation.dialog &&
                (selectedSituation.dialog.status === 'audio_ready' ||
                  selectedSituation.dialog.status === 'exercises_ready') && (
                  <div className="space-y-2 pt-2">
                    {!sseEnabled && !generationProgress && !generationError && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="situation-dialog-regenerate-audio-btn"
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('listeningDialogs.detail.regenerateAudio.button')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('listeningDialogs.detail.regenerateAudio.confirmTitle')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('listeningDialogs.detail.regenerateAudio.confirmDescription')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t('listeningDialogs.detail.regenerateAudio.cancelButton')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={startAudioRegeneration}
                            >
                              {t('listeningDialogs.detail.regenerateAudio.confirmButton')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {generationProgress && (
                      <div
                        data-testid="situation-dialog-generation-progress"
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {generationProgress}
                      </div>
                    )}
                    {generationError && (
                      <div data-testid="situation-dialog-generation-error">
                        <Alert variant="destructive">
                          <AlertDescription>{generationError}</AlertDescription>
                        </Alert>
                        <Button variant="outline" className="mt-2" onClick={startAudioRegeneration}>
                          {t('listeningDialogs.detail.generateAudio.tryAgain')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
