import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { ExercisePreviewCard } from '@/components/exercises/ExercisePreviewCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { KaraokeText } from '@/components/shared/KaraokeText';
import { ScenePlaceholder } from '@/components/situations/ScenePlaceholder';
import { SourceCard } from '@/components/situations/SourceCard';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAudioTimeMs } from '@/hooks/useAudioTimeMs';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseModality, ExerciseQueue, ExerciseQueueItem } from '@/services/exerciseAPI';
import { situationAPI } from '@/services/situationAPI';
import type { LearnerSituationDetailResponse, SituationStatus } from '@/types/situation';

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

const STATUS_BADGE_VARIANT: Record<SituationStatus, 'default' | 'secondary' | 'outline'> = {
  ready: 'default',
  partial_ready: 'secondary',
  draft: 'outline',
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const MODALITY_ORDER: ExerciseModality[] = ['listening', 'reading'];

function groupByModality(
  exercises: ExerciseQueueItem[]
): Map<ExerciseModality, ExerciseQueueItem[]> {
  const groups = new Map<ExerciseModality, ExerciseQueueItem[]>();
  for (const ex of exercises) {
    const key = ex.modality ?? 'reading';
    const list = groups.get(key) ?? [];
    list.push(ex);
    groups.set(key, list);
  }
  return groups;
}

function ExercisesByModality({ exercises }: { exercises: ExerciseQueueItem[] }) {
  const { t } = useTranslation('common');
  const groups = groupByModality(exercises);

  return (
    <Accordion type="multiple" className="w-full">
      {MODALITY_ORDER.filter((m) => groups.has(m)).map((modality) => {
        const items = groups.get(modality)!;
        return (
          <AccordionItem key={modality} value={modality}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span>{t(`exercises.modality.${modality}`)}</span>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {items.map((exercise) => (
                  <ExercisePreviewCard key={exercise.exercise_id} exercise={exercise} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export const SituationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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

  // Fetch exercise queue
  const {
    data: exercisesData,
    isLoading: exercisesLoading,
    isError: exercisesError,
    refetch: refetchExercises,
  } = useQuery<ExerciseQueue>({
    queryKey: ['situationExercises', id],
    queryFn: () => exerciseAPI.getQueue({ situation_id: id!, limit: 100, include_new: true }),
    enabled: !!id,
  });

  const exerciseTotal = situation?.exercise_total ?? 0;
  const exerciseCompleted = situation?.exercise_completed ?? 0;

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

  // Tab state
  const [activeTab, setActiveTab] = useState('about');
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (situation) {
        track('situation_tab_switched', {
          tab: value as 'about' | 'exercises',
          situation_id: situation.id,
        });
      }
    },
    [situation]
  );

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
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 pb-12">
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="mb-2 h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="mt-6">
          <Skeleton className="mb-4 h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (is404 || (!isError && !isLoading && !situation)) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" data-testid="situation-detail">
        <p className="mb-4 text-muted-foreground">{t('situations.detail.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/situations">{t('situations.detail.backToList')}</Link>
        </Button>
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

  const completed = exerciseCompleted;
  const total = exerciseTotal;

  return (
    <div className="container mx-auto px-4 py-8 pb-20 lg:pb-8" data-testid="situation-detail">
      {/* Hero Section */}
      <div
        className="relative rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 pb-12"
        data-testid="situation-detail-hero"
      >
        {/* Back button */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hover:bg-transparent"
          data-testid="situation-hero-back-btn"
        >
          <Link to="/situations">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('situations.detail.back')}
          </Link>
        </Button>

        {/* Badges row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[situation.status]}>
            {t(
              `situations.detail.status.${situation.status === 'partial_ready' ? 'partialReady' : situation.status}`
            )}
          </Badge>
          <Badge variant="outline" data-testid="situation-hero-progress">
            {t('situations.detail.hero.exerciseProgress', { completed, total })}
          </Badge>
        </div>

        {/* Title */}
        <h1 className="mt-4 text-4xl font-bold text-foreground sm:text-5xl">{scenarioTitle}</h1>

        {/* Greek subtitle */}
        <p className="mt-2 text-lg text-muted-foreground">{situation.scenario_el}</p>

        {/* Source attribution */}
        {situation.source_url && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('situations.detail.hero.sourceAttribution')}:{' '}
            <a
              href={situation.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {extractDomain(situation.source_url)}
            </a>
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        data-testid="situation-detail-tabs"
        className="mt-6"
      >
        <TabsList className="w-full">
          <TabsTrigger value="about" className="flex-1" data-testid="situation-tab-about">
            {t('situations.detail.tabs.about')}
          </TabsTrigger>
          <TabsTrigger value="exercises" className="flex-1" data-testid="situation-tab-exercises">
            {exercisesLoading
              ? t('situations.detail.tabs.exercises', { count: situation.exercise_total })
              : t('situations.detail.tabs.exercisesWithCount', {
                  completed: exerciseCompleted,
                  total: exerciseTotal,
                })}
          </TabsTrigger>
        </TabsList>

        {/* About Tab */}
        <TabsContent value="about" className="mt-6 space-y-8">
          {/* Image row */}
          <div className={cn('grid grid-cols-1 gap-6', situation.source_url && 'lg:grid-cols-2')}>
            {situation.source_url && (
              <SourceCard
                sourceUrl={situation.source_url}
                sourceImageUrl={situation.source_image_url}
                sourceTitle={situation.source_title}
              />
            )}
            <ScenePlaceholder />
          </div>

          {/* Descriptions grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* A2 Description */}
            {situation.description?.text_el_a2 && (
              <section ref={setDescA2ContainerEl} className="flex flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {t('situations.detail.about.a2Section')}
                  </h2>
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
                  <p className="mb-4 text-base leading-relaxed">
                    {situation.description.text_el_a2}
                  </p>
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
                  <h2 className="text-lg font-semibold">
                    {t('situations.detail.about.b1Section')}
                  </h2>
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
              <h2 className="mb-4 text-lg font-semibold">
                {t('situations.detail.about.dialogSection')}
              </h2>
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
                    <div
                      key={line.id}
                      className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
                    >
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
        </TabsContent>

        {/* Exercises Tab */}
        <TabsContent value="exercises" className="mt-6">
          {exercisesLoading ? (
            <div className="space-y-4" data-testid="exercises-tab-loading">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : exercisesError ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">
                {t('situations.detail.exercises.error.title')}
              </p>
              <Button onClick={() => void refetchExercises()}>
                {t('situations.detail.exercises.error.retry')}
              </Button>
            </div>
          ) : !exercisesData?.exercises.length ? (
            <EmptyState
              title={t('situations.detail.exercises.empty.title')}
              description={t('situations.detail.exercises.empty.description')}
            />
          ) : (
            <ExercisesByModality exercises={exercisesData.exercises} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
