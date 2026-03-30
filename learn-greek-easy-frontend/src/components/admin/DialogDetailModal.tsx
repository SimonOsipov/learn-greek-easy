// src/components/admin/DialogDetailModal.tsx

import { useCallback, useEffect, useState } from 'react';

import { AlertTriangle, BookOpen, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { KaraokeText } from '@/components/admin/KaraokeText';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAudioTimeMs } from '@/hooks/useAudioTimeMs';
import { useLanguage } from '@/hooks/useLanguage';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { getDialogAudioStreamUrl } from '@/services/adminAPI';
import { useAdminDialogStore } from '@/stores/adminDialogStore';
import type { SSEEvent } from '@/types/sse';

import {
  CEFR_BADGE_CLASSES,
  CEFR_BADGE_FALLBACK,
  STATUS_BADGE_CLASSES,
  formatAudioDuration,
} from './dialogBadges';

// ============================================================================
// Constants
// ============================================================================

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
const DEFAULT_BUBBLE_STYLE = SPEAKER_BUBBLE_STYLES[0];

// ============================================================================
// Helpers
// ============================================================================

function getLocalizedScenario(
  dialog: { scenario_en: string; scenario_el: string; scenario_ru: string },
  lang: string
): string {
  switch (lang) {
    case 'el':
      return dialog.scenario_el;
    case 'ru':
      return dialog.scenario_ru;
    default:
      return dialog.scenario_en;
  }
}

function splitScenario(text: string): { title: string; description: string | null } {
  const dotIndex = text.indexOf('. ');
  if (dotIndex === -1) {
    if (text.endsWith('.')) return { title: text.slice(0, -1), description: null };
    return { title: text, description: null };
  }
  return { title: text.slice(0, dotIndex), description: text.slice(dotIndex + 2) };
}

// ============================================================================
// Props
// ============================================================================

