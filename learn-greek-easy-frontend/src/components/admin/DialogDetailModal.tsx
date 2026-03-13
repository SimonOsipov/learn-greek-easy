// src/components/admin/DialogDetailModal.tsx

import { useCallback, useEffect, useRef, useState } from 'react';

import { BookOpen, Loader2, MessageSquare, Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/hooks/useLanguage';
import { useSSE } from '@/hooks/useSSE';
import { getDialogAudioStreamUrl } from '@/services/adminAPI';
import { useAdminDialogStore } from '@/stores/adminDialogStore';
import type { SSEEvent } from '@/types/sse';

// ============================================================================
// Constants
// ============================================================================

const SPEAKER_COLORS = ['text-blue-600', 'text-green-600', 'text-orange-600', 'text-purple-600'];

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
  const tCommon = useTranslation('common').t;
  const { currentLanguage } = useLanguage();

  const {
    selectedDialog,
    isLoadingDetail,
    detailError,
    fetchDialogDetail,
    clearSelectedDialog,
    deleteDialog,
  } = useAdminDialogStore();

  // Local state
  const [sseEnabled, setSseEnabled] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [audioCurrentTimeMs, setAudioCurrentTimeMs] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Ref for finding the audio element inside WaveformPlayer's container
  const containerRef = useRef<HTMLDivElement>(null);

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
      setAudioCurrentTimeMs(0);
      setConfirmingDelete(false);
    }
  }, [open, clearSelectedDialog]);

  // Effect 3: Attach timeupdate listener to audio element
  useEffect(() => {
    if (
      !selectedDialog ||
      (selectedDialog.status !== 'audio_ready' && selectedDialog.status !== 'exercises_ready')
    ) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const audio = container.querySelector<HTMLAudioElement>(
      '[data-testid="waveform-audio-element"]'
    );
    if (!audio) return;

    const handleTimeUpdate = () => {
      setAudioCurrentTimeMs(audio.currentTime * 1000);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [selectedDialog]);

  // SSE event handler
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
        case 'dialog_audio:error':
          setSseEnabled(false);
          setGenerationError(
            t('listeningDialogs.detail.generateAudio.error', {
              message: (event.data as Record<string, unknown>)?.message ?? 'Unknown error',
            })
          );
          break;
      }
    },
    [t, dialogId, fetchDialogDetail]
  );

  // SSE error handler
  const handleSSEError = useCallback(() => {
    setSseEnabled(false);
    setGenerationError(
      t('listeningDialogs.detail.generateAudio.error', { message: 'Stream error' })
    );
  }, [t]);

  // SSE hook
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

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        data-testid="dialog-detail-modal"
      >
        <DialogHeader>
          <DialogTitle>
            {selectedDialog
              ? getLocalizedScenario(selectedDialog, currentLanguage)
              : t('listeningDialogs.detail.title')}
          </DialogTitle>
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
          <>
            {/* Transcript */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquare className="h-4 w-4" />
                {t('listeningDialogs.detail.transcript')}
              </div>
              {selectedDialog.lines.map((line) => {
                const speaker = speakerMap.get(line.speaker_id);
                const colorClass = SPEAKER_COLORS[speaker?.speaker_index ?? 0] ?? 'text-gray-600';
                const isActive = activeLine?.id === line.id;
                return (
                  <div
                    key={line.id}
                    data-testid={`dialog-line-${line.line_index}`}
                    className={
                      isActive
                        ? 'border-l-2 border-primary bg-primary/10 pl-3 transition-colors duration-200'
                        : 'border-l-2 border-transparent pl-3'
                    }
                  >
                    <span className={`text-xs font-medium ${colorClass}`}>
                      {speaker?.character_name}
                    </span>
                    <p className="text-sm">{line.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Audio Player */}
            {(selectedDialog.status === 'audio_ready' ||
              selectedDialog.status === 'exercises_ready') && (
              <div ref={containerRef} data-testid="dialog-audio-player">
                <WaveformPlayer
                  variant="admin"
                  audioUrl={selectedDialog.audio_url ?? undefined}
                  showSpeedControl={false}
                  barCount={60}
                />
              </div>
            )}

            {/* Generate Audio (draft only) */}
            {selectedDialog.status === 'draft' && (
              <div className="space-y-2">
                {!sseEnabled && !generationProgress && (
                  <Button
                    data-testid="dialog-generate-audio-btn"
                    onClick={() => {
                      setGenerationError(null);
                      setSseEnabled(true);
                    }}
                    disabled={sseEnabled}
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

            {/* Generate Exercises stub (audio_ready only) */}
            {selectedDialog.status === 'audio_ready' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        data-testid="dialog-generate-exercises-btn"
                        disabled
                        variant="outline"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        {t('listeningDialogs.detail.generateExercises.button')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('listeningDialogs.detail.generateExercises.comingSoon')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Delete with inline confirmation */}
            <div className="flex gap-2">
              {!confirmingDelete ? (
                <Button
                  data-testid="dialog-detail-delete-btn"
                  variant="destructive"
                  disabled={sseEnabled}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('listeningDialogs.detail.delete')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await deleteDialog(selectedDialog.id);
                      onOpenChange(false);
                    }}
                  >
                    {tCommon('confirm')}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                    {tCommon('cancel')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
