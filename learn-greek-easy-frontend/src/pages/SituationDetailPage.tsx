import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { KaraokeText } from '@/components/shared/KaraokeText';
import { SourceCard } from '@/components/situations/SourceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAudioTimeMs } from '@/hooks/useAudioTimeMs';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
import { situationAPI } from '@/services/situationAPI';
import type { LearnerSituationDetailResponse } from '@/types/situation';

// Speaker bubble color rotation (4-color, same as admin modal)
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

export const SituationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { currentLanguage } = useLanguage();

  // Fetch situation
  const {
    data: situation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LearnerSituationDetailResponse>({
    queryKey: ['situation', id],
    queryFn: () => situationAPI.getById(id!),
    enabled: !!id,
  });

  // PostHog tracking on mount
  const hasTracked = useRef(false);
  useEffect(() => {
    if (situation && !hasTracked.current) {
      hasTracked.current = true;
      track('situation_detail_viewed', {
        situation_id: situation.id,
        status: situation.status,
        has_audio: !!situation.description?.audio_url,
        has_dialog: !!situation.dialog,
        exercise_total: situation.exercise_total,
        exercise_completed: situation.exercise_completed,
      });
    }
  }, [situation]);

  // B1 description audio container ref
  const [descB1ContainerEl, setDescB1ContainerEl] = useState<HTMLDivElement | null>(null);
  const descB1Enabled =
    !!situation?.description?.audio_url && !!situation?.description?.word_timestamps?.length;
  const descB1TimeMs = useAudioTimeMs(descB1ContainerEl, descB1Enabled);

  // A2 description audio container ref
  const [descA2ContainerEl, setDescA2ContainerEl] = useState<HTMLDivElement | null>(null);
  const descA2Enabled =
    !!situation?.description?.audio_a2_url && !!situation?.description?.word_timestamps_a2?.length;
  const descA2TimeMs = useAudioTimeMs(descA2ContainerEl, descA2Enabled);

  // Dialog audio container ref
  const [dialogContainerEl, setDialogContainerEl] = useState<HTMLDivElement | null>(null);
  const dialogEnabled = !!situation?.dialog?.audio_url;
  const dialogTimeMs = useAudioTimeMs(dialogContainerEl, dialogEnabled);

  // PostHog audio play handlers
  const handleB1Play = useCallback(
    (duration: number) => {
      if (!situation) return;
      track('situation_audio_played', {
        situation_id: situation.id,
        audio_type: 'description_b1',
        duration_seconds: duration,
      });
    },
    [situation?.id]
  );

  const handleA2Play = useCallback(
    (duration: number) => {
      if (!situation) return;
      track('situation_audio_played', {
        situation_id: situation.id,
        audio_type: 'description_a2',
        duration_seconds: duration,
      });
    },
    [situation?.id]
  );

  const handleDialogPlay = useCallback(
    (duration: number) => {
      if (!situation) return;
      track('situation_audio_played', {
        situation_id: situation.id,
        audio_type: 'dialog',
        duration_seconds: duration,
      });
    },
    [situation?.id]
  );

  if (!id) return <div>Not found</div>;

  // Check if error is a 404
  const is404 = isError && (error as { status?: number })?.status === 404;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8" data-testid="situation-detail">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="mb-2 h-12 w-3/4" />
        <Skeleton className="mb-8 h-6 w-1/2" />
        <Skeleton className="mb-4 h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (is404 || (!isError && !isLoading && !situation)) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" data-testid="situation-detail">
        <p className="mb-4 text-muted-foreground">{t('situations.detail.notFound')}</p>
        <Button onClick={() => navigate('/situations')}>{t('situations.detail.backToList')}</Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" data-testid="situation-detail">
        <p className="mb-4 text-muted-foreground">{t('situations.error.description')}</p>
        <Button onClick={() => void refetch()}>{t('situations.error.retry')}</Button>
      </div>
    );
  }

  if (!situation) return null;

  const scenarioTitle = currentLanguage === 'ru' ? situation.scenario_ru : situation.scenario_en;

  // Active dialog line (for line-level highlighting)
  const activeLine =
    situation.dialog?.lines.find(
      (line) =>
        line.start_time_ms != null &&
        line.end_time_ms != null &&
        line.start_time_ms <= dialogTimeMs &&
        dialogTimeMs < line.end_time_ms
    ) ?? null;

  return (
    <div className="container mx-auto px-4 py-8 pb-20 lg:pb-8" data-testid="situation-detail">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-6"
        onClick={() => navigate('/situations')}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t('situations.detail.back')}
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold">{scenarioTitle}</h1>
        <p className="mb-3 text-muted-foreground">{situation.scenario_el}</p>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('situations.detail.exercises', {
              completed: situation.exercise_completed,
              total: situation.exercise_total,
            })}
          </span>
        </div>
      </div>

      {/* Source card */}
      {situation.source_url && (
        <div className="mb-8 lg:w-[calc(50%-0.75rem)]">
          <SourceCard
            sourceUrl={situation.source_url}
            sourceImageUrl={situation.source_image_url}
            sourceTitle={situation.source_title}
          />
        </div>
      )}

      {/* Descriptions grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* A2 Description */}
        {situation.description?.text_el_a2 && (
          <section ref={setDescA2ContainerEl} className="flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('situations.detail.description')}</h2>
              <Badge variant="secondary">A2</Badge>
            </div>
            {descA2Enabled ? (
              <KaraokeText
                wordTimestamps={situation.description.word_timestamps_a2 ?? []}
                currentTimeMs={descA2TimeMs}
                fallbackText={situation.description.text_el_a2}
                className="mb-4 text-base leading-relaxed"
              />
            ) : (
              <p className="mb-4 text-base leading-relaxed">{situation.description.text_el_a2}</p>
            )}
            <div className="mt-auto">
              {situation.description.audio_a2_url && (
                <WaveformPlayer
                  audioUrl={situation.description.audio_a2_url}
                  variant="culture"
                  onPlay={handleA2Play}
                />
              )}
            </div>
          </section>
        )}

        {/* B1 Description */}
        {situation.description && (
          <section ref={setDescB1ContainerEl} className="flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('situations.detail.description')}</h2>
              <Badge variant="outline">B1</Badge>
            </div>
            {descB1Enabled ? (
              <KaraokeText
                wordTimestamps={situation.description.word_timestamps ?? []}
                currentTimeMs={descB1TimeMs}
                fallbackText={situation.description.text_el}
                className="mb-4 text-base leading-relaxed"
              />
            ) : (
              <p className="mb-4 text-base leading-relaxed">{situation.description.text_el}</p>
            )}
            <div className="mt-auto">
              {situation.description.audio_url && (
                <WaveformPlayer
                  audioUrl={situation.description.audio_url}
                  variant="culture"
                  onPlay={handleB1Play}
                />
              )}
            </div>
          </section>
        )}
      </div>

      {/* Dialog */}
      {situation.dialog && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{t('situations.detail.dialog')}</h2>
          {situation.dialog.audio_url && (
            <div ref={setDialogContainerEl} className="mb-4">
              <WaveformPlayer
                audioUrl={situation.dialog.audio_url}
                variant="culture"
                onPlay={handleDialogPlay}
              />
            </div>
          )}
          <div className="space-y-3">
            {situation.dialog.lines.map((line) => {
              const speaker = situation.dialog!.speakers.find((s) => s.id === line.speaker_id);
              const speakerIdx = speaker ? speaker.speaker_index : 0;
              const style = SPEAKER_BUBBLE_STYLES[speakerIdx % SPEAKER_BUBBLE_STYLES.length];
              const isActive = activeLine?.id === line.id;
              const isLeft = speakerIdx % 2 === 0;

              return (
                <div key={line.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg border p-3 transition-all ${style.bg} ${style.border} ${
                      isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                    }`}
                  >
                    {speaker && (
                      <p className={`mb-1 text-xs font-semibold ${style.name}`}>
                        {speaker.character_name}
                      </p>
                    )}
                    {line.word_timestamps?.length ? (
                      <KaraokeText
                        wordTimestamps={line.word_timestamps}
                        currentTimeMs={dialogTimeMs}
                        fallbackText={line.text}
                      />
                    ) : (
                      <p className="text-sm">{line.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Practice CTA */}
      <section className="mt-8">
        <Button size="lg" disabled className="w-full" data-testid="practice-cta">
          {t('situations.detail.practice', {
            completed: situation.exercise_completed,
            total: situation.exercise_total,
          })}
        </Button>
      </section>
    </div>
  );
};
