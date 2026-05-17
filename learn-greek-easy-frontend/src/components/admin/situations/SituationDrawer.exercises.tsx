// src/components/admin/situations/SituationDrawer.exercises.tsx
//
// SIT-07d: Exercises tab — 3-source sub-tab bar, counts from loaded data,
// Generate button (disabled / "Coming soon"), per-source empty state.
// Data is fetched once by SituationExercisesTab; source switching is client-side.

import { useEffect, useState } from 'react';

import { Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SegControl } from '@/components/ui/seg-control';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  ExerciseSourceType,
  SituationDetailResponse,
  SituationExercisesResponse,
} from '@/types/situation';

import { SituationExercisesTab } from './SituationExercisesTab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  situation: SituationDetailResponse;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_TYPES: ExerciseSourceType[] = ['dialog', 'description', 'picture'];

function getCount(
  exercisesData: SituationExercisesResponse | null,
  src: ExerciseSourceType
): number {
  return exercisesData?.groups.find((g) => g.source_type === src)?.exercise_count ?? 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GenerateButton({ source }: { source: ExerciseSourceType }) {
  const { t } = useTranslation('admin');
  // TODO(SIT-XX): wire to adminAPI.generateSituationExercises when endpoint lands
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Wrap in span so Tooltip works on disabled button */}
        <span>
          <Button
            variant="default"
            disabled
            data-testid={`situation-drawer-exercises-generate-${source}`}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {t('situations.drawer.exercises.generateFrom', {
              source: t(`situations.drawer.exercises.source.${source}`),
            })}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('comingSoon')}</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({ source }: { source: ExerciseSourceType }) {
  const { t } = useTranslation('admin');
  return (
    <div
      data-testid="situation-drawer-exercises-empty"
      className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
    >
      <Wand2 className="h-8 w-8 opacity-40" />
      <p className="text-sm">{t('situations.drawer.exercises.empty.title')}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="default" disabled>
              <Wand2 className="mr-2 h-4 w-4" />
              {t('situations.drawer.exercises.empty.cta')}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('comingSoon')}</TooltipContent>
      </Tooltip>
      {/* Suppress unused-var for source — reserved for future endpoint wiring */}
      <span className="sr-only">{source}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SituationDrawerExercises({ situation }: Props) {
  const { t } = useTranslation('admin');

  const [exercisesData, setExercisesData] = useState<SituationExercisesResponse | null>(null);
  const [activeSource, setActiveSource] = useState<ExerciseSourceType>('dialog');

  // Reset state when navigating to a different situation.
  useEffect(() => {
    setExercisesData(null);
    setActiveSource('dialog');
  }, [situation.id]);

  const counts = {
    dialog: getCount(exercisesData, 'dialog'),
    description: getCount(exercisesData, 'description'),
    picture: getCount(exercisesData, 'picture'),
  };

  const activeCount = counts[activeSource];

  const segOptions = SOURCE_TYPES.map((src) => ({
    value: src,
    label: t(`situations.drawer.exercises.source.${src}`),
    count: counts[src],
  }));

  return (
    <TooltipProvider>
      <div data-testid="situation-drawer-tab-exercises-content">
        {/* Sub-tab toolbar */}
        <div className="mb-3 flex w-full items-center justify-between">
          <SegControl<ExerciseSourceType>
            options={segOptions}
            value={activeSource}
            onChange={setActiveSource}
          />
          <GenerateButton source={activeSource} />
        </div>

        {/*
         * Always render SituationExercisesTab so the initial fetch completes
         * and onDataLoaded fires even when the active group is empty.
         * In controlled mode the tab renders null when activeCount === 0,
         * and the drawer shows EmptyState below instead.
         */}
        <SituationExercisesTab
          situationId={situation.id}
          hideSourceFilter
          value={activeSource}
          onValueChange={setActiveSource}
          onDataLoaded={setExercisesData}
        />

        {/* Per-source empty state — shown only after data has loaded */}
        {exercisesData && activeCount === 0 && <EmptyState source={activeSource} />}
      </div>
    </TooltipProvider>
  );
}
