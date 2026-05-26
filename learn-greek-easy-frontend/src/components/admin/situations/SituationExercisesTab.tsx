import { useEffect, useRef, useState } from 'react';

import { FileText, Image, ListChecks, Loader2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
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
  ExerciseSourceType,
  SituationExerciseGroupResponse,
  SituationExerciseResponse,
  SituationExercisesResponse,
} from '@/types/situation';

import { ExerciseItemPayload, elText } from '../exercises/ExerciseItemPayload';

interface SituationExercisesTabProps {
  situationId: string;
  /** When true, hides internal source-type accordion; drawer controls source via `value`. */
  hideSourceFilter?: boolean;
  /** Controlled active source type (used when `hideSourceFilter` is true). */
  value?: ExerciseSourceType;
  /** Called when the active controlled source changes (wired by drawer sub-tab bar). */
  onValueChange?: (v: ExerciseSourceType) => void;
  /**
   * Fires exactly once per `situationId` fetch with the full response.
   * Re-fires when `situationId` changes. Does NOT fire on every re-render.
   */
  onDataLoaded?: (data: SituationExercisesResponse) => void;
}

const SOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  dialog: MessageSquare,
  description: FileText,
  picture: Image,
};

// ── Flat-list row (controlled/drawer mode) ────────────────────────────────────

function ExerciseFlatRow({
  exercise,
  index,
  sourceType,
}: {
  exercise: SituationExerciseResponse;
  index: number;
  sourceType: string;
}) {
  const { t } = useTranslation('admin');

  // Extract Greek question and answer from first item payload
  const firstItem = exercise.items[0];
  const payload = firstItem?.payload ?? {};
  const questionEl = elText(
    payload.prompt ?? payload.question_text ?? payload.question ?? payload.text
  );
  const options = Array.isArray(payload.options) ? payload.options : undefined;
  const correctIndex =
    typeof payload.correct_answer_index === 'number'
      ? payload.correct_answer_index
      : typeof payload.correct_option === 'number'
        ? payload.correct_option - 1
        : undefined;
  const answerEl = options && correctIndex !== undefined ? elText(options[correctIndex]) : '';

  return (
    <li className="dr-ex-row" data-testid={`dr-ex-row-${exercise.id}`}>
      <span className="dr-ex-index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="dr-ex-body">
        <div className="dr-ex-badges">
          <Badge variant="secondary" className="dr-ex-badge-type">
            {t(`situations.detail.exercises.type.${exercise.exercise_type}`)}
          </Badge>
          {exercise.audio_level && (
            <Badge tone="violet" className="dr-ex-badge-level">
              {t(`situations.detail.exercises.audioLevel.${exercise.audio_level}`)}
            </Badge>
          )}
          {sourceType === 'dialog' && (
            <span
              className="dr-ex-source"
              aria-label={t('situations.detail.exercises.dialogSource', { n: index + 1 })}
            >
              ← {t('situations.detail.exercises.turnLabel', { n: index + 1 })}
            </span>
          )}
        </div>
        {questionEl && (
          <p className="dr-ex-question" lang="el">
            {questionEl}
          </p>
        )}
        {answerEl && (
          <div className="dr-ex-answer">
            <span className="dr-ex-answer-label">
              {t('situations.detail.exercises.answerLabel')}
            </span>
            <span className="dr-ex-answer-text" lang="el">
              {answerEl}
            </span>
          </div>
        )}
      </div>
      <div className="dr-ex-actions">
        <button
          type="button"
          className="dr-ex-icon-btn"
          disabled
          title={t('comingSoon')}
          aria-label={t('situations.drawer.exercises.editAria', { index: index + 1 })}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dr-ex-icon-btn"
          disabled
          title={t('comingSoon')}
          aria-label={t('situations.drawer.exercises.deleteAria', { index: index + 1 })}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function ExerciseFlatList({
  exercises,
  sourceType,
}: {
  exercises: SituationExerciseResponse[];
  sourceType: string;
}) {
  return (
    <ul className="dr-ex-list" role="list" data-testid="dr-ex-list">
      {exercises.map((exercise, index) => (
        <ExerciseFlatRow
          key={exercise.id}
          exercise={exercise}
          index={index}
          sourceType={sourceType}
        />
      ))}
    </ul>
  );
}

// ── Accordion items (uncontrolled / back-compat mode) ─────────────────────────

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
                ? 'bg-success text-success-foreground hover:bg-success/90'
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

export function SituationExercisesTab({
  situationId,
  hideSourceFilter = false,
  value,
  onValueChange: _onValueChange,
  onDataLoaded,
}: SituationExercisesTabProps) {
  const { t } = useTranslation('admin');
  const [data, setData] = useState<SituationExercisesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last situationId for which we fired onDataLoaded.
  // Not in deps — we use a ref so the callback can be unstable (e.g. setState).
  const lastNotifiedSituationIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchExercises = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminAPI.getSituationExercises(situationId);
        if (!cancelled) {
          setData(result);
          // Fire onDataLoaded exactly once per situationId fetch.
          if (onDataLoaded && lastNotifiedSituationIdRef.current !== situationId) {
            lastNotifiedSituationIdRef.current = situationId;
            onDataLoaded(result);
          }
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
      // Reset so a remount or id-change fires the callback again.
      lastNotifiedSituationIdRef.current = null;
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

  // ── Controlled mode (hideSourceFilter) ──────────────────────────────────────
  if (hideSourceFilter) {
    if (!data) return null;
    const activeGroup = data.groups.find((g) => g.source_type === value);
    if (!activeGroup || activeGroup.exercises.length === 0) {
      // Drawer owns the empty state — render nothing here.
      return null;
    }
    return (
      <ExerciseFlatList exercises={activeGroup.exercises} sourceType={activeGroup.source_type} />
    );
  }

  // ── Uncontrolled / legacy mode ───────────────────────────────────────────────
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
