import { useEffect, useState } from 'react';

import { FileText, Image, ListChecks, Loader2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { adminAPI } from '@/services/adminAPI';
import type {
  SituationExerciseGroupResponse,
  SituationExerciseResponse,
  SituationExercisesResponse,
} from '@/types/situation';

interface SituationExercisesTabProps {
  situationId: string;
  onCountLoaded?: (count: number) => void;
}

const SOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  dialog: MessageSquare,
  description: FileText,
  picture: Image,
};

function ExerciseItemPayload({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation('admin');

  const question = (payload.question ?? payload.text) as string | undefined;
  const options = payload.options as string[] | undefined;
  const correctAnswer = (payload.correct_answer ?? payload.answer) as string | undefined;
  const statement = payload.statement as string | undefined;

  if (statement !== undefined && correctAnswer !== undefined) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium">{statement}</p>
        <p className="text-muted-foreground">
          {t('situations.detail.exercises.meta.correctAnswer')}:{' '}
          <span className="font-semibold text-green-600">{String(correctAnswer)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {question && <p className="font-medium">{question}</p>}
      {options && options.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5">
          {options.map((opt, idx) => (
            <li
              key={idx}
              className={opt === correctAnswer ? 'font-semibold text-green-600' : undefined}
            >
              {opt}
            </li>
          ))}
        </ol>
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
          <Badge variant="outline">{exercise.item_count}</Badge>
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
              <ExerciseItemPayload key={item.item_index} payload={item.payload} />
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

export function SituationExercisesTab({ situationId, onCountLoaded }: SituationExercisesTabProps) {
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
          onCountLoaded?.(result.total_count);
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
