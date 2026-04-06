import { useCallback, useEffect, useState } from 'react';

import { FileText, Image, Loader2, MessageSquare, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { KaraokeText } from '@/components/shared/KaraokeText';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useAudioTimeMs } from '@/hooks/useAudioTimeMs';
import { useLanguage } from '@/hooks/useLanguage';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { getDescriptionAudioStreamUrl, getDialogAudioStreamUrl } from '@/services/adminAPI';
import {
  useAdminSituationStore,
  selectSelectedSituation,
  selectIsLoadingDetail,
  selectDetailError,
} from '@/stores/adminSituationStore';
import type { SSEEvent } from '@/types/sse';

import { SITUATION_STATUS_BADGE_CLASSES } from './situationBadges';
import { SituationExercisesTab } from './SituationExercisesTab';

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
}: SituationDetailModalProps) {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const selectedSituation = useAdminSituationStore(selectSelectedSituation);
  const isLoadingDetail = useAdminSituationStore(selectIsLoadingDetail);
  const detailError = useAdminSituationStore(selectDetailError);
  const { fetchSituationDetail, clearSelectedSituation } = useAdminSituationStore();

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [descB1ContainerEl, setDescB1ContainerEl] = useState<HTMLDivElement | null>(null);
  const [descA2ContainerEl, setDescA2ContainerEl] = useState<HTMLDivElement | null>(null);
  const [sseEnabled, setSseEnabled] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [descB1SseEnabled, setDescB1SseEnabled] = useState(false);
  const [descB1Stage, setDescB1Stage] = useState<string | null>(null);
  const [descA2SseEnabled, setDescA2SseEnabled] = useState(false);
  const [descA2Stage, setDescA2Stage] = useState<string | null>(null);

  const dialogAudioEnabled =
    !!selectedSituation?.dialog &&
    (selectedSituation.dialog.status === 'audio_ready' ||
      selectedSituation.dialog.status === 'exercises_ready') &&
    !sseEnabled;

  const audioCurrentTimeMs = useAudioTimeMs(containerEl, dialogAudioEnabled);

  const descB1Enabled =
    !!selectedSituation?.description?.audio_url &&
    !!selectedSituation?.description?.word_timestamps?.length &&
    !descB1SseEnabled;

  const descA2Enabled =
    !!selectedSituation?.description?.audio_a2_url &&
    !!selectedSituation?.description?.word_timestamps_a2?.length &&
    !descA2SseEnabled;

  const descB1TimeMs = useAudioTimeMs(descB1ContainerEl, descB1Enabled);
  const descA2TimeMs = useAudioTimeMs(descA2ContainerEl, descA2Enabled);

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
      setDescB1SseEnabled(false);
      setDescB1Stage(null);
      setDescA2SseEnabled(false);
      setDescA2Stage(null);
    }
  }, [open, clearSelectedSituation]);

  const startAudioRegeneration = useCallback(() => {
    const audioEl = containerEl?.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    audioEl?.pause();
    setGenerationError(null);
    setSseEnabled(true);
  }, [containerEl]);

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

  // B1 description audio stream
  useSSE(situationId ? getDescriptionAudioStreamUrl(situationId, 'b1') : '', {
    method: 'POST',
    body: {},
    enabled: descB1SseEnabled && !!situationId,
    maxRetries: 0,
    reconnect: false,
    onEvent: (event) => {
      const data = (event.data ?? {}) as Record<string, unknown>;
      switch (event.type) {
        case 'description_audio:start':
          setDescB1Stage('starting');
          break;
        case 'description_audio:tts':
        case 'description_audio:elevenlabs':
          setDescB1Stage('generating');
          break;
        case 'description_audio:upload':
          setDescB1Stage('uploading');
          break;
        case 'description_audio:complete':
          setDescB1Stage(null);
          setDescB1SseEnabled(false);
          if (situationId) void fetchSituationDetail(situationId);
          break;
        case 'description_audio:error':
          setDescB1Stage(null);
          setDescB1SseEnabled(false);
          toast({
            title: String(data.error ?? t('situations.detail.descriptionAudio.regenerateError')),
            variant: 'destructive',
          });
          break;
      }
    },
    onError: () => {
      setDescB1Stage(null);
      setDescB1SseEnabled(false);
      toast({
        title: t('situations.detail.descriptionAudio.regenerateError'),
        variant: 'destructive',
      });
    },
  });

  // A2 description audio stream
  useSSE(situationId ? getDescriptionAudioStreamUrl(situationId, 'a2') : '', {
    method: 'POST',
    body: {},
    enabled: descA2SseEnabled && !!situationId,
    maxRetries: 0,
    reconnect: false,
    onEvent: (event) => {
      const data = (event.data ?? {}) as Record<string, unknown>;
      switch (event.type) {
        case 'description_audio:start':
          setDescA2Stage('starting');
          break;
        case 'description_audio:tts':
        case 'description_audio:elevenlabs':
          setDescA2Stage('generating');
          break;
        case 'description_audio:upload':
          setDescA2Stage('uploading');
          break;
        case 'description_audio:complete':
          setDescA2Stage(null);
          setDescA2SseEnabled(false);
          if (situationId) void fetchSituationDetail(situationId);
          break;
        case 'description_audio:error':
          setDescA2Stage(null);
          setDescA2SseEnabled(false);
          toast({
            title: String(data.error ?? t('situations.detail.descriptionAudio.regenerateError')),
            variant: 'destructive',
          });
          break;
      }
    },
    onError: () => {
      setDescA2Stage(null);
      setDescA2SseEnabled(false);
      toast({
        title: t('situations.detail.descriptionAudio.regenerateError'),
        variant: 'destructive',
      });
    },
  });

  const handleRegenerateDescB1 = useCallback(() => {
    if (!situationId || descB1SseEnabled) return;
    setDescB1Stage('starting');
    setDescB1SseEnabled(true);
  }, [situationId, descB1SseEnabled]);

  const handleRegenerateDescA2 = useCallback(() => {
    if (!situationId || descA2SseEnabled) return;
    setDescA2Stage('starting');
    setDescA2SseEnabled(true);
  }, [situationId, descA2SseEnabled]);

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

  const activeLine =
    selectedSituation?.dialog?.lines.find(
      (line) =>
        line.start_time_ms !== null &&
        line.end_time_ms !== null &&
        line.start_time_ms <= audioCurrentTimeMs &&
        audioCurrentTimeMs < line.end_time_ms
    ) ?? null;

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
              <TabsTrigger
                value="exercises"
                className="flex-1"
                data-testid="situation-tab-exercises"
              >
                {t('situations.detail.tabs.exercises')}
              </TabsTrigger>
            </TabsList>

            {/* Dialog Tab */}
            <TabsContent value="dialog" className="space-y-4">
              {/* Audio player — shown when audio exists and SSE is not active */}
              {selectedSituation.dialog &&
                (selectedSituation.dialog.status === 'audio_ready' ||
                  selectedSituation.dialog.status === 'exercises_ready') &&
                !sseEnabled &&
                !generationProgress && (
                  <div ref={setContainerEl} data-testid="situation-dialog-audio-player">
                    {selectedSituation.dialog.audio_url ? (
                      <WaveformPlayer
                        variant="admin"
                        audioUrl={selectedSituation.dialog.audio_url}
                        duration={selectedSituation.dialog.audio_duration_seconds ?? undefined}
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

              {selectedSituation.dialog && selectedSituation.dialog.lines.length > 0 ? (
                <div className="space-y-2">
                  {selectedSituation.dialog.lines.map((line) => {
                    const speakerIdx = getSpeakerIndex(line.speaker_id);
                    const style = getSpeakerStyle(speakerIdx);
                    const isLeft = speakerIdx % 2 === 0;
                    return (
                      <div key={line.id} className={cn('flex', !isLeft && 'justify-end')}>
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg border p-3 transition-shadow duration-200',
                            style.bg,
                            style.border,
                            activeLine?.id === line.id && 'shadow-md'
                          )}
                        >
                          <p className={`mb-1 text-xs font-semibold ${style.name}`}>
                            {getSpeakerName(line.speaker_id)}
                          </p>
                          <KaraokeText
                            wordTimestamps={line.word_timestamps ?? []}
                            currentTimeMs={audioCurrentTimeMs}
                            fallbackText={line.text}
                          />
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
                <>
                  {/* B1 Section */}
                  <div data-testid="situation-description-b1-section" className="space-y-2">
                    <Badge variant="outline">B1</Badge>
                    {selectedSituation.description.word_timestamps?.length ? (
                      <KaraokeText
                        wordTimestamps={selectedSituation.description.word_timestamps}
                        currentTimeMs={descB1TimeMs}
                        fallbackText={selectedSituation.description.text_el}
                        className="leading-relaxed"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed">
                        {selectedSituation.description.text_el}
                      </p>
                    )}
                    {selectedSituation.description.audio_url ? (
                      <div ref={setDescB1ContainerEl}>
                        <WaveformPlayer
                          variant="admin"
                          audioUrl={selectedSituation.description.audio_url}
                          duration={
                            selectedSituation.description.audio_duration_seconds ?? undefined
                          }
                          showSpeedControl={false}
                          barCount={60}
                        />
                      </div>
                    ) : (
                      <AudioPlaceholder />
                    )}
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateDescB1}
                        disabled={
                          descB1SseEnabled || !selectedSituation.description.text_el?.trim()
                        }
                        data-testid="situation-desc-regenerate-b1-audio"
                      >
                        {descB1Stage !== null ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t(`situations.detail.descriptionAudio.stage.${descB1Stage}`)}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('situations.detail.descriptionAudio.regenerateB1')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* A2 Section */}
                  <div data-testid="situation-description-a2-section" className="space-y-2">
                    <Badge variant="outline">A2</Badge>
                    {selectedSituation.description.text_el_a2 ? (
                      selectedSituation.description.word_timestamps_a2?.length ? (
                        <KaraokeText
                          wordTimestamps={selectedSituation.description.word_timestamps_a2}
                          currentTimeMs={descA2TimeMs}
                          fallbackText={selectedSituation.description.text_el_a2}
                          className="leading-relaxed"
                        />
                      ) : (
                        <p className="text-sm leading-relaxed">
                          {selectedSituation.description.text_el_a2}
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('situations.detail.descriptionA2Empty')}
                      </p>
                    )}
                    {selectedSituation.description.audio_a2_url ? (
                      <div ref={setDescA2ContainerEl}>
                        <WaveformPlayer
                          variant="admin"
                          audioUrl={selectedSituation.description.audio_a2_url}
                          duration={
                            selectedSituation.description.audio_a2_duration_seconds ?? undefined
                          }
                          showSpeedControl={false}
                          barCount={60}
                        />
                      </div>
                    ) : (
                      <AudioPlaceholder />
                    )}
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateDescA2}
                        disabled={
                          descA2SseEnabled || !selectedSituation.description.text_el_a2?.trim()
                        }
                        data-testid="situation-desc-regenerate-a2-audio"
                      >
                        {descA2Stage !== null ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t(`situations.detail.descriptionAudio.stage.${descA2Stage}`)}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('situations.detail.descriptionAudio.regenerateA2')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
                  data-testid="situation-description-empty"
                >
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('situations.detail.descriptionEmpty')}</p>
                </div>
              )}
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

            {/* Exercises Tab */}
            <TabsContent value="exercises" className="space-y-4">
              {situationId && <SituationExercisesTab situationId={situationId} />}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
