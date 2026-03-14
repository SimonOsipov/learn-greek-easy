// src/components/admin/DialogDetailModal.tsx

import { useEffect, useRef, useState } from 'react';

import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useAdminDialogStore } from '@/stores/adminDialogStore';

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
  const { currentLanguage } = useLanguage();

  const { selectedDialog, isLoadingDetail, detailError, fetchDialogDetail, clearSelectedDialog } =
    useAdminDialogStore();

  // Local state
  const [audioCurrentTimeMs, setAudioCurrentTimeMs] = useState(0);

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
      setAudioCurrentTimeMs(0);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
