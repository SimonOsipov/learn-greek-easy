import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, Headphones, RotateCcw, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { EmptyState } from '@/components/feedback/EmptyState';
import { KaraokeText } from '@/components/shared/KaraokeText';
import {
  calcStatusCounts,
  type ExerciseTopicFilter,
} from '@/components/situations/exerciseGridHelpers';
import { ScenePlaceholder } from '@/components/situations/ScenePlaceholder';
import { SituationActionPanel } from '@/components/situations/SituationActionPanel';
import { SituationDetailHero } from '@/components/situations/SituationDetailHero';
import { SituationExerciseGrid } from '@/components/situations/SituationExerciseGrid';
import { situationToCoverProps } from '@/components/situations/situationToCoverProps';
import { SourceCard } from '@/components/situations/SourceCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Kicker } from '@/features/decks/dx';
import '@/features/decks/dx/dx.css';
import { useAudioTimeMs } from '@/hooks/useAudioTimeMs';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseQueue } from '@/services/exerciseAPI';
import { situationAPI } from '@/services/situationAPI';
import { useQuestionLanguageStore } from '@/stores/questionLanguageStore';
import type { LearnerSituationDetailResponse, SituationStatsResponse } from '@/types/situation';

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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const SituationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('common');
  const { currentLanguage } = useLanguage();
  const { language: questionLanguage, setLanguage: setQuestionLanguage } =
    useQuestionLanguageStore();

  // Topic filter is owned by the page so the action panel chips and the grid
  // share a single source of truth (SIT-27-07).
  const [activeTopic, setActiveTopic] = useState<ExerciseTopicFilter>('all');

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

  // Fetch exercise queue (all exercises, regardless of SM-2 state)
  const {
    data: exercisesData,
    isLoading: exercisesLoading,
    isError: exercisesError,
    refetch: refetchExercises,
  } = useQuery<ExerciseQueue>({
    queryKey: ['situationAllExercises', id],
    queryFn: () => exerciseAPI.getAllForSituation(id!),
    enabled: !!id,
  });

  // Fetch per-situation stats for the metric strip (SIT-27-04)
  const { data: stats } = useQuery<SituationStatsResponse>({
    queryKey: ['situationStats', id],
    queryFn: () => situationAPI.getStats(id!),
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
  const [descB1ContainerEl, setDescB1ContainerEl] = useState<HTMLElement | null>(null);
  const descB1Enabled =
    !!situation?.description?.audio_url && !!situation?.description?.word_timestamps?.length;
  const descB1TimeMs = useAudioTimeMs(descB1ContainerEl, descB1Enabled);

  // A2 description audio container ref
  const [descA2ContainerEl, setDescA2ContainerEl] = useState<HTMLElement | null>(null);
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
    [situation?.id] // eslint-disable-line react-hooks/exhaustive-deps
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
    [situation?.id] // eslint-disable-line react-hooks/exhaustive-deps
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
    [situation?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Status counts over the full exercise list (authoritative per-exercise SM-2
  // status) — drives the action-panel progress bar + legend.
  const exercises = useMemo(() => exercisesData?.exercises ?? [], [exercisesData]);
  const statusCounts = useMemo(() => calcStatusCounts(exercises), [exercises]);

  if (!id) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" data-testid="situation-detail">
        <p className="mb-4 text-muted-foreground">{t('situations.detail.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/situations">{t('situations.detail.backToList')}</Link>
        </Button>
      </div>
    );
  }

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

  // Hero kicker: domain · level (level from the cover adapter's gradient mapping).
  const coverProps = situationToCoverProps(situation);
  const heroDomain = situation.domain
    ? situation.domain.charAt(0).toUpperCase() + situation.domain.slice(1)
    : t('situations.card.kickerFallback', { level: coverProps.level });
  const heroKicker = situation.domain
    ? t('situations.detail.hero.kicker', { domain: heroDomain, level: coverProps.level })
    : heroDomain;

  // Hero stats use the per-situation stats when available, falling back to the
  // exercise-derived status counts so the hero is never empty.
  const totalExercises = situation.exercise_total || exercises.length;
  const masteredCount = stats?.mastered ?? statusCounts.mastered;
  const inReviewCount = stats?.in_review ?? statusCounts.review;
  const toPracticeCount = stats?.to_practice ?? statusCounts.new;
  const audioCount = stats?.audio ?? 0;
  const masteredPct = totalExercises > 0 ? Math.round((masteredCount / totalExercises) * 100) : 0;

  const heroStats = [
    { label: t('situations.detail.hero.statExercises'), value: totalExercises },
    { label: t('situations.detail.hero.statInReview'), value: inReviewCount },
    { label: t('situations.detail.hero.statMastered'), value: masteredCount },
  ];

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
    <div
      className="container mx-auto space-y-6 px-4 py-8 pb-20 lg:pb-8"
      data-testid="situation-detail"
    >
      {/* Back link */}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 hover:bg-transparent"
        data-testid="situation-hero-back-btn"
      >
        <Link to="/situations">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('situations.detail.back')}
        </Link>
      </Button>

      {/* Hero */}
      <div data-testid="situation-detail-hero">
        <SituationDetailHero situation={situation} kicker={heroKicker} stats={heroStats} />

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

      {/* Metric strip — To practice / In review / Mastered / Audio (SIT-27-04) */}
      <CultureMetricStrip
        metrics={[
          {
            icon: <BookOpen className="h-5 w-5" />,
            label: t('situations.detail.metric.toPractice'),
            value: toPracticeCount,
            tone: 'primary',
            trend: t('situations.detail.metric.toPracticeSub'),
            trendTone: 'flat',
          },
          {
            icon: <RotateCcw className="h-5 w-5" />,
            label: t('situations.detail.metric.inReview'),
            value: inReviewCount,
            tone: 'amber',
            trend: t('situations.detail.metric.inReviewSub'),
            trendTone: 'flat',
          },
          {
            icon: <Trophy className="h-5 w-5" />,
            label: t('situations.detail.metric.mastered'),
            value: `${masteredCount}/${totalExercises}`,
            tone: 'green',
            trend: t('situations.detail.metric.masteredSub', { pct: masteredPct }),
            trendTone: 'flat',
          },
          {
            icon: <Headphones className="h-5 w-5" />,
            label: t('situations.detail.metric.audio'),
            value: audioCount,
            tone: 'violet',
            trend: t('situations.detail.metric.audioSub'),
            trendTone: 'flat',
          },
        ]}
      />

      {/* Exercises section: action panel + toolbar + grid (SIT-27-07) */}
      <section className="space-y-6" data-testid="situation-exercises-section">
        <div className="cx-section-head">
          <Kicker tone="primary">{t('situations.detail.exercises.sectionTitle')}</Kicker>
        </div>

        {exercisesLoading ? (
          <div className="space-y-4" data-testid="exercises-loading">
            <Skeleton className="h-40 w-full rounded-2xl" />
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
        ) : exercises.length === 0 ? (
          <EmptyState
            title={t('situations.detail.exercises.empty.title')}
            description={t('situations.detail.exercises.empty.description')}
          />
        ) : (
          <>
            <SituationActionPanel
              mastered={statusCounts.mastered}
              inReview={statusCounts.review}
              toPractice={statusCounts.new}
              total={statusCounts.all}
              topicCounts={exercisesData?.topic_counts}
              activeTopic={activeTopic}
              onTopicChange={setActiveTopic}
            />
            <SituationExerciseGrid
              exercises={exercises}
              activeTopic={activeTopic}
              language={questionLanguage}
              onLanguageChange={setQuestionLanguage}
            />
          </>
        )}
      </section>

      {/* About this situation — preserved content, restyled section (SIT-27-06) */}
      <section className="space-y-8" data-testid="situation-about-section">
        <div className="cx-section-head">
          <Kicker tone="primary">{t('situations.detail.aboutSection')}</Kicker>
        </div>

        {/* Image row — always 2-up on lg+, falls back to placeholders */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {situation.source_url ? (
            <SourceCard
              sourceUrl={situation.source_url}
              sourceImageUrl={situation.source_image_url}
              sourceImageVariants={situation.source_image_variants}
              sourceTitle={situation.source_title}
            />
          ) : (
            <ScenePlaceholder variant="source" />
          )}

          {situation.picture_url ? (
            <div className="overflow-hidden rounded-lg border bg-muted/40">
              <img
                src={situation.picture_url}
                srcSet={buildSrcSet(situation.picture_variants)}
                sizes="(max-width: 768px) 100vw, 50vw"
                alt={scenarioTitle}
                width={800}
                height={450}
                className="aspect-video w-full object-cover"
                loading="lazy"
                onError={recoverDerivativeError}
              />
            </div>
          ) : (
            <ScenePlaceholder variant="illustration" />
          )}
        </div>

        {/* Descriptions grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* A2 Description */}
          {situation.description?.text_el_a2 && (
            <div ref={setDescA2ContainerEl} className="flex flex-col">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-semibold">{t('situations.detail.about.a2Section')}</h3>
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
                    duration={situation.description.audio_a2_duration_seconds ?? undefined}
                    variant="culture"
                    onPlay={handleA2Play}
                  />
                )}
              </div>
            </div>
          )}

          {/* B1 Description */}
          {situation.description && (
            <div ref={setDescB1ContainerEl} className="flex flex-col">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-semibold">{t('situations.detail.about.b1Section')}</h3>
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
                    duration={situation.description.audio_duration_seconds ?? undefined}
                    variant="culture"
                    onPlay={handleB1Play}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dialog */}
        {situation.dialog && (
          <div>
            <h3 className="mb-4 text-lg font-semibold">
              {t('situations.detail.about.dialogSection')}
            </h3>
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
          </div>
        )}
      </section>
    </div>
  );
};