interface DialogDetailModalProps {
  dialogId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DialogDetailModal({ dialogId, open, onOpenChange }: DialogDetailModalProps) {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();

  const { selectedDialog, isLoadingDetail, detailError, fetchDialogDetail, clearSelectedDialog } =
    useAdminDialogStore();

  // Local state
  const [sseEnabled, setSseEnabled] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Ref for finding the audio element inside WaveformPlayer's container
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const dialogAudioEnabled =
    !!selectedDialog &&
    (selectedDialog.status === 'audio_ready' || selectedDialog.status === 'exercises_ready') &&
    !sseEnabled;

  const audioCurrentTimeMs = useAudioTimeMs(containerEl, dialogAudioEnabled);

  const startAudioRegeneration = useCallback(() => {
    const audioEl = containerEl?.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    audioEl?.pause();
    setGenerationError(null);
    setSseEnabled(true);
  }, [containerEl]);

  // Effect 1: Fetch detail when modal opens
  useEffect(() => {
    if (open && dialogId) {
      void fetchDialogDetail(dialogId);
    }
  }, [open, dialogId, fetchDialogDetail]);

  // Effect 2: Reset state when modal closes
  useEffect(() => {
    if (!open) {
      clearSelectedDialog();
      setSseEnabled(false);
      setGenerationProgress(null);
      setGenerationError(null);
    }
  }, [open, clearSelectedDialog]);

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
          if (dialogId) {
            void fetchDialogDetail(dialogId);
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
    [t, dialogId, fetchDialogDetail]
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

  // Build speaker map for color lookup
  const speakerMap = new Map((selectedDialog?.speakers ?? []).map((s) => [s.id, s]));

  // Active line: first line with valid timestamps that bracket current time
  const activeLine =
    selectedDialog?.lines.find(
      (line) =>
        line.start_time_ms !== null &&
        line.end_time_ms !== null &&
        line.start_time_ms <= audioCurrentTimeMs &&
        audioCurrentTimeMs < line.end_time_ms
    ) ?? null;

  const scenario = selectedDialog
    ? splitScenario(getLocalizedScenario(selectedDialog, currentLanguage))
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        data-testid="dialog-detail-modal"
      >
        <DialogHeader>
          <DialogTitle>
            {scenario ? scenario.title : t('listeningDialogs.detail.title')}
          </DialogTitle>
          {scenario && (
            <>
              {scenario.description ? (
                <DialogDescription className="text-muted-foreground">
                  {scenario.description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  {t('listeningDialogs.detail.title')}
                </DialogDescription>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge
                  variant="outline"
                  className={CEFR_BADGE_CLASSES[selectedDialog.cefr_level] ?? CEFR_BADGE_FALLBACK}
                >
                  {selectedDialog.cefr_level}
                </Badge>
                <Badge variant="outline">
                  {selectedDialog.num_speakers}{' '}
                  {selectedDialog.num_speakers === 1 ? 'speaker' : 'speakers'}
                </Badge>
                {selectedDialog.audio_duration_seconds != null && (
                  <Badge variant="outline">
                    {formatAudioDuration(selectedDialog.audio_duration_seconds)}
                  </Badge>
                )}
                <Badge variant="outline" className={STATUS_BADGE_CLASSES[selectedDialog.status]}>
                  {t(`listeningDialogs.status.${selectedDialog.status}`)}
                </Badge>
              </div>
            </>
          )}
        </DialogHeader>

        {/* Loading state */}
        {isLoadingDetail && (
          <div data-testid="dialog-detail-loading" className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {/* Error state */}
        {detailError && !isLoadingDetail && (
          <div data-testid="dialog-detail-error">
            <Alert variant="destructive">
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                if (dialogId) void fetchDialogDetail(dialogId);
              }}
              className="mt-2"
            >
              {t('listeningDialogs.detail.errors.retry')}
            </Button>
          </div>
        )}

        {/* Main content */}
        {selectedDialog && !isLoadingDetail && (
          <div className="space-y-4">
            {selectedDialog.degenerate_line_count > 0 && (
              <Alert
                className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 [&>svg]:text-amber-600"
                data-testid="dialog-degenerate-warning"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('listeningDialogs.detail.degenerateWarning', {
                    count: selectedDialog.degenerate_line_count,
                  })}
                </AlertDescription>
              </Alert>
            )}
            <Tabs defaultValue="dialog" data-testid="dialog-detail-tabs">
              <TabsList className="w-full">
                <TabsTrigger value="dialog" className="flex-1" data-testid="dialog-tab-dialog">
                  {t('listeningDialogs.detail.tabs.dialog')}
                </TabsTrigger>
                <TabsTrigger
                  value="exercises"
                  className="flex-1"
                  data-testid="dialog-tab-exercises"
                >
                  {t('listeningDialogs.detail.tabs.exercises')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dialog" className="space-y-4">
                {/* Audio Player FIRST (moved above transcript) */}
                {(selectedDialog.status === 'audio_ready' ||
                  selectedDialog.status === 'exercises_ready') &&
                  !sseEnabled &&
                  !generationProgress && (
                    <div ref={setContainerEl} data-testid="dialog-audio-player">
                      {selectedDialog.audio_url ? (
                        <WaveformPlayer
                          variant="admin"
                          audioUrl={selectedDialog.audio_url}
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

                {/* Transcript */}
                <div className="space-y-3">
                  {selectedDialog.lines.map((line) => {
                    const speaker = speakerMap.get(line.speaker_id);
                    const speakerIdx = speaker?.speaker_index ?? 0;
                    const style =
                      SPEAKER_BUBBLE_STYLES[speakerIdx % SPEAKER_BUBBLE_STYLES.length] ??
                      DEFAULT_BUBBLE_STYLE;
                    const isActive = activeLine?.id === line.id;
                    const isRight = speakerIdx % 2 === 1;
                    return (
                      <div
                        key={line.id}
                        data-testid={`dialog-line-${line.line_index}`}
                        className={cn('flex', isRight && 'justify-end')}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg border p-3 transition-shadow duration-200',
                            style.bg,
                            style.border,
                            isActive && 'shadow-md'
                          )}
                        >
                          <p className={cn('mb-1 text-xs font-medium', style.name)}>
                            {speaker?.character_name}
                            {line.start_time_ms !== null &&
                              line.start_time_ms === line.end_time_ms && (
                                <AlertTriangle
                                  className="ml-1 inline h-3 w-3 text-amber-500"
                                  data-testid={`dialog-line-${line.line_index}-degenerate`}
                                  title={t('listeningDialogs.detail.degenerateLine')}
                                />
                              )}
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

                {/* Generate Audio (draft only) */}
                {selectedDialog.status === 'draft' && (
                  <div className="space-y-2 pt-2">
                    {!sseEnabled && !generationProgress && !generationError && (
                      <Button
                        data-testid="dialog-generate-audio-btn"
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
                        data-testid="dialog-generation-progress"
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {generationProgress}
                      </div>
                    )}
                    {generationError && (
                      <div data-testid="dialog-generation-error">
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

                {/* Regenerate Audio (audio_ready / exercises_ready) */}
                {(selectedDialog.status === 'audio_ready' ||
                  selectedDialog.status === 'exercises_ready') && (
                  <div className="space-y-2 pt-2">
                    {!sseEnabled && !generationProgress && !generationError && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" data-testid="dialog-regenerate-audio-btn">
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
                        data-testid="dialog-generation-progress"
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {generationProgress}
                      </div>
                    )}
                    {generationError && (
                      <div data-testid="dialog-generation-error">
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

              <TabsContent value="exercises">
                <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 opacity-40" />
                  <p>{t('listeningDialogs.detail.exercises.empty')}</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
