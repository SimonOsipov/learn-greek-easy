import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Badge } from '@/components/ui/badge';
import type { DeckLevel, ExerciseModality } from '@/services/exerciseAPI';

interface ExerciseContentStepProps {
  modality: ExerciseModality | null;
  audioLevel: DeckLevel | null;
  descriptionTextEl: string | null;
  descriptionAudioUrl: string | null;
  descriptionAudioDuration: number | null;
  onAudioPlay?: (duration: number) => void;
}

export function ExerciseContentStep({
  modality,
  audioLevel,
  descriptionTextEl,
  descriptionAudioUrl,
  descriptionAudioDuration,
  onAudioPlay,
}: ExerciseContentStepProps) {
  const { t } = useTranslation('common');

  const hasBadges = modality !== null || audioLevel !== null;
  const hasReadingContent = modality === 'reading' && !!descriptionTextEl?.trim();
  const hasListeningContent = modality === 'listening' && !!descriptionAudioUrl;
  const hasContent = hasBadges || hasReadingContent || hasListeningContent;

  if (!hasContent) return null;

  return (
    <div data-testid="exercise-content-step">
      {hasBadges && (
        <div className="mb-3 flex items-center gap-2" data-testid="exercise-metadata-badges">
          {modality && (
            <Badge variant="secondary">{t(`exercises.session.modalityBadge.${modality}`)}</Badge>
          )}
          {audioLevel && <Badge variant="outline">{audioLevel}</Badge>}
        </div>
      )}

      {hasReadingContent && (
        <section
          aria-label={t('exercises.session.contentStep.readingPassage')}
          className="mb-4 rounded-lg border bg-muted/50 p-4"
          data-testid="exercise-reading-passage"
        >
          <p className="text-base leading-relaxed">{descriptionTextEl}</p>
        </section>
      )}

      {hasListeningContent && (
        <section
          aria-label={t('exercises.session.contentStep.listeningAudio')}
          className="mb-4 space-y-3"
          data-testid="exercise-listening-audio"
        >
          <WaveformPlayer
            audioUrl={descriptionAudioUrl!}
            duration={descriptionAudioDuration ?? undefined}
            variant="culture"
            onPlay={onAudioPlay}
          />
        </section>
      )}
    </div>
  );
}
