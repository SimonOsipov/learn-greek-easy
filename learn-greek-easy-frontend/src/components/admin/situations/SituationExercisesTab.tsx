import { useEffect, useState } from 'react';

import { FileText, Image, ListChecks, Loader2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type {
  SituationExerciseGroupResponse,
  SituationExerciseResponse,
  SituationExercisesResponse,
} from '@/types/situation';

interface SituationExercisesTabProps {
  situationId: string;
}

const SOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  dialog: MessageSquare,
  description: FileText,
  picture: Image,
};

function elText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val !== null && 'el' in val)
    return String((val as Record<string, unknown>).el);
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function ExerciseItemPayload({
  payload,
  audioUrl,
  readingText,
}: {
  payload: Record<string, unknown>;
  audioUrl?: string;
  readingText?: string;
}) {
  const questionText = elText(payload.question_text ?? payload.question ?? payload.text);
  const options = Array.isArray(payload.options) ? payload.options : undefined;
  const correctOption =
    typeof payload.correct_option === 'number' ? payload.correct_option : undefined;

  return (
    <div className="space-y-3 text-sm">
      {audioUrl && (
        <WaveformPlayer
          audioUrl={audioUrl}
          variant="admin"
          barCount={32}
          showSpeedControl={false}
        />
      )}
      {readingText && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm leading-relaxed">
          {readingText}
        </p>
      )}
      {questionText && <p className="font-medium">{questionText}</p>}
      {options && options.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, idx) => {
            const isCorrect = correctOption !== undefined && idx + 1 === correctOption;
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-md border px-3 py-2',
                  isCorrect
                    ? 'border-green-600 bg-green-50 font-semibold text-green-700'
                    : 'border-border text-muted-foreground'
                )}
              >
                {elText(opt)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExerciseAccordionItem({
  exercise,
  sourceType,
}: {
  exercise: SituationExerciseResponse;
  sourceType: string;
}) {
  const { t } = useTranslation('admin');

  const sortedItems = [...exercise.items].sort((a, b) => a.item_index - b.item_index);

  return (
    <AccordionItem value={exercise.id} data-testid={`situation-exercises-item-${exercise.id}`}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t(`situations.detail.exercises.type.${exercise.exercise_type}`)}
          </Badge>
          <Badge
            variant={exercise.status === 'approved' ? 'default' : 'secondary'}
            className={
              exercise.status === 'approved'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : undefined
            }
          >
            {t(`situations.detail.exercises.status.${exercise.status}`)}
          </Badge>
          {sourceType === 'description' && exercise.audio_level && (
            <Badge variant="outline">
              {t(`situations.detail.exercises.audioLevel.${exercise.audio_level}`)}
            </Badge>
          )}
          {sourceType === 'description' && exercise.modality && (
            <Badge variant="outline">
              {t(`situations.detail.exercises.modality.${exercise.modality}`)}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('situations.detail.exercises.empty.noExercisesInGroup')}
          </p>
        ) : (
          <div
            className="space-y-3"
            data-testid={`situation-exercises-item-payload-${exercise.id}`}
          >
            {sortedItems.map((item) => (
              <ExerciseItemPayload
                key={item.item_index}
                payload={item.payload}
                audioUrl={exercise.audio_url}
                readingText={exercise.reading_text}
              />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function GroupAccordionItem({ group }: { group: SituationExerciseGroupResponse }) {
  const { t } = useTranslation('admin');
  const Icon = SOURCE_TYPE_ICONS[group.source_type] ?? FileText;

  return (
    <AccordionItem
      value={group.source_type}
      data-testid={`situation-exercises-group-${group.source_type}`}
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{t(`situations.detail.exercises.sourceType.${group.source_type}`)}</span>
          <Badge variant="secondary">{group.exercise_count}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <Accordion type="single" collapsible className="pl-2">
          {group.exercises.map((exercise) => (
            <ExerciseAccordionItem
              key={exercise.id}
              exercise={exercise}
              sourceType={group.source_type}
            />
          ))}
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  );
}

export function SituationExercisesTab({ situationId }: SituationExercisesTabProps) {
  const { t } = useTranslation('admin');
  const [data, setData] = useState<SituationExercisesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchExercises = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminAPI.getSituationExercises(situationId);
        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) setError(t('situations.detail.exercises.error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchExercises();
    return () => {
      cancelled = true;
    };
  }, [situationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div
        data-testid="situation-exercises-loading"
        className="flex items-center justify-center py-8"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="situation-exercises-error">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (data?.total_count === 0) {
    return (
      <div
        data-testid="situation-exercises-empty"
        className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
      >
        <ListChecks className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('situations.detail.exercises.empty.noExercises')}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Accordion type="multiple" className="w-full">
      {data.groups.map((group) => (
        <GroupAccordionItem key={group.source_type} group={group} />
      ))}
    </Accordion>
  );
}
